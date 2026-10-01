import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReportContent, ReportMetric } from "@/db/schema";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";

function Metrics({ items }: { items: ReportMetric[] }) {
  if (!items.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((m) => {
        const Icon =
          m.trend === "up" ? ArrowUpRight : m.trend === "down" ? ArrowDownRight : ArrowRight;
        return (
          <div key={m.label} className="border-border rounded-lg border p-3">
            <dt className="text-muted text-xs">{m.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{m.value}</dd>
            {m.change && (
              <dd className="text-ink-soft mt-0.5 flex items-center gap-1 text-xs">
                <Icon className="size-3.5" aria-hidden /> {m.change}
              </dd>
            )}
            {(m.source || m.note) && (
              <dd className="text-subtle mt-1 text-[0.7rem]">
                {[m.source, m.note].filter(Boolean).join(" · ")}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function Section({
  title,
  items,
  children,
}: {
  title: string;
  items: string[];
  children?: React.ReactNode;
}) {
  if (!items.length && !children) return null;
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="space-y-4">
        {children}
        {items.length > 0 && (
          <ul className="text-ink-soft list-disc space-y-1.5 pl-5 text-sm">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/** Report narrative: activity is kept separate from outcomes, and every number names its source. */
export function ReportBody({ content }: { content: ReportContent }) {
  return (
    <div className="space-y-6">
      <p className="font-display text-ink max-w-3xl text-xl leading-relaxed">{content.headline}</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="What we did" items={content.whatWeDid}>
          <Metrics items={content.activityMetrics} />
        </Section>
        <Section title="What changed" items={content.whatChanged}>
          <Metrics items={content.outcomeMetrics} />
        </Section>
        <Section title="What we learned" items={content.whatWeLearned} />
        <Section title="Opportunities" items={content.opportunities} />
        <Section title="What happens next" items={content.whatHappensNext} />
        <Section title="What we need from you" items={content.needsFromYou} />
      </div>
      {content.dataNotes.length > 0 && (
        <div className="rounded-card bg-surface-2 text-muted p-4 text-xs">
          <p className="text-ink-soft mb-1 font-medium">About the data</p>
          {content.dataNotes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}
