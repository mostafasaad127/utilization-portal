"use client";

import { useRef, useState } from "react";
import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { importSpreadsheet, type ImportResult } from "./actions";

export function ImportForm() {
  const { state, pending, onSubmit } = useFormAction<ImportResult & { ok?: boolean }>(importSpreadsheet);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const errors = state.issues?.filter((i) => i.level === "error") ?? [];
  const warnings = state.issues?.filter((i) => i.level === "warning") ?? [];
  const canCommit = state.mode === "preview" && state.summary && errors.length === 0 && state.summary.newProjects > 0 && file;

  function pick(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  }

  if (state.mode === "commit" && state.summary) {
    return (
      <Panel>
        <PanelBody className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <h2 className="mt-4 text-xl">Import complete</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            {state.summary.newProjects} projects, {state.summary.assignments} assignments and {state.summary.risks} risks were added.
            {state.summary.duplicates > 0 && ` ${state.summary.duplicates} existing projects were skipped.`}
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/projects?fy=all" className="text-sm text-primary hover:underline">
              View projects
            </Link>
            <Link href="/admin/audit" className="text-sm text-primary hover:underline">
              View audit log
            </Link>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="1. Upload the workbook"
          description="Use the template, or upload your existing workbook as-is: every sheet with Project Name, Client and Start_Date columns is read (e.g. FY27-Current and FY26-Archived)."
          actions={
            <a href="/api/import/template" className={buttonClass("secondary", "sm")} download>
              <Download className="size-4" aria-hidden /> Download template
            </a>
          }
        />
        <PanelBody>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary-tint" : "border-line-input hover:border-line-strong hover:bg-hover",
            )}
          >
            {file ? <FileSpreadsheet className="size-9 text-success" aria-hidden /> : <UploadCloud className="size-9 text-muted" aria-hidden />}
            <span className="mt-3 text-sm font-medium text-heading">{file ? file.name : "Drop the .xlsx file here, or click to choose"}</span>
            <span className="mt-1 text-xs text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Excel .xlsx up to 10 MB"}</span>
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          <div className="mt-4 flex justify-end">
            <Button type="submit" variant="secondary" loading={pending} disabled={!file} name="mode" value="preview">
              Validate &amp; preview
            </Button>
          </div>
        </PanelBody>
      </Panel>

      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

      {state.summary && (
        <Panel>
          <PanelHeader
            title="2. Review"
            description={`Read ${state.summary.rowsRead} rows from ${state.summary.sheets.join(", ") || "no sheets"}. Nothing has been saved yet.`}
          />
          <PanelBody className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Projects to add" value={state.summary.newProjects} />
              <Stat label="Already in portal (skipped)" value={state.summary.duplicates} />
              <Stat label="Assignments" value={state.summary.assignments} />
              <Stat label="Risks" value={state.summary.risks} />
            </dl>
            <NewList label="New clients" items={state.summary.newClients} />
            <NewList label="New people" items={state.summary.newPeople} />
            <NewList label="New lines of service" items={state.summary.newLinesOfService} />
            <NewList label="New industries" items={state.summary.newIndustries} />
            <NewList label="New capabilities" items={state.summary.newCapabilities} />

            {(errors.length > 0 || warnings.length > 0) && (
              <div className="rounded-md border border-line">
                <p className="border-b border-line px-4 py-2 text-sm font-medium text-heading">
                  {errors.length} error{errors.length === 1 ? "" : "s"}, {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                </p>
                <ul className="scrollbar-thin max-h-64 divide-y divide-line overflow-y-auto text-sm">
                  {[...errors, ...warnings].map((i, idx) => (
                    <li key={idx} className="flex gap-3 px-4 py-2">
                      <Badge tone={i.level === "error" ? "error" : "warning"}>{i.level === "error" ? "Error" : "Warning"}</Badge>
                      <span className="tabular w-32 shrink-0 text-xs text-muted">{i.row ? `${i.sheet} row ${i.row}` : i.sheet}</span>
                      <span className="text-body">{i.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PanelBody>
          {state.preview && state.preview.length > 0 && (
            <Table className="max-h-[28rem] border-t border-line">
              <THead>
                <tr>
                  <Th>Project</Th>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th>Team</Th>
                  <Th>Action</Th>
                </tr>
              </THead>
              <tbody>
                {state.preview.map((p, i) => (
                  <Tr key={i} className={p.duplicate ? "opacity-55" : undefined}>
                    <Td className="font-medium text-heading">{p.name}</Td>
                    <Td>{p.client}</Td>
                    <Td>{STATUS_LABEL[p.status as keyof typeof STATUS_LABEL]}</Td>
                    <Td className="max-w-sm text-xs">{p.team || "—"}</Td>
                    <Td>{p.duplicate ? <Badge>Skip</Badge> : <Badge tone="success">Add</Badge>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
            <p className="mr-auto text-xs text-muted">The import runs in a single transaction: either everything is saved or nothing is.</p>
            <Button type="submit" loading={pending} disabled={!canCommit} name="mode" value="commit">
              Import {state.summary.newProjects} projects
            </Button>
          </div>
        </Panel>
      )}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-container-alt px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-1 text-2xl font-medium text-heading">{value}</dd>
    </div>
  );
}

function NewList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm text-heading">
        {label} <span className="text-muted">({items.length}, will be created)</span>
      </p>
      <p className="mt-1 text-xs leading-5 text-muted">{items.slice(0, 40).join(" · ")}{items.length > 40 && " …"}</p>
    </div>
  );
}
