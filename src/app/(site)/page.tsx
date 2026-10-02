import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Camera,
  Compass,
  Cpu,
  Eye,
  HeartHandshake,
  LineChart,
  MessagesSquare,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PackageCards } from "@/components/site/package-cards";
import { CtaBand, Container, Eyebrow, Section, SectionIntro } from "@/components/site/marketing";
import { HeroVisual } from "@/components/site/hero-visual";
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

const formula = [
  ["Data", "to see what's really happening"],
  ["Psychology", "to understand what people want"],
  ["Creativity", "to be remembered and chosen"],
  ["Technology", "to make it repeatable"],
  ["Strategy", "to make it pay"],
] as const;

export default async function HomePage() {
  const packages = await getPublicPackages(await getDb());
  const [feature, ...rest] = areas;
  return (
    <>
      {/* Hero: light, lit by the aurora, with the signal visual */}
      <section className="relative isolate overflow-hidden pt-10 pb-16 sm:pt-16 lg:pt-20 lg:pb-24">
        <div aria-hidden className="bg-aurora absolute inset-0 -z-10 opacity-80" />
        <div
          aria-hidden
          className="bg-grid-light absolute inset-0 -z-10 [mask-image:radial-gradient(70%_60%_at_30%_20%,#000,transparent)]"
        />
        <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          <div>
            <Eyebrow>Visibility · Growth · Automation</Eyebrow>
            <h1 className="font-display text-ink mt-5 text-[2.5rem] leading-[1.03] tracking-[-0.045em] sm:text-[3.5rem] lg:text-[3.3rem] xl:text-[3.7rem]">
              Become easier to find.
              <br />
              Easier to understand.
              <br />
              <span className="text-gradient">Easier to choose.</span>
            </h1>
            <p className="text-muted mt-7 max-w-xl text-[1.13rem] leading-relaxed">
              Mea Creo helps businesses get found on Google and in AI search, explain clearly what
              they do, and turn that attention into enquiries, with the systems to keep growth
              moving.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/book" variant="cta" size="xl">
                Book a strategy call
                <ArrowRight
                  className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                  aria-hidden
                />
              </LinkButton>
              <LinkButton href="/visibility-report" variant="secondary" size="xl">
                Get a free Visibility Report
              </LinkButton>
            </div>
            <p className="text-muted mt-5 flex items-center gap-2 text-sm">
              <span className="bg-brand-500 size-1.5 rounded-full" aria-hidden />
              30 minutes with Dylan. No obligation, no pitch deck.
            </p>
          </div>
          <HeroVisual />
        </Container>
      </section>

      {/* Sectors */}
      <section aria-label="Sectors we work with" className="border-border/60 border-y py-6">
        <Container className="flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
          <p className="label-mono text-muted shrink-0">Built for businesses in</p>
          <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <ul className="flex w-max gap-8 pr-8 motion-safe:animate-[marquee_45s_linear_infinite] motion-safe:hover:[animation-play-state:paused]">
              {[...sectors, ...sectors].map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  aria-hidden={i >= sectors.length || undefined}
                  className="font-display text-ink-soft text-[1.05rem] whitespace-nowrap"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Problem */}
      <Section>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionIntro
            eyebrow="The problem"
            title="Good businesses are often invisible, or misunderstood, online."
          >
            Strong products and services lose to competitors who are simply easier to find,
            understand and choose. We work with businesses that have real substance and a story that
            isn&apos;t being told well yet.
          </SectionIntro>
          <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {problems.map(({ icon: Icon, title, body }) => (
              <li key={title} className="reveal border-border border-t py-7">
                <Icon className="text-brand-600 size-5" aria-hidden />
                <h3 className="font-display mt-4 text-[1.3rem]">{title}</h3>
                <p className="text-muted mt-2 leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* What we do: dark technology section, bento layout */}
      <Section tone="night">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionIntro
            inverse
            eyebrow="What we do"
            title="Visibility first. Then everything that turns it into growth."
          />
          <LinkButton href="/services" variant="glass" className="self-start md:self-auto">
            All services
          </LinkButton>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href={feature.href}
            className="group edge-glow bg-night-3 relative isolate flex min-h-[340px] flex-col overflow-hidden rounded-[22px] p-7 md:row-span-2"
          >
            <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-70" />
            <div
              aria-hidden
              className="bg-signal/25 absolute -top-24 -right-24 -z-10 size-72 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 md:opacity-60"
            />
            <feature.icon className="text-signal size-6" aria-hidden />
            <p className="label-mono text-signal mt-8">Where most engagements start</p>
            <h3 className="font-display mt-3 text-[2.2rem] text-white">{feature.name}</h3>
            <p className="text-night-text/85 mt-3 max-w-sm text-[1.05rem] leading-relaxed">
              {feature.body}
            </p>
            <ul className="text-night-muted mt-6 space-y-2 text-sm">
              {["SEO", "GEO: AI search visibility", "AEO: answer readiness", "Google & local"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="bg-signal size-1 rounded-full" aria-hidden /> {t}
                  </li>
                ),
              )}
            </ul>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-semibold text-white">
              Explore visibility
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </span>
          </Link>
          {rest.map(({ href, icon: Icon, name, body }, i) => (
            <Link
              key={href}
              href={href}
              className={`group border-night-line bg-night-2 relative isolate flex flex-col overflow-hidden rounded-[22px] border p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-white/20 ${i === rest.length - 1 ? "md:col-span-2 lg:col-span-3" : ""}`}
            >
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-[radial-gradient(80%_70%_at_100%_0%,rgb(127_224_178/0.12),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="flex items-center justify-between">
                <span className="border-night-line text-signal flex size-10 items-center justify-center rounded-xl border bg-white/[0.03]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <ArrowRight
                  className="text-night-muted size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </div>
              <h3 className="font-display mt-6 text-[1.35rem] text-white">{name}</h3>
              <p className="text-night-muted mt-2 text-[0.93rem] leading-relaxed">{body}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* How we think: the formula */}
      <Section tone="surface">
        <SectionIntro
          eyebrow="How we think"
          title="Data informs the strategy. It doesn't replace it."
        >
          Many businesses lean so hard on analytics that they forget what real people want to see.
          We combine the numbers with how buyers think, feel and decide, because people choose
          businesses, not dashboards.
        </SectionIntro>
        <ol className="mt-14 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,1fr)_auto_1.1fr]">
          {formula.map(([title, body], i) => (
            <li key={title} className="reveal relative flex">
              <div className="border-border bg-paper flex w-full flex-col rounded-2xl border p-5">
                <span className="label-mono text-subtle">{i === 0 ? "\u00a0" : "+"}</span>
                <p className="font-display mt-3 text-[1.2rem]">{title}</p>
                <p className="text-muted mt-1 text-sm leading-snug">{body}</p>
              </div>
            </li>
          ))}
          <li
            aria-hidden
            className="font-display text-subtle hidden items-center justify-center px-1 text-3xl lg:flex"
          >
            =
          </li>
          <li className="reveal flex">
            <div className="bg-signal shadow-glow flex w-full flex-col justify-between rounded-2xl p-5 text-white">
              <span className="label-mono text-white/70">The result</span>
              <p className="font-display mt-3 text-[1.45rem] leading-tight">
                A business people choose.
              </p>
            </div>
          </li>
        </ol>
      </Section>

      {/* Promise: the human side, with real photography */}
      <section className="px-3 sm:px-4">
        <div className="bg-horizon relative isolate overflow-hidden rounded-[28px] text-white">
          <div
            aria-hidden
            className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(60%_80%_at_100%_0%,#000,transparent)]"
          />
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-14 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-20">
            <div className="relative">
              <Image
                src="/images/dylan-metcalf.jpg"
                alt="Dylan Metcalf, founder of Mea Creo, on the Mpumalanga escarpment"
                width={1600}
                height={1600}
                sizes="(min-width: 1024px) 460px, 90vw"
                className="aspect-[4/5] w-full rounded-[22px] object-cover object-[50%_30%] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)]"
              />
              <div className="absolute bottom-4 left-4 rounded-xl border border-white/15 bg-black/35 px-3.5 py-2.5 backdrop-blur-md">
                <p className="text-sm font-semibold">Dylan Metcalf</p>
                <p className="text-xs text-white/75">Founder · Dullstroom, Mpumalanga</p>
              </div>
            </div>
            <div>
              <Eyebrow inverse>Our promise</Eyebrow>
              <p className="font-display mt-5 text-[2.6rem] leading-[1.02] sm:text-[3.6rem]">
                Clients are
                <br />
                <span className="text-gradient-night">not numbers.</span>
              </p>
              <p className="text-night-text/85 mt-6 max-w-xl text-lg leading-relaxed">
                We treat your business as if it were our own: highly involved, direct, honest about
                what will and won&apos;t work, and focused on your long-term growth. You should feel
                seen, understood and proud of what we build together.
              </p>
              <ul className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-[0.95rem]">
                {[
                  [HeartHandshake, "Personally involved"],
                  [Eye, "Honest and direct"],
                  [Sparkles, "Quality driven"],
                  [UserRound, "Adaptable to your business"],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof Eye;
                  return (
                    <li key={label as string} className="flex items-center gap-2.5">
                      <I className="text-signal size-4 shrink-0" aria-hidden /> {label as string}
                    </li>
                  );
                })}
              </ul>
              <LinkButton href="/about" variant="inverse" size="lg" className="mt-10">
                Meet Dylan
                <ArrowRight
                  className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                  aria-hidden
                />
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: a real sequence */}
      <Section>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionIntro eyebrow="How it works" title="A system, not a one-off project.">
            Every engagement follows the same loop, so work stays focused on what moves the needle
            and nothing disappears into a black box.
          </SectionIntro>
          <LinkButton href="/how-it-works" variant="secondary" className="self-start md:self-auto">
            See how we work
          </LinkButton>
        </div>
        <ol className="relative mt-14 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          <div
            aria-hidden
            className="from-brand-500 via-dusk-300 to-ember-500 absolute top-[19px] right-0 left-0 hidden h-px bg-gradient-to-r opacity-60 lg:block"
          />
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.name} className="reveal relative">
              <span className="border-brand-300 bg-paper text-brand-700 relative flex size-10 items-center justify-center rounded-full border font-mono text-sm font-medium">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display mt-5 text-[1.2rem]">{step.name}</h3>
              <p className="text-muted mt-1.5 text-sm leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Packages */}
      {packages && packages.length > 0 && (
        <Section tone="surface">
          <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionIntro eyebrow="Packages" title="Clear programmes. Clear prices." />
            <LinkButton href="/pricing" variant="secondary" className="self-start md:self-auto">
              See full pricing
            </LinkButton>
          </div>
          <PackageCards packages={packages} compact />
        </Section>
      )}

      {/* Visibility report showcase */}
      <Section tone="night">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionIntro
              inverse
              eyebrow="Free Visibility Report"
              title="Find out what's helping, and what's holding you back."
            >
              Enter your website and get a structured diagnosis across search, AI discoverability,
              content, local presence and conversion, with the Mea Creo Visibility Index and the
              most valuable first steps.
            </SectionIntro>
            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                [Eye, "What's happening"],
                [LineChart, "Why it matters"],
                [Sparkles, "What to do next"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Eye;
                return (
                  <li
                    key={label as string}
                    className="border-night-line flex items-center gap-2.5 rounded-xl border bg-white/[0.03] px-4 py-3 text-sm text-white"
                  >
                    <I className="text-signal size-4" aria-hidden /> {label as string}
                  </li>
                );
              })}
            </ul>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/visibility-report" variant="inverse" size="xl">
                Get your free report
                <ArrowRight
                  className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                  aria-hidden
                />
              </LinkButton>
            </div>
            <p className="text-night-muted mt-4 text-xs">
              An initial snapshot of your public website, not a full audit. The Index is Mea
              Creo&apos;s own measure, not a Google score.
            </p>
          </div>
          <div className="edge-glow bg-night-2 relative rounded-[24px] p-7 sm:p-8">
            <p className="label-mono text-signal">Example finding</p>
            <p className="font-display mt-4 text-[1.6rem] leading-snug text-white">
              &ldquo;Main heading is a slogan, not a description.&rdquo;
            </p>
            <dl className="mt-7 space-y-5 text-[0.95rem]">
              {[
                ["What's happening", "The page's main heading is a three-word slogan."],
                [
                  "Why it matters",
                  "Slogans carry no search meaning. Searchers and AI systems can't tell what you offer.",
                ],
                [
                  "What to do",
                  "Keep the slogan as a supporting line and make the heading describe the service and audience.",
                ],
              ].map(([k, v]) => (
                <div key={k} className="border-night-line border-l-2 pl-4">
                  <dt className="label-mono text-night-muted">{k}</dt>
                  <dd className="text-night-text mt-1.5">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <div className="pt-16 sm:pt-20">
        <CtaBand />
      </div>
    </>
  );
}
