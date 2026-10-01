import type { ProspectBrief } from "@/db/schema";
import { fmtDateTime, fmtMoney } from "@/lib/format";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="text-ink-soft mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/** The prospect intelligence brief (handoff §23), built from evidence on record. */
export function ProspectBriefView({ brief }: { brief: ProspectBrief }) {
  const pkg = [brief.likelyPackage.entry, brief.likelyPackage.ongoing].filter(Boolean).join(" → ");
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
        {(
          [
            ["Company", brief.company],
            ["Industry", brief.industry],
            ["Size", brief.size],
            ["Location", brief.location],
            ["Website", brief.website],
            ["Current visibility", brief.currentVisibility],
            ["Likely problem", brief.likelyBusinessProblem],
            ["Why contact them", brief.whyContact],
            [
              "Likely package",
              pkg ? `${pkg}. ${brief.likelyPackage.reason}` : brief.likelyPackage.reason,
            ],
            [
              "Estimated value",
              brief.estimatedMonthlyMinor ? `${fmtMoney(brief.estimatedMonthlyMinor)}/month` : null,
            ],
            ["Confidence", brief.confidence],
          ] as [string, string | null | undefined][]
        ).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{v || <span className="text-subtle">Not known</span>}</dd>
          </div>
        ))}
      </dl>
      <Section title="Decision makers" items={brief.decisionMakers} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="SEO opportunities" items={brief.seoOpportunities} />
        <Section title="AI search (GEO) opportunities" items={brief.geoOpportunities} />
        <Section title="Answer (AEO) opportunities" items={brief.aeoOpportunities} />
        <Section title="Content opportunities" items={brief.contentOpportunities} />
        <Section title="Lead generation opportunities" items={brief.leadGenerationOpportunities} />
        <Section title="Automation opportunities" items={brief.automationOpportunities} />
      </div>
      <Section title="Competitor observations" items={brief.competitorObservations} />
      <p className="text-subtle text-xs">
        Built {fmtDateTime(new Date(brief.generatedAt))} from:{" "}
        {brief.sources.length ? brief.sources.join(", ") : "the details on record only"}. Nothing
        here is guessed; gaps mean we don&apos;t know yet.
      </p>
    </div>
  );
}
