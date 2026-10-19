import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Appkit 4 data table: bold header row, light row separators, hover highlight. */
export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("scrollbar-thin overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-line text-xs tracking-normal text-muted">{children}</thead>;
}

export function Th({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("h-11 px-4 font-medium whitespace-nowrap first:pl-6 last:pr-6", className)} {...props}>
      {children}
    </th>
  );
}

export function Tr({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-line last:border-0 transition-colors hover:bg-hover", className)} {...props}>
      {children}
    </tr>
  );
}

export function Td({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("h-14 px-4 align-middle text-body first:pl-6 last:pr-6", className)} {...props}>
      {children}
    </td>
  );
}

/** Column header that toggles server-side sort through the URL. */
export function SortTh({
  label,
  column,
  sort,
  dir,
  hrefFor,
  className,
}: {
  label: string;
  column: string;
  sort: string;
  dir: "asc" | "desc";
  hrefFor: (column: string, dir: "asc" | "desc") => string;
  className?: string;
}) {
  const active = sort === column;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={hrefFor(column, nextDir)}
        scroll={false}
        className={cn("inline-flex items-center gap-1 hover:text-heading", active && "text-heading")}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </Link>
    </Th>
  );
}
