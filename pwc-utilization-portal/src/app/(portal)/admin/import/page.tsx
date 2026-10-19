import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import spreadsheet" };

export default async function ImportPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader
        title="Import spreadsheet"
        description="Migrate the legacy utilization workbook. Rows for the same project (name, client and start date) are merged, people and clients are matched by name, and anything already in the portal is skipped."
      />
      <PageBody className="max-w-6xl">
        <ImportForm />
      </PageBody>
    </>
  );
}
