import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Brain,
  Camera,
  Compass,
  Cpu,
  Eye,
  HeartHandshake,
  LineChart,
  MessagesSquare,
  Palette,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PackageCards } from "@/components/site/package-cards";
import { CtaBand, Container, Eyebrow, Section, SectionIntro } from "@/components/site/marketing";
import { ReportPreview } from "@/components/site/report-preview";
import { LinkButton } from "@/components/ui/button";
import { HOW_IT_WORKS } from "@/content/pillars";
import { getDb } from "@/db";
import { getPublicPackages } from "@/modules/website/packages";

export const metadata: Metadata = {
  title: { absolute: "Mea Creo | Visibility, Growth & Automation" },
  description:
    "Mea Creo helps businesses become easier to find, easier to understand and easier to choose, through SEO, GEO and AEO, lead generation, content and automation.",
  alternates: { canonical: "/" },
};
export const dynamic = "force-dynamic";

const areas = [
  {
    href: "/services/visibility",
    icon: Search,
    name: "Visibility",
    body: "SEO, GEO and AEO, so you're found on Google and understood by AI search.",
    primary: true,
  },
  {
    href: "/services/growth",
    icon: TrendingUp,
    name: "Growth",
    body: "Lead generation, conversion and strategy that turn attention into conversations.",
  },
  {
    href: "/services/technology",
    icon: Cpu,
    name: "Technology",
    body: "Websites, AI systems, automation, CRM workflows, dashboards and portals.",
  },
  {
    href: "/services/content",
    icon: Camera,
    name: "Content",
    body: "Photography, video, design and writing that make your business worth choosing.",
  },
  {
    href: "/services/consulting",
    icon: Compass,
    name: "Consulting",
    body: "Digital, marketing, visibility and AI strategy, from someone who does the work.",
  },
  {
    href: "/services/quality-assurance",
    icon: BadgeCheck,
    name: "Quality Assurance",
    body: "An independent check that content is accurate, on-brand and search-ready.",
  },
];

const sectors = [
  "Mining",
  "Electrical",
  "Engineering",
  "Construction",
  "Industrial",
  "Manufacturing",
  "Corporate",
  "Professional services",
  "Business services",
  "Sales organisations",
  "Product businesses",
  "Technical & specialist providers",
];

const problems = [
  {
    icon: Search,
    title: "Buyers can't find you",
    body: "You rank for your name, not for what you do. Prospects searching for your service find competitors.",
  },
  {
    icon: Bot,
    title: "AI search doesn't understand you",
    body: "Assistants answer buyer questions directly. If your business isn't clearly described online, you're not in the answer.",
  },
  {
    icon: MessagesSquare,
    title: "Visitors don't become enquiries",
    body: "Unclear offers, little proof and no obvious next step mean interested people leave without talking to you.",
  },
  {
    icon: Cpu,
    title: "Growth depends on manual work",
    body: "Follow-ups, reporting and admin eat the time that should go into customers and strategy.",
  },
];

const approach = [
  [LineChart, "Data", "to see what's really happening"],
  [Brain, "Psychology", "to understand what people actually want"],
  [Palette, "Creativity", "to be remembered and chosen"],
  [Cpu, "Technology", "to make it repeatable"],
  [Compass, "Business strategy", "to make it pay"],
] as const;

