import type { LeadScore } from "@/db/schema";
import { Badge } from "@/components/ui/primitives";

const LABELS: [keyof Omit<LeadScore, "scoredAt">, string][] = [
  ["fit", "Fit"],
  ["visibilityOpportunity", "Visibility opportunity"],
  ["commercialPotential", "Commercial potential"],
  ["digitalMaturity", "Digital maturity"],
  ["serviceMatch", "Service match"],
  ["confidence", "Confidence"],
];

/** Qualification shown as explained dimensions, each with its reasons. */
export function ScoreDimensions({ score }: { score: LeadScore }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {LABELS.map(([key, label]) => {
        const dim = score[key];
        return (
          <div key={key} className="border-border rounded-lg border p-3">
            <dt className="flex items-center justify-between gap-2 text-sm font-medium">
              {label}
              <Badge
                tone={
                  dim.level === "high" ? "success" : dim.level === "medium" ? "warning" : "neutral"
                }
              >
                {dim.level}
              </Badge>
            </dt>
            <dd className="text-ink-soft mt-1.5 space-y-1 text-xs">
              {dim.reasons.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
