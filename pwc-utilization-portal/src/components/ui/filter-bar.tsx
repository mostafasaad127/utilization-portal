"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { fieldClass } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterDef = { name: string; label: string; options: FilterOption[]; allLabel?: string; defaultValue?: string; noEmpty?: boolean };

/**
 * Filters live in the URL so views are shareable and bookmarkable. It is a
 * plain GET form (works without JavaScript); selects auto-apply on change.
 */
export function FilterBar({
  filters,
  values,
  searchPlaceholder = "Search",
  showSearch = true,
  preserve = {},
}: {
  filters: FilterDef[];
  values: Record<string, string | undefined>;
  searchPlaceholder?: string;
  showSearch?: boolean;
  preserve?: Record<string, string | undefined>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const activeCount = filters.filter((f) => values[f.name] && values[f.name] !== f.defaultValue).length + (values.q ? 1 : 0);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string" && v !== "") params.set(k, v);
    }
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <form
      ref={formRef}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-wrap items-end gap-3"
      role="search"
    >
      {Object.entries(preserve).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {showSearch && (
        <label className="relative min-w-[16rem] flex-1 sm:max-w-sm">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={values.q ?? ""}
            placeholder={searchPlaceholder}
            className={cn(fieldClass, "h-10 pr-3 pl-9 text-sm")}
          />
        </label>
      )}
      {filters.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="text-xs text-muted">{f.label}</span>
          <select
            name={f.name}
            defaultValue={values[f.name] ?? f.defaultValue ?? ""}
            onChange={apply}
            className={cn(fieldClass, "h-10 min-w-[9rem] appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8 pl-3 text-sm")}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23696969' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            }}
          >
            {!f.noEmpty && <option value="">{f.allLabel ?? "All"}</option>}
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            const kept = new URLSearchParams(Object.entries(preserve).filter((e): e is [string, string] => Boolean(e[1])));
            router.push(`${pathname}${kept.size ? `?${kept}` : ""}`);
          }}
          className="inline-flex h-10 items-center gap-1 rounded-sm px-3 text-sm text-primary hover:bg-primary-tint"
        >
          <X className="size-4" aria-hidden /> Clear filters
        </button>
      )}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
    </form>
  );
}