export default async function HomePage() {
  const packages = await getPublicPackages(await getDb());
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Eyebrow>Visibility · Growth · Automation</Eyebrow>
            <h1 className="font-display mt-4 text-[2.6rem] leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Become easier to find.{" "}
              <span className="text-brand-700 italic">Easier to understand.</span> Easier to choose.
            </h1>
            <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
              Mea Creo helps businesses get found on Google and in AI search, explain clearly what
              they do, and turn that attention into enquiries, with the systems to keep growth
              moving.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/book" size="lg">
                Book a strategy conversation <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/visibility-report" variant="secondary" size="lg">
                Get a free Visibility Report
              </LinkButton>
            </div>
            <p className="text-muted mt-4 text-sm">
              30 minutes with Dylan. No obligation, no pitch deck.
            </p>
          </div>
          <ReportPreview />
        </Container>
      </section>

      {/* Who we help */}
      <Section tone="surface">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.3fr]">
          <SectionIntro
            eyebrow="Who we help"
            title="Businesses with real substance and a story that isn't being told well online."
          >
            We work across industries. The real fit isn&apos;t the sector: it&apos;s a business that
            understands the value of professional visibility, growth and digital systems, and is
            ready to invest in them.
          </SectionIntro>
          <ul className="flex flex-wrap content-start gap-2" aria-label="Sectors we work with">
            {sectors.map((s) => (
              <li
                key={s}
                className="border-border bg-paper text-ink-soft rounded-full border px-4 py-2 text-sm"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Problems */}
      <Section>
        <SectionIntro
          eyebrow="The problem"
          title="Good businesses are often invisible, or misunderstood, online."
        >
          Strong products and services lose to competitors who are simply easier to find, understand
          and choose.
        </SectionIntro>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {problems.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-card border-border bg-surface border p-6">
              <Icon className="text-brand-600 size-6" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="text-muted mt-2 text-sm">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* What we do */}
      <Section tone="surface">
        <SectionIntro
          eyebrow="What we do"
          title="Visibility first. Then everything that turns it into growth."
        />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {areas.map(({ href, icon: Icon, name, body, primary }) => (
            <Link
              key={href}
              href={href}
              className={`group rounded-card flex flex-col border p-6 transition-colors ${primary ? "border-brand-700 bg-brand-900 text-white" : "border-border bg-paper hover:border-brand-300"}`}
            >
              <Icon
                className={`size-6 ${primary ? "text-brand-300" : "text-brand-600"}`}
                aria-hidden
              />
              <h3 className="font-display mt-4 text-2xl">{name}</h3>
              <p className={`mt-2 text-sm ${primary ? "text-brand-100" : "text-muted"}`}>{body}</p>
              <span
                className={`mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium ${primary ? "text-white" : "text-brand-700"}`}
              >
                Explore {name.toLowerCase()}{" "}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Approach */}
      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionIntro
            eyebrow="How we think"
            title="Data informs the strategy. It doesn't replace it."
          >
            Many businesses lean so hard on analytics that they forget what real people want to see.
            We combine the numbers with how buyers think, feel and decide, because people choose
            businesses, not dashboards.
          </SectionIntro>
          <ol className="space-y-3">
            {approach.map(([Icon, title, body], i) => (
              <li
                key={title}
                className="rounded-card border-border bg-surface flex items-center gap-4 border p-4"
              >
                <span className="text-brand-600 font-mono text-xs">{i === 0 ? "" : "+"}</span>
                <Icon className="text-brand-600 size-5 shrink-0" aria-hidden />
                <p>
                  <span className="font-semibold">{title}</span>{" "}
                  <span className="text-muted">{body}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Promise */}
      <Section tone="brand">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow inverse>Our promise</Eyebrow>
            <p className="font-display mt-3 text-4xl text-white sm:text-5xl">
              Clients are not numbers.
            </p>
            <p className="text-brand-100 mt-5 max-w-xl text-lg">
              We treat your business as if it were our own: highly involved, direct, honest about
              what will and won&apos;t work, and focused on your long-term growth. You should feel
              seen, understood and proud of what we build together.
            </p>
            <LinkButton href="/about" variant="inverse" className="mt-8">
              Meet Dylan
            </LinkButton>
          </div>
          <ul className="text-brand-50 grid grid-cols-1 gap-3 self-center sm:grid-cols-2">
            {[
              [HeartHandshake, "Personally involved"],
              [Eye, "Honest and direct"],
              [Sparkles, "Quality driven"],
              [UserRound, "Adaptable to your business"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Eye;
              return (
                <li
                  key={label as string}
                  className="flex items-center gap-3 rounded-lg bg-white/5 p-4"
                >
                  <I className="text-brand-300 size-5" aria-hidden /> {label as string}
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* How it works */}
      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionIntro eyebrow="How it works" title="A system, not a one-off project.">
            Every engagement follows the same loop, so work stays focused on what moves the needle
            and nothing disappears into a black box.
            <div className="mt-6">
              <LinkButton href="/how-it-works" variant="secondary">
                See how we work
              </LinkButton>
            </div>
          </SectionIntro>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.name} className="rounded-card border-border bg-surface border p-5">
                <span className="text-brand-600 font-mono text-xs">0{index + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{step.name}</h3>
                <p className="text-muted mt-1 text-sm">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Packages */}
      {packages && packages.length > 0 && (
        <Section tone="surface">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionIntro eyebrow="Packages" title="Clear programmes. Clear prices." />
            <LinkButton href="/pricing" variant="secondary">
              See full pricing
            </LinkButton>
          </div>
          <PackageCards packages={packages} compact />
        </Section>
      )}

      {/* Visibility report */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionIntro
              eyebrow="Free Visibility Report"
              title="Find out what's helping, and what's holding you back."
            >
              Enter your website and get a structured snapshot across search, AI discoverability,
              content, local presence and conversion. Every finding explains:
            </SectionIntro>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [Eye, "What's happening"],
                [LineChart, "Why it matters"],
                [Sparkles, "What to do next"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Eye;
                return (
                  <div
                    key={label as string}
                    className="rounded-card border-border bg-surface border p-4"
                  >
                    <I className="text-brand-600 size-5" aria-hidden />
                    <p className="mt-2 text-sm font-medium">{label as string}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/visibility-report" size="lg">
                Get your free report
              </LinkButton>
            </div>
            <p className="text-muted mt-3 text-xs">
              An initial snapshot based on your public website, not a full audit. No meaningless
              scores.
            </p>
          </div>
          <div className="border-border bg-brand-950 text-brand-50 rounded-2xl border p-8">
            <p className="text-brand-300 text-xs font-semibold tracking-[0.14em] uppercase">
              Example finding
            </p>
            <p className="font-display mt-4 text-2xl text-white">
              &ldquo;Main heading is a slogan, not a description.&rdquo;
            </p>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-brand-300 font-semibold">What&apos;s happening</dt>
                <dd className="mt-1">The page&apos;s main heading is a three-word slogan.</dd>
              </div>
              <div>
                <dt className="text-brand-300 font-semibold">Why it matters</dt>
                <dd className="mt-1">
                  Slogans carry no search meaning. Searchers and AI systems can&apos;t tell what you
                  offer.
                </dd>
              </div>
              <div>
                <dt className="text-brand-300 font-semibold">What to do</dt>
                <dd className="mt-1">
                  Keep the slogan as a supporting line and make the heading describe the service and
                  audience.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
