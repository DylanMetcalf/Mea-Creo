import { cn } from "@/components/ui/cn";
import {
  BAND_LABELS,
  INDEX_METHOD,
  NOT_MEASURED_REASONS,
  type VisibilityIndex,
} from "@/modules/audits/visibility-index";
import { IndexRing } from "./index-ring";

const barColour = (score: number) =>
  score >= 75
    ? "bg-[linear-gradient(90deg,#43835f,#7fe0b2)]"
    : score >= 50
      ? "bg-[linear-gradient(90deg,#3b6684,#9db7d3)]"
      : "bg-[linear-gradient(90deg,#a2522e,#e2a05c)]";

/** The Mea Creo Visibility Index with its area breakdown and how it is calculated. */
export function IndexPanel({
  index,
  inverse = false,
  compact = false,
}: {
  index: VisibilityIndex;
  inverse?: boolean;
  compact?: boolean;
}) {
  const areas = [...index.areas].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-8",
        !compact && "md:grid-cols-[auto_1fr] md:items-center",
      )}
    >
      <div className="flex items-center gap-5 md:flex-col md:items-start">
        <IndexRing
          value={index.score}
          size={compact ? 112 : 168}
          stroke={compact ? 9 : 12}
          inverse={inverse}
          label="Mea Creo Visibility Index"
        />
        <div>
          <p className={cn("label-mono", inverse ? "text-signal" : "text-brand-600")}>
            Mea Creo Visibility Index
          </p>
          <p
            className={cn("font-display mt-1.5 text-[1.3rem]", inverse ? "text-white" : "text-ink")}
          >
            {BAND_LABELS[index.band]}
          </p>
          <p className={cn("mt-1 text-xs", inverse ? "text-night-muted" : "text-muted")}>
            {index.measuredAreas} of {index.areas.length} areas measured
          </p>
        </div>
      </div>
      <div className="min-w-0">
        <ul className="space-y-3">
          {areas.map((a) => (
            <li key={a.key}>
              <div
                className={cn(
                  "flex justify-between gap-3 text-sm",
                  inverse ? "text-night-text" : "text-ink-soft",
                )}
              >
                <span className="truncate">{a.label}</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    a.score === null && (inverse ? "text-night-muted" : "text-subtle"),
                  )}
                >
                  {a.score === null ? "Not measured" : a.score}
                </span>
              </div>
              <div
                className={cn(
                  "mt-1.5 h-1.5 overflow-hidden rounded-full",
                  inverse ? "bg-white/10" : "bg-brand-50",
                )}
              >
                {a.score !== null && (
                  <div
                    className={cn("h-full rounded-full", barColour(a.score))}
                    style={{ width: `${Math.max(a.score, 3)}%` }}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
        {index.areas.some((a) => a.score === null) && (
          <details
            className={cn("group mt-5 text-sm", inverse ? "text-night-muted" : "text-muted")}
          >
            <summary
              className={cn(
                "cursor-pointer list-none font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden",
                inverse ? "text-night-text" : "text-ink",
              )}
            >
              Why some areas aren&apos;t measured
            </summary>
            <ul className="mt-2 space-y-2 leading-relaxed">
              {index.areas
                .filter((a) => a.score === null)
                .map((a) => (
                  <li key={a.key}>
                    <span className={inverse ? "text-night-text" : "text-ink"}>{a.label}:</span>{" "}
                    {NOT_MEASURED_REASONS[a.key] ?? "This needs access a public scan doesn't have."}
                  </li>
                ))}
            </ul>
          </details>
        )}
        <details className={cn("group mt-5 text-sm", inverse ? "text-night-muted" : "text-muted")}>
          <summary
            className={cn(
              "cursor-pointer list-none font-medium underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden",
              inverse ? "text-night-text" : "text-ink",
            )}
          >
            How the Index is calculated
          </summary>
          <p className="mt-2 leading-relaxed">{INDEX_METHOD}</p>
        </details>
      </div>
    </div>
  );
}
