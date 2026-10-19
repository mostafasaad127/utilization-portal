import "server-only";
import ExcelJS from "exceljs";
import type { RawCell } from "@/lib/import/plan";

// Vercel caps a function request body at 4.5 MB, so uploads are limited to 4 MB there.
export const MAX_IMPORT_BYTES = (process.env.VERCEL ? 4 : 10) * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2_000;
const MAX_ROWS_PER_SHEET = 10_000;

/** Reads every worksheet into a matrix of plain cell values (formulas → cached results). */
export async function readWorkbook(file: File): Promise<{ name: string; rows: RawCell[][] }[]> {
  if (file.size === 0) throw new ImportFileError("The file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new ImportFileError(`The file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  if (!/\.xlsx$/i.test(file.name)) throw new ImportFileError("Upload an Excel .xlsx file.");

  const buffer = Buffer.from(await file.arrayBuffer());
  // .xlsx is a zip archive: check the magic bytes rather than trusting the extension.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new ImportFileError("This doesn't look like an Excel workbook.");

  // Reject zip bombs before anything is decompressed: the 10 MB cap above only
  // limits the compressed size.
  const uncompressed = zipUncompressedSize(buffer);
  if (uncompressed === null) throw new ImportFileError("This doesn't look like an Excel workbook.");
  if (uncompressed > MAX_UNCOMPRESSED_BYTES) throw new ImportFileError("The workbook is too large to import.");

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportFileError("The workbook couldn't be read. Save it as .xlsx and try again.");
  }

  return wb.worksheets.map((ws) => {
    const rows: RawCell[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS_PER_SHEET) return;
      const values: RawCell[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => {
        values[col - 1] = cellValue(c.value);
      });
      rows[rowNumber - 1] = values;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    return { name: ws.name, rows };
  });
}

function cellValue(v: ExcelJS.CellValue): RawCell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("formula" in v || "sharedFormula" in v) return "result" in v ? cellValue(v.result as ExcelJS.CellValue) : null; // no cached result → empty
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return cellValue(v.text as ExcelJS.CellValue); // hyperlink; text may itself be rich text
    if ("error" in v) return String(v.error);
  }
  return null;
}

/**
 * Sums the uncompressed sizes declared in the zip central directory.
 * Returns null if the archive structure is invalid.
 */
function zipUncompressedSize(buf: Buffer): number | null {
  // End of central directory record: signature 0x06054b50, within the last 64 KB + 22 bytes.
  const min = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;
  const entries = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (entries > MAX_ZIP_ENTRIES) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;
    const size = buf.readUInt32LE(offset + 24);
    if (size === 0xffffffff) return Number.POSITIVE_INFINITY; // ZIP64: far beyond our limit
    total += size;
    offset += 46 + buf.readUInt16LE(offset + 28) + buf.readUInt16LE(offset + 30) + buf.readUInt16LE(offset + 32);
  }
  return total;
}

export class ImportFileError extends Error {}
