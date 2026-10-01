import Link from "next/link";
import { cn } from "./cn";

export interface BarDatum {
  label: string;
  value: number;
  display: string;
  href?: string;
  detail?: string;
}

/**
 * Single-series horizontal bars (magnitude). One hue, no legend (the heading names the
 * series), thin bars with a rounded data-end, values in ink at the tip, hover detail.
 * Every value is also present as text, so the chart doubles as its own table view.
 */
export function BarList({
  data,
  emptyText = "No data yet.",
  ariaLabel,
}: {
  data: BarDatum[];
  emptyText?: string;
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (data.length === 0 || max === 0) return <p className="text-muted py-4 text-sm">{emptyText}</p>;
  return (
    <ul className="space-y-2.5" aria-label={ariaLabel}>
      {data.map((d) => {
        const width = Math.max(2, (d.value / max) * 100);
        const row = (
          <div
            className="group grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]"
            title={d.detail ?? `${d.label}: ${d.display}`}
          >
            <span className="text-ink-soft truncate text-sm">{d.label}</span>
            <span className="flex items-center gap-2">
              <span className="relative h-2.5 flex-1 rounded-r-[4px] bg-transparent">
                <span
                  className="bg-brand-600 group-hover:bg-brand-800 absolute inset-y-0 left-0 rounded-r-[4px] transition-colors"
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="text-ink w-24 shrink-0 text-right text-sm font-medium tabular-nums">
                {d.display}
              </span>
            </span>
          </div>
        );
        return (
          <li key={d.label}>
            {d.href ? (
              <Link href={d.href} className="hover:bg-surface-2 block rounded-md">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A tiny trend line for stat tiles. Single series, 2px line, end dot, no axes. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / span) * (h - 8)] as const,
  );
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-24", className)} aria-hidden>
      <polyline
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--brand-600)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={4}
        fill="var(--brand-600)"
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
