import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  unit,
  detail,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail?: React.ReactNode;
  href?: string;
  tone?: "default" | "attention";
  icon?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className={cn("text-muted", tone === "attention" && "text-error")}>{icon}</span>}
      </div>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="tabular text-[2rem] leading-none font-medium text-heading">{value}</span>
        {unit && <span className="text-base text-muted">{unit}</span>}
      </p>
      {detail && <p className="mt-2 text-xs text-muted">{detail}</p>}
    </>
  );
  const cls = cn(
    "block rounded-md bg-container p-5 shadow-low transition-shadow",
    tone === "attention" && "shadow-[inset_3px_0_0_var(--ap-error),var(--ap-shadow-low)]",
    href && "hover:shadow-medium",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
