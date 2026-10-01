import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";

const rows: {
  label: string;
  status: "strong" | "attention" | "critical" | "unmeasured";
  note: string;
}[] = [
  { label: "Search (SEO)", status: "attention", note: "Headline says little about what you do" },
  {
    label: "AI discoverability",
    status: "critical",
    note: "Business identity isn't machine-readable",
  },
  { label: "Answer readiness", status: "attention", note: "No buyer questions answered" },
  { label: "Technical SEO", status: "strong", note: "Crawlable, sitemap in place" },
  { label: "Conversion", status: "attention", note: "No tap-to-call, little visible proof" },
  { label: "Search performance", status: "unmeasured", note: "Connect Search Console to measure" },
];

const icon = {
  strong: <CheckCircle2 className="text-success-700 size-4" aria-hidden />,
  attention: <AlertTriangle className="text-warning-700 size-4" aria-hidden />,
  critical: <XCircle className="text-danger-700 size-4" aria-hidden />,
  unmeasured: <CircleDashed className="text-subtle size-4" aria-hidden />,
};

/** Illustrative preview of the Visibility Report (labelled as an example). */
export function ReportPreview() {
  return (
    <figure className="relative">
      <div
        aria-hidden
        className="from-brand-100 via-paper to-clay-100 absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br opacity-70 blur-2xl"
      />
      <div className="border-border bg-surface shadow-raised rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-xs font-medium tracking-wide uppercase">
              Visibility Report
            </p>
            <p className="text-ink mt-0.5 font-semibold">yourcompany.co.za</p>
          </div>
          <span className="bg-brand-50 text-brand-800 rounded-full px-2.5 py-1 text-xs font-medium">
            Example
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["9", "Strengths", "text-success-700"],
            ["14", "To improve", "text-warning-700"],
            ["3", "Critical", "text-danger-700"],
          ].map(([n, label, color]) => (
            <div key={label} className="bg-surface-2 rounded-lg px-2 py-2.5">
              <div className={`text-xl font-semibold tabular-nums ${color}`}>{n}</div>
              <div className="text-muted text-[0.7rem]">{label}</div>
            </div>
          ))}
        </div>
        <ul className="divide-border mt-4 divide-y">
          {rows.map((row) => (
            <li key={row.label} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5">{icon[row.status]}</span>
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium">{row.label}</p>
                <p className="text-muted truncate text-xs">{row.note}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-brand-100 bg-brand-50 text-brand-900 mt-3 rounded-lg border px-3 py-2.5 text-xs">
          <span className="font-semibold">Biggest opportunity:</span> describe your business with
          structured data so search and AI systems understand who you are.
        </div>
      </div>
      <figcaption className="sr-only">
        An example of the Visibility Report showing strengths, improvements and the biggest
        opportunity.
      </figcaption>
    </figure>
  );
}
