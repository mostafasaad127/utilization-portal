"use client";

import { useState } from "react";
import { formatMonth } from "@/lib/utils";

type Point = { month: string; confirmed: number; tentative: number };

/**
 * Average team utilization per fiscal month. Columns: confirmed work in the
 * primary hue, pipeline work stacked on top as a hatched texture (separated
 * by a 2px surface gap). Single y-axis, 0–100%+, hover tooltip per column,
 * plus a visually hidden table for screen readers.
 */
export function MonthlyUtilizationChart({ data, currentIndex }: { data: Point[]; currentIndex: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(100, ...data.map((d) => d.confirmed + d.tentative));
  const top = Math.ceil(max / 25) * 25;
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25);

  const W = 720;
  const H = 240;
  const pad = { l: 40, r: 8, t: 12, b: 28 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.5);
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;

  const active = hover ?? null;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-5 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-xs bg-primary" aria-hidden /> Confirmed
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2.5 rounded-xs"
            style={{ background: "repeating-linear-gradient(135deg, var(--util-healthy) 0 2px, transparent 2px 4px)" }}
            aria-hidden
          />
          Pipeline (tentative)
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Average team utilization by month">
        <defs>
          <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--ap-primary-tint)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--util-healthy)" strokeWidth="2" />
          </pattern>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--ap-border-light)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ap-text-light)">
              {t}%
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const x = cx - barW / 2;
          const confirmedTop = y(d.confirmed);
          const tentativeH = (d.tentative / top) * plotH;
          const isCurrent = i === currentIndex;
          const dim = active !== null && active !== i;
          return (
            <g key={d.month} opacity={dim ? 0.45 : 1} style={{ transition: "opacity 120ms" }}>
              {d.confirmed > 0 && (
                <path d={roundedTop(x, confirmedTop, barW, y(0) - confirmedTop, d.tentative > 0 ? 0 : 4)} fill="var(--ap-primary)" />
              )}
              {d.tentative > 0 && (
                <path
                  d={roundedTop(x, confirmedTop - tentativeH - (d.confirmed > 0 ? 2 : 0), barW, tentativeH, 4)}
                  fill="url(#hatch)"
                />
              )}
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize="11"
                fill={isCurrent ? "var(--ap-text-heading)" : "var(--ap-text-light)"}
                fontWeight={isCurrent ? 600 : 400}
              >
                {formatMonth(new Date(d.month))}
              </text>
              {isCurrent && <circle cx={cx} cy={H - 22} r="2" fill="var(--ap-primary)" />}
              {/* Hit target larger than the mark */}
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${formatMonth(new Date(d.month))}: ${d.confirmed}% confirmed, ${d.tentative}% pipeline`}
              />
            </g>
          );
        })}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-container px-3 py-2 text-xs shadow-high"
          style={{
            left: `${((pad.l + band * active + band / 2) / W) * 100}%`,
            top: 24,
            transform: active > data.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="mb-1 font-medium text-heading">{formatMonth(new Date(data[active].month))}</p>
          <p className="tabular text-body">Confirmed: {data[active].confirmed}%</p>
          <p className="tabular text-body">Pipeline: +{data[active].tentative}%</p>
        </div>
      )}

      <table className="sr-only">
        <caption>Average team utilization by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Confirmed %</th>
            <th>Pipeline %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{formatMonth(new Date(d.month))}</td>
              <td>{d.confirmed}</td>
              <td>{d.tentative}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rect path with only the top corners rounded (square at the baseline). */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
