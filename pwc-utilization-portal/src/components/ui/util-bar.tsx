import { band, type UtilizationBand } from "@/lib/domain/utilization";
import { cn } from "@/lib/utils";

export const BAND_LABEL: Record<UtilizationBand, string> = {
  bench: "On bench",
  under: "Under-utilized",
  healthy: "Healthy",
  full: "Fully booked",
  over: "Over-allocated",
};

export const BAND_COLOR: Record<UtilizationBand, string> = {
  bench: "var(--util-bench)",
  under: "var(--util-under)",
  healthy: "var(--util-healthy)",
  full: "var(--util-full)",
  over: "var(--util-over)",
};

/** Horizontal utilization meter with the % as text, so value never depends on colour. */
export function UtilBar({ value, tentative = 0, className }: { value: number; tentative?: number; className?: string }) {
  const b = band(value);
  const width = Math.min(value, 100);
  const tentativeWidth = Math.max(0, Math.min(value + tentative, 100) - width);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-container-alt"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Utilization ${value}%`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, background: BAND_COLOR[b] }} />
        {tentativeWidth > 0 && (
          <div
            className="absolute inset-y-0 rounded-full opacity-60"
            style={{
              left: `${width}%`,
              width: `${tentativeWidth}%`,
              background: "repeating-linear-gradient(135deg, var(--util-healthy) 0 3px, transparent 3px 6px)",
            }}
          />
        )}
      </div>
      <span className={cn("tabular w-11 text-right text-sm", b === "over" ? "font-medium text-error" : "text-heading")}>
        {value}%
      </span>
    </div>
  );
}
