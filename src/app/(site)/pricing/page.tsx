import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCards } from "@/components/site/package-cards";
import {
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  FaqList,
  Section,
} from "@/components/site/marketing";
import { getDb } from "@/db";
import { getPlatformSetting } from "@/modules/settings/service";
import {
  formatRand,
  getPublicPackages,
  getPublicProjects,
  PROJECT_GROUPS,
} from "@/modules/website/packages";

export const metadata: Metadata = {
  title: "Pricing: visibility and growth packages",
  description:
    "Mea Creo packages: Foundation (once-off), Visibility, Growth and Scale monthly programmes, and custom quotations for complex requirements.",
  alternates: { canonical: "/pricing" },
};
export const dynamic = "force-dynamic";

const FAQ = [
  {
    question: "Where should we start?",
    answer:
      "Most businesses start with a Foundation: a full assessment and roadmap, so any monthly programme is built on what your business actually needs rather than guesswork.",
  },
  {
    question: "Do the prices include VAT?",
    answer:
      "Mea Creo is not VAT registered, so no VAT is added. The price shown is the price you pay.",
  },
  {
    question: "Can I hire you for a single project?",
    answer:
      "Yes. Photography, video, websites, audits and automation are all available as once-off projects with a fixed quote. You don't need a monthly programme.",
  },
  {
    question: "Can a package be adjusted?",
    answer:
      "Yes. Packages describe the typical scope. Your proposal sets out exactly what's included for your business, and larger or more complex work is quoted as Custom.",
  },
  {
    question: "Do you guarantee results?",
    answer:
      "No one can honestly guarantee rankings, AI mentions or leads. We commit to the work, transparent reporting and honest advice about what is and isn't working.",
  },
];

export default async function PricingPage() {
  const db = await getDb();
  const [packages, billing, projects] = await Promise.all([
    getPublicPackages(db),
    getPlatformSetting(db, "billing"),
    getPublicProjects(db),
  ]);
  if (!packages) notFound();
  return (
    <>
      <section className="relative isolate overflow-hidden pt-14 pb-6 sm:pt-20">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
        />
        <Container>
          <Eyebrow>Pricing</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Priced for the problem being solved, not the hours on a timesheet.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Every programme is scoped in a proposal after a strategy conversation, so you know
            exactly what you&apos;re getting before you commit.
          </p>
          <nav aria-label="Ways to buy" className="mt-7 flex flex-wrap gap-2 text-sm">
            {[
              ["#monthly", "Monthly programmes"],
              ["#projects", "Once-off projects"],
              ["/contact?service=other", "Something custom"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="border-border bg-surface hover:border-brand-400 rounded-full border px-4 py-2 font-medium"
              >
                {label}
              </a>
            ))}
          </nav>
        </Container>
      </section>
      <Section id="monthly" className="scroll-mt-24 pt-6 sm:pt-8">
        <PackageCards packages={packages} />
        <div className="border-border/80 bg-surface shadow-card mt-6 flex flex-col gap-2 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-soft">
            <span className="text-ink font-semibold">Terms:</span> monthly programmes run for a{" "}
            {billing.standardTermMonths}-month minimum, then month to month.
          </p>
          {billing.annualDiscountPercent > 0 && (
            <p className="bg-brand-50 text-brand-800 ring-brand-100 rounded-full px-3 py-1 text-sm font-medium ring-1">
              Commit to 12 months and save {billing.annualDiscountPercent}% on monthly fees
            </p>
          )}
        </div>
      </Section>
      {projects && projects.length > 0 && (
        <Section id="projects" tone="surface" className="scroll-mt-24">
          <div className="max-w-2xl">
            <Eyebrow>Once-off projects</Eyebrow>
            <DisplayHeading className="mt-3">
              Just need one thing done? That works too.
            </DisplayHeading>
            <p className="text-muted mt-4 text-lg">
              No retainer needed. Tell us what you need and we&apos;ll send a fixed quote with the
              scope, timeline and what we&apos;ll need from you, before any work starts.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-2">
            {PROJECT_GROUPS.map((group) => {
              const items = projects.filter((p) => p.group === group.key);
              if (items.length === 0) return null;
              return (
                <div key={group.key}>
                  <h3 className="font-display text-ink text-xl">{group.label}</h3>
                  <ul className="border-border mt-4 divide-y divide-[var(--color-border)] border-y">
                    {items.map((p) => (
                      <li key={p.slug} className="flex items-start justify-between gap-6 py-3.5">
                        <div className="min-w-0">
                          <p className="font-medium">{p.name}</p>
                          {p.summary && <p className="text-muted mt-0.5 text-sm">{p.summary}</p>}
                        </div>
                        <p className="text-ink-soft shrink-0 text-sm whitespace-nowrap">
                          {p.priceMinor ? `from ${formatRand(p.priceMinor)}` : "Quoted"}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`/contact?service=${group.intent}`}
                    className="text-brand-700 mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  >
                    Ask for a quote →
                  </a>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr]">
          <DisplayHeading>Questions about pricing</DisplayHeading>
          <FaqList items={FAQ} />
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
