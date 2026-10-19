/**
 * Tiny .xlsx reader for the browser: unzips with the built-in
 * DecompressionStream and reads cell values with DOMParser. Returns plain
 * cell matrices in the shape the portal's importer (planImport) expects.
 * Numbers stay numbers (Excel dates are serials; the importer converts them).
 */
import type { RawCell } from "../../../pwc-utilization-portal/src/lib/import/plan";

type ZipEntry = { name: string; method: number; offset: number; compressedSize: number };

function readZipDirectory(buf: ArrayBuffer): Map<string, ZipEntry> {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("The workbook's zip structure is damaged.");
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.set(name, { name, method, offset, compressedSize });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  const nameLen = v.getUint16(e.offset + 26, true);
  const extraLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`Unsupported compression in ${e.name}`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function colIndex(ref: string) {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsx(file: File | Blob): Promise<{ name: string; rows: RawCell[][] }[]> {
  const buf = await file.arrayBuffer();
  const zip = readZipDirectory(buf);
  const parse = async (path: string) => {
    const e = zip.get(path);
    if (!e) return null;
    return new DOMParser().parseFromString(await readEntry(buf, e), "application/xml");
  };

  const workbook = await parse("xl/workbook.xml");
  if (!workbook) throw new Error("This doesn't look like an Excel workbook (no xl/workbook.xml).");
  const rels = await parse("xl/_rels/workbook.xml.rels");
  const relTarget = new Map<string, string>();
  rels?.querySelectorAll("Relationship").forEach((r) => relTarget.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? ""));

  const shared: string[] = [];
  const sst = await parse("xl/sharedStrings.xml");
  if (sst) {
    for (const si of Array.from(sst.getElementsByTagNameNS(NS_MAIN, "si"))) {
      shared.push(Array.from(si.getElementsByTagNameNS(NS_MAIN, "t")).map((t) => t.textContent ?? "").join(""));
    }
  }

  const sheets: { name: string; rows: RawCell[][] }[] = [];
  for (const s of Array.from(workbook.getElementsByTagNameNS(NS_MAIN, "sheet"))) {
    const name = s.getAttribute("name") ?? "Sheet";
    const rid = s.getAttributeNS(NS_REL, "id") ?? s.getAttribute("r:id") ?? "";
    let target = relTarget.get(rid) ?? "";
    target = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const doc = await parse(target);
    if (!doc) continue;
    const rows: RawCell[][] = [];
    for (const row of Array.from(doc.getElementsByTagNameNS(NS_MAIN, "row"))) {
      const r = Number(row.getAttribute("r")) - 1;
      const cells: RawCell[] = [];
      for (const c of Array.from(row.getElementsByTagNameNS(NS_MAIN, "c"))) {
        const ref = c.getAttribute("r");
        const idx = ref ? colIndex(ref) : cells.length;
        const t = c.getAttribute("t");
        const vEl = c.getElementsByTagNameNS(NS_MAIN, "v")[0];
        const raw = vEl?.textContent ?? null;
        let value: RawCell = null;
        if (t === "s") value = raw === null ? null : shared[Number(raw)] ?? null;
        else if (t === "inlineStr") value = Array.from(c.getElementsByTagNameNS(NS_MAIN, "t")).map((x) => x.textContent ?? "").join("");
        else if (t === "b") value = raw === "1";
        else if (t === "str" || t === "e") value = raw;
        else if (raw !== null && raw !== "") value = Number(raw);
        cells[idx] = value;
      }
      rows[r] = cells;
    }
    for (let i = 0; i < rows.length; i++) rows[i] ??= [];
    sheets.push({ name, rows });
  }
  return sheets;
}
