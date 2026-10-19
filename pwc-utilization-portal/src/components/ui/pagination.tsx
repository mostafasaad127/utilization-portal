import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3 text-sm">
      <p className="text-muted">
        Showing <span className="tabular text-heading">{from}</span>–<span className="tabular text-heading">{to}</span> of{" "}
        <span className="tabular text-heading">{total}</span>
      </p>
      {pages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageLink>
          </li>
          {nums.map((n, i) => (
            <li key={n} className="flex items-center gap-1">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
              <PageLink href={hrefFor(n)} current={n === page} label={`Page ${n}`}>
                {n}
              </PageLink>
            </li>
          ))}
          <li>
            <PageLink href={hrefFor(page + 1)} disabled={page >= pages} label="Next page">
              <ChevronRight className="size-4" />
            </PageLink>
          </li>
        </ul>
      )}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  current,
  label,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = cn(
    "tabular inline-flex size-8 items-center justify-center rounded-sm",
    current ? "bg-primary text-white" : "text-body hover:bg-hover",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={cls} aria-disabled>{children}</span>;
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={current ? "page" : undefined} scroll={false}>
      {children}
    </Link>
  );
}
