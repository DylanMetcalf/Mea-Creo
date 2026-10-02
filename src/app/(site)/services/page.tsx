import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckList,
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  Section,
} from "@/components/site/marketing";
import { PILLARS } from "@/content/pillars";
import { SERVICE_CATALOGUE } from "@/modules/services/catalogue";

export const metadata: Metadata = {
  title: "Services: Visibility, Growth, Technology, Content, Consulting & QA",
  description:
    "SEO, GEO, AEO, lead generation, conversion, websites, AI systems and automation, content, consulting and quality assurance for B2B and technical businesses.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden pt-14 pb-10 sm:pt-20">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
        />
        <Container>
          <Eyebrow>Services</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Everything it takes to be found, chosen and grow, in one connected system.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Most clients start with visibility. Growth, technology, content and consulting are added
            when they&apos;ll make a measurable difference, not as a bundle for its own sake.
          </p>
        </Container>
      </section>
      {PILLARS.map((pillar, index) => (
        <Section key={pillar.slug} tone={index % 2 === 0 ? "surface" : "paper"}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>
                {String(index + 1).padStart(2, "0")} · {pillar.tagline}
              </Eyebrow>
              <h2 className="font-display mt-3 text-3xl sm:text-4xl">{pillar.name}</h2>
              <p className="text-muted mt-3 text-lg">{pillar.intro}</p>
              <Link
                href={`/services/${pillar.slug}`}
                className="text-brand-700 hover:text-brand-900 mt-6 inline-flex items-center gap-1 font-medium"
              >
                Explore {pillar.name.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {pillar.services.map((service) => (
                <div key={service.name} className="rounded-card border-border bg-paper border p-5">
                  <h3 className="font-semibold">{service.name}</h3>
                  <p className="text-muted mt-1.5 text-sm">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ))}
      <Section>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <DisplayHeading>How engagements work</DisplayHeading>
            <p className="text-muted mt-4">
              Most clients work with us on a monthly retainer after a short setup phase. Creative
              and build work is also available as one-off projects.
            </p>
          </div>
          <CheckList
            items={[
              "Start with a free Visibility Report and a strategy call",
              "Receive a clear proposal: problems, goals, activities, KPIs and pricing",
              "Onboard in your own client workspace",
              "Monthly work, approvals and plain-language reporting",
              "Add or change services as your needs evolve",
            ]}
          />
        </div>
      </Section>
      <Section tone="surface">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow>Productised audits</Eyebrow>
            <h2 className="font-display mt-3 text-3xl sm:text-4xl">
              Focused assessments with clear answers.
            </h2>
            <p className="text-muted mt-3 text-lg">
              Repeatable, structured audits for a specific question. Each ends with prioritised,
              practical recommendations.
            </p>
            <Link
              href="/book"
              className="text-brand-700 hover:text-brand-900 mt-6 inline-flex items-center gap-1 font-medium"
            >
              Ask about an audit <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SERVICE_CATALOGUE.filter((s) => s.category === "audit").map((a) => (
              <div key={a.slug} className="rounded-card border-border bg-paper border p-5">
                <h3 className="font-semibold">{a.name}</h3>
                <p className="text-muted mt-1.5 text-sm">{a.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
