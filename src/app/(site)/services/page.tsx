import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CalendarClock,
  Compass,
  Cpu,
  type LucideIcon,
  MessageCircleQuestion,
  Package,
  Search,
  TrendingUp,
} from "lucide-react";
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
  title: "Services: SEO, content, websites, apps and AI",
  description:
    "SEO, GEO, AEO, lead generation, conversion, websites, AI systems and automation, content, consulting and quality assurance for B2B and technical businesses.",
  alternates: { canonical: "/services" },
};

const PILLAR_ICONS: Record<(typeof PILLARS)[number]["slug"], LucideIcon> = {
  visibility: Search,
  growth: TrendingUp,
  technology: Cpu,
  content: Camera,
  consulting: Compass,
  "quality-assurance": BadgeCheck,
};

/** Contact-form interest preselected from each area's "Ask a question" link. */
const PILLAR_INTENT: Record<(typeof PILLARS)[number]["slug"], string> = {
  visibility: "seo-aeo-geo",
  growth: "leads",
  technology: "websites",
  content: "photo-video",
  consulting: "other",
  "quality-assurance": "other",
};

const WAYS = [
  {
    icon: CalendarClock,
    title: "Ongoing, every month",
    body: "A monthly programme that keeps you visible and brings in enquiries, with reporting you can actually read.",
    cta: "See monthly programmes",
    href: "/pricing#monthly",
  },
  {
    icon: Package,
    title: "One project, done well",
    body: "A shoot, a website, an audit or an automation: a fixed quote and a clear scope, no retainer.",
    cta: "See once-off projects",
    href: "/pricing#projects",
  },
  {
    icon: MessageCircleQuestion,
    title: "Not sure yet",
    body: "Start with a free Visibility Report of your website, or tell us what's going on and we'll suggest where to begin.",
    cta: "Get a free Visibility Report",
    href: "/visibility-report",
  },
] as const;

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
      {/* Three ways in: the visitor picks how they want to work before reading service detail. */}
      <Section className="pt-4 sm:pt-6">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {WAYS.map((w) => (
            <li key={w.title}>
              <Link
                href={w.href}
                className="group border-border bg-surface hover:border-brand-400 flex h-full flex-col rounded-2xl border p-6 transition-colors"
              >
                <w.icon className="text-brand-600 size-5" aria-hidden />
                <h2 className="font-display mt-4 text-xl">{w.title}</h2>
                <p className="text-muted mt-2 flex-1 text-sm leading-relaxed">{w.body}</p>
                <span className="text-brand-700 mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  {w.cta}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <nav aria-label="Service areas" className="mt-10 flex flex-wrap items-center gap-2 text-sm">
          <span className="label-mono text-muted mr-2">Jump to</span>
          {PILLARS.map((p) => (
            <a
              key={p.slug}
              href={`#${p.slug}`}
              className="border-border hover:border-brand-400 rounded-full border px-3 py-1.5"
            >
              {p.name}
            </a>
          ))}
        </nav>
      </Section>

      {PILLARS.map((pillar, index) => {
        const Icon = PILLAR_ICONS[pillar.slug];
        const lead = index === 0;
        const flip = index % 2 === 1;
        return (
          <Section
            key={pillar.slug}
            id={pillar.slug}
            tone={lead ? "night" : index % 2 === 0 ? "surface" : "paper"}
            className="scroll-mt-20"
          >
            <div
              className={`grid grid-cols-1 gap-10 lg:gap-16 ${flip ? "lg:grid-cols-[1.2fr_1fr]" : "lg:grid-cols-[1fr_1.2fr]"}`}
            >
              <div className={`lg:sticky lg:top-24 lg:self-start ${flip ? "lg:order-2" : ""}`}>
                <span
                  className={`flex size-11 items-center justify-center rounded-xl ${lead ? "text-signal bg-white/10" : "bg-brand-50 text-brand-700"}`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className={`label-mono mt-5 ${lead ? "text-signal" : "text-brand-700"}`}>
                  {pillar.tagline}
                  {lead && " · where most clients start"}
                </p>
                <h2
                  className={`font-display mt-2 text-3xl sm:text-4xl ${lead ? "text-white" : ""}`}
                >
                  {pillar.name}
                </h2>
                <p className={`mt-3 text-lg ${lead ? "text-night-text/85" : "text-muted"}`}>
                  {pillar.intro}
                </p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                  <Link
                    href={`/services/${pillar.slug}`}
                    className={`inline-flex items-center gap-1 ${lead ? "text-white" : "text-brand-700"} hover:underline`}
                  >
                    How {pillar.name.toLowerCase()} works{" "}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link
                    href={`/contact?service=${PILLAR_INTENT[pillar.slug]}`}
                    className={`${lead ? "text-night-muted hover:text-white" : "text-muted hover:text-ink"}`}
                  >
                    Ask a question
                  </Link>
                </div>
              </div>
              {lead || flip ? (
                <ul
                  className={`divide-y border-y ${lead ? "divide-white/10 border-white/10" : "divide-[var(--color-border)] border-[var(--color-border)]"}`}
                >
                  {pillar.services.map((service) => (
                    <li
                      key={service.name}
                      className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6"
                    >
                      <h3 className={`font-semibold ${lead ? "text-white" : ""}`}>
                        {service.name}
                      </h3>
                      <p
                        className={`text-sm leading-relaxed ${lead ? "text-night-muted" : "text-muted"}`}
                      >
                        {service.description}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {pillar.services.map((service) => (
                    <div
                      key={service.name}
                      className="rounded-card border-border bg-paper border p-5"
                    >
                      <h3 className="font-semibold">{service.name}</h3>
                      <p className="text-muted mt-1.5 text-sm">{service.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        );
      })}
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
