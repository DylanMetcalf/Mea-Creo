import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import type {
  AuditCategory,
  AuditFinding,
  AuditResult,
  CategoryStatus,
  FindingStatus,
} from "@/modules/audits/types";

const CATEGORY_STATUS: Record<CategoryStatus, { label: string; tone: Tone }> = {
  strong: { label: "Strong", tone: "success" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
  not_measured: { label: "Not measured", tone: "neutral" },
};

const FINDING_ICON: Record<
  FindingStatus,
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  pass: { icon: CheckCircle2, className: "text-success-700", label: "Good" },
  warn: { icon: AlertTriangle, className: "text-warning-700", label: "Improve" },
  fail: { icon: XCircle, className: "text-danger-700", label: "Fix" },
  info: { icon: Info, className: "text-info-700", label: "Note" },
  not_measured: { icon: CircleDashed, className: "text-subtle", label: "Not measured" },
};

const IMPACT_TONE: Record<string, Tone> = { high: "clay", medium: "warning", low: "neutral" };

function FindingRow({ finding }: { finding: AuditFinding }) {
  const { icon: Icon, className, label } = FINDING_ICON[finding.status];
  const isIssue = finding.status === "warn" || finding.status === "fail";
  return (
    <details
      className="group border-border/70 border-t py-3.5 first:border-0"
      open={finding.status === "fail"}
    >
      <summary className="hover:text-brand-700 flex cursor-pointer list-none items-start gap-3 transition-colors [&::-webkit-details-marker]:hidden">
        <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} />
        <span className="text-ink flex-1 text-sm font-medium">{finding.title}</span>
        {isIssue && <Badge tone={IMPACT_TONE[finding.impact]}>{finding.impact} impact</Badge>}
      </summary>
      <dl className="bg-surface-2 mt-3 ml-7 grid grid-cols-1 gap-4 rounded-xl p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="label-mono text-muted">What&apos;s happening</dt>
          <dd className="text-ink-soft mt-1.5 leading-relaxed">{finding.whatIsHappening}</dd>
        </div>
        <div>
          <dt className="label-mono text-muted">Why it matters</dt>
          <dd className="text-ink-soft mt-1.5 leading-relaxed">{finding.whyItMatters}</dd>
        </div>
        <div>
          <dt className="label-mono text-brand-600">What to do</dt>
          <dd className="text-ink mt-1.5 leading-relaxed">{finding.whatToDo}</dd>
        </div>
      </dl>
    </details>
  );
}

function CategoryCard({ category }: { category: AuditCategory }) {
  const status = CATEGORY_STATUS[category.status];
  const sorted = [...category.findings].sort((a, b) => order(a.status) - order(b.status));
  return (
    <section
      className="rounded-card border-border/80 bg-surface shadow-card border p-5 sm:p-6"
      aria-labelledby={`cat-${category.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`cat-${category.key}`} className="font-display text-ink text-[1.15rem]">
            {category.label}
          </h3>
          <p className="text-muted mt-0.5 text-sm">{category.summary}</p>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      <div className="mt-3">
        {sorted.map((finding) => (
          <FindingRow key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}

function order(status: FindingStatus): number {
  return { fail: 0, warn: 1, not_measured: 2, info: 3, pass: 4 }[status];
}

export function ReportSummary({ result }: { result: AuditResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        [result.counts.strengths, "Strengths", "text-success-700"],
        [result.counts.improvements, "To improve", "text-warning-700"],
        [result.counts.critical, "Critical", "text-danger-700"],
        [result.counts.notMeasured, "Not yet measured", "text-muted"],
      ].map(([value, label, color]) => (
        <div
          key={label as string}
          className="rounded-card border-border/80 bg-surface shadow-card border px-4 py-3.5"
        >
          <div
            className={cn("font-display text-[1.8rem] leading-none tabular-nums", color as string)}
          >
            {value}
          </div>
          <div className="text-muted mt-1.5 text-xs">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function ReportView({
  result,
  showSignals = false,
}: {
  result: AuditResult;
  showSignals?: boolean;
}) {
  return (
    <div className="space-y-10">
      <ReportSummary result={result} />

      {result.opportunities.length > 0 && (
        <section aria-labelledby="opportunities">
          <h2 id="opportunities" className="font-display text-ink text-2xl sm:text-3xl">
            Your biggest opportunities
          </h2>
          <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {result.opportunities.map((o, i) => (
              <li
                key={o.title}
                className={cn(
                  "rounded-card shadow-card hover:shadow-raised flex gap-4 border p-5 transition-shadow",
                  i === 0
                    ? "border-brand-300 bg-brand-50/60 md:col-span-2"
                    : "border-border/80 bg-surface",
                )}
              >
                <span className="bg-signal flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  {i === 0 && <p className="label-mono text-brand-600 mb-1">Start here</p>}
                  <p className="text-ink font-semibold">{o.title}</p>
                  <p className="text-muted mt-1 text-sm">{o.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={IMPACT_TONE[o.impact]}>{o.impact} impact</Badge>
                    <Badge>{o.effort} effort</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="categories">
        <h2 id="categories" className="font-display text-ink text-2xl sm:text-3xl">
          Findings by area
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {result.categories.map((category) => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>
      </section>

      {result.competitors.length > 0 && (
        <section aria-labelledby="competitors">
          <h2 id="competitors" className="font-display text-ink text-2xl">
            What competitors are doing that you could consider
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.competitors.map((c) => (
              <div key={c.url} className="rounded-card border-border bg-surface border p-4">
                <p className="font-medium">{c.name}</p>
                <ul className="text-ink-soft mt-2 list-disc space-y-1 pl-5 text-sm">
                  {c.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {c.considerations.length > 0 && (
                  <p className="text-muted mt-2 text-sm">
                    Consider: {c.considerations.join("; ")}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showSignals && (
        <details className="rounded-card border-border bg-surface border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Raw signals (internal)</summary>
          <pre className="bg-surface-2 mt-3 max-h-96 overflow-auto rounded p-3 text-xs">
            {JSON.stringify(result.signals, null, 2)}
          </pre>
        </details>
      )}

      <section className="rounded-card bg-surface-2 text-muted p-5 text-sm">
        <p className="text-ink font-medium">About this report</p>
        <p className="mt-2">
          This report reads only what any visitor or search engine can see on your website. Items
          marked &ldquo;not measured&rdquo; need data that isn&apos;t public, such as Google Search
          Console, your Google Business Profile, analytics or social accounts. With your permission
          we connect those and measure them properly.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {result.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2">
          Checked{" "}
          {new Date(result.fetchedAt).toLocaleString("en-ZA", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · {result.signals.pagesAnalysed.length} page(s) analysed.
        </p>
      </section>
    </div>
  );
}
