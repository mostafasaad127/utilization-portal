import { band } from "@/lib/domain/utilization";
import { BAND_COLOR, BAND_LABEL } from "@/components/ui/util-bar";
import { cn } from "@/lib/utils";

/**
 * One cell of the utilization heatmap. The value is always printed in the
 * cell, so the colour scale is reinforcement rather than the only channel.
 */
export function HeatCell({ value, tentative = 0, label }: { value: number; tentative?: number; label: string }) {
  const b = band(value);
  const dark = b === "full" || b === "over";
  return (
    <div
      className={cn(
        "tabular relative flex h-9 items-center justify-center rounded-xs text-xs",
        dark ? "font-medium text-white" : "text-heading",
        b === "bench" && "text-muted",
      )}
      style={{ background: BAND_COLOR[b] }}
      title={`${label}: ${value}% confirmed${tentative ? `, +${tentative}% pipeline` : ""} (${BAND_LABEL[b]})`}
    >
      {value}%
      {tentative > 0 && (
        <span
          className="absolute top-1 right-1 size-1.5 rounded-full bg-info ring-1 ring-container"
          aria-label={`plus ${tentative}% pipeline`}
        />
      )}
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {(["bench", "under", "healthy", "full", "over"] as const).map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-xs" style={{ background: BAND_COLOR[b] }} aria-hidden />
          {BAND_LABEL[b]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-info" aria-hidden /> Has pipeline work
      </span>
    </div>
  );
}
