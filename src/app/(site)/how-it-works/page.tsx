import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import {
  CheckList,
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  Section,
  SectionIntro,
} from "@/components/site/marketing";
import { HOW_IT_WORKS } from "@/content/pillars";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Mea Creo works: discover, audit, strategise, implement, measure and improve, with your approval where it matters.",
  alternates: { canonical: "/how-it-works" },
};

const APPROVALS = [
  [
    "Automatic",
    "Routine, low-risk work: monitoring, internal checks, organising tasks. Logged so you can see it.",
  ],
  [
    "Your approval",
    "Anything that speaks for your business: content, outreach, campaign changes, reports. Nothing goes out until you approve it in your portal.",
  ],
  [
    "Mea Creo review",
    "Every agent's output is checked by a person at Mea Creo before it reaches you.",
  ],
  ["Manual", "Payments, contracts, budgets and anything irreversible are always done by a person."],
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden pt-14 pb-10 sm:pt-20">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
        />
        <Container>
          <Eyebrow>How it works</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            A visibility system, not a one-off project.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Specialised software does the repetitive analysis and preparation. People decide what
            matters, check the work, and stay accountable for it.
          </p>
        </Container>
      </section>
      <Section tone="surface">
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.name} className="rounded-card border-border bg-paper border p-6">
              <span className="font-display text-brand-600 text-3xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-3 text-xl font-semibold">{step.name}</h2>
              <p className="text-muted mt-2">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionIntro eyebrow="Approvals" title="You stay in control.">
            Every action has an approval level. You can see what happened, what&apos;s waiting for
            you, and why.
          </SectionIntro>
          <dl className="space-y-4">
            {APPROVALS.map(([title, body]) => (
              <div key={title} className="rounded-card border-border bg-surface border p-5">
                <dt className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="text-brand-600 size-5" aria-hidden /> {title}
                </dt>
                <dd className="text-muted mt-1">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>
      <Section tone="surface">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <SectionIntro eyebrow="Your client portal" title="Everything in one place.">
            No chasing email threads for status updates.
          </SectionIntro>
          <CheckList
            items={[
              "What we're working on, and what we need from you",
              "Approvals for content, outreach and changes",
              "Monthly reports: what we did, what changed, what we learned, what's next",
              "Your files, meetings, invoices and messages",
              "Ask Mea Creo: quick answers about your own account",
            ]}
          />
        </div>
      </Section>
      <Section>
        <div className="max-w-3xl">
          <SectionIntro eyebrow="Honesty" title="What we won't promise." />
          <p className="text-muted mt-4 text-lg">
            Nobody can guarantee rankings, AI mentions, traffic or leads. Search engines and AI
            assistants make their own decisions. What we commit to is the work, the reporting, and
            honest advice about what is and isn&apos;t working.
          </p>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
