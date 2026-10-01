import {
  ArrowRight,
  Bot,
  Camera,
  Eye,
  LineChart,
  MessagesSquare,
  Search,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  Section,
  SectionIntro,
} from "@/components/site/marketing";
import { ReportPreview } from "@/components/site/report-preview";
import { LinkButton } from "@/components/ui/button";
import { HOW_IT_WORKS } from "@/content/pillars";

export const metadata: Metadata = {
  title: { absolute: "Mea Creo | Visibility, Growth & Automation for B2B Businesses" },
  description:
    "Mea Creo helps B2B and professional service businesses become easier to find, easier to trust and easier to choose, through SEO, AI search visibility, lead generation and automation.",
  alternates: { canonical: "/" },
};

const pillars = [
  {
    href: "/services/visibility",
    icon: Search,
    tag: "Get found",
    name: "Visibility",
    body: "SEO, GEO and AEO, so you are found on Google and understood by AI search.",
    items: [
      "SEO",
      "AI search visibility (GEO)",
      "Answer optimisation (AEO)",
      "Google & local visibility",
      "Website optimisation",
    ],
    primary: true,
  },
  {
    href: "/services/growth",
    icon: TrendingUp,
    tag: "Get opportunities",
    name: "Growth",
    body: "Turn visibility into conversations with the right decision makers.",
    items: ["Lead generation", "LinkedIn networking", "Google Ads", "Conversion optimisation"],
  },
  {
    href: "/services/automation",
    icon: Workflow,
    tag: "Get automated",
    name: "Automation",
    body: "Remove repetitive work with AI and workflows, and keep people in control.",
    items: ["AI agents", "Workflow automation", "Reporting automation"],
  },
  {
    href: "/services/creative",
    icon: Camera,
    tag: "Get noticed",
    name: "Creative",
    body: "Photography, video, design and content that earn trust once you're found.",
    items: ["Photography & video", "Graphic design", "Content & social"],
  },
];

const problems = [
  {
    icon: Search,
    title: "Buyers can't find you",
    body: "Your site ranks for your name, but not for what you do. Prospects searching for your service find competitors.",
  },
  {
    icon: Bot,
    title: "AI search doesn't know you",
    body: "Assistants answer buyer questions directly. If your business isn't clearly described online, you're not part of the answer.",
  },
  {
    icon: MessagesSquare,
    title: "Visitors don't become enquiries",
    body: "Unclear offers, no proof and no obvious next step mean interested visitors leave without talking to you.",
  },
];

const reasons = [
  [
    "One connected system",
    "Visibility, growth, content and automation planned together, not as disconnected services.",
  ],
  [
    "Human strategy, AI-assisted execution",
    "AI does the heavy lifting on research and analysis. People make the decisions and approve what goes out.",
  ],
  [
    "No black box",
    "Your client workspace shows what we're doing, why, what changed and what we need from you.",
  ],
  [
    "Continuous improvement",
    "Every month we measure, learn and adjust. Visibility compounds when it's managed.",
  ],
  [
    "Honest reporting",
    "Activity and outcomes are reported separately, so you always know what actually changed.",
  ],
  [
    "Creative when you need it",
    "In-house photography, video and design, so your visibility work looks as credible as your business is.",
  ],
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Eyebrow>Visibility · Growth · Automation</Eyebrow>
            <h1 className="font-display mt-4 text-[2.6rem] leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Become easier to find. <span className="text-brand-700 italic">Easier to trust.</span>{" "}
              Easier to choose.
            </h1>
            <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
              Mea Creo helps B2B and professional service businesses get found on Google and in AI
              search, turn that visibility into real opportunities, and build the systems that keep
              growth moving.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/visibility-report" size="lg">
                Get your free Visibility Report <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/book" variant="secondary" size="lg">
                Talk to Mea Creo
              </LinkButton>
            </div>
            <p className="text-muted mt-4 text-sm">
              Free. No obligation. A clear view of what&apos;s helping and what&apos;s holding you
              back.
            </p>
          </div>
          <ReportPreview />
        </Container>
      </section>

      {/* Problem */}
      <Section tone="surface">
        <SectionIntro eyebrow="The problem" title="Good businesses are often invisible online.">
          Strong products and services lose to competitors who are simply easier to find and
          understand. It usually comes down to three gaps.
        </SectionIntro>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {problems.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-card border-border bg-paper border p-6">
              <Icon className="text-brand-600 size-6" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="text-muted mt-2">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Pillars */}
      <Section>
        <SectionIntro
          eyebrow="What we do"
          title="Visibility first. Then growth, automation and creative to make it count."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ href, icon: Icon, tag, name, body, items, primary }) => (
            <Link
              key={href}
              href={href}
              className={`group rounded-card flex flex-col border p-6 transition-colors ${primary ? "border-brand-700 bg-brand-900 text-white lg:row-span-1" : "border-border bg-surface hover:border-brand-300"}`}
            >
              <Icon
                className={`size-6 ${primary ? "text-brand-300" : "text-brand-600"}`}
                aria-hidden
              />
              <p
                className={`mt-5 text-xs font-semibold tracking-[0.12em] uppercase ${primary ? "text-brand-300" : "text-brand-600"}`}
              >
                {tag}
              </p>
              <h3 className="font-display mt-1 text-2xl">{name}</h3>
              <p className={`mt-2 text-sm ${primary ? "text-brand-100" : "text-muted"}`}>{body}</p>
              <ul
                className={`mt-4 space-y-1 text-sm ${primary ? "text-brand-50" : "text-ink-soft"}`}
              >
                {items.map((i) => (
                  <li key={i}>· {i}</li>
                ))}
              </ul>
              <span
                className={`mt-auto pt-6 text-sm font-medium ${primary ? "text-white" : "text-brand-700"} inline-flex items-center gap-1`}
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

      {/* How it works */}
      <Section tone="surface">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <SectionIntro eyebrow="How it works" title="A system, not a one-off project.">
            Every engagement follows the same loop, so work stays focused on what moves the needle
            and nothing disappears into a black box.
            <div className="mt-6">
              <LinkButton href="/how-it-works" variant="secondary">
                See how we work
              </LinkButton>
            </div>
          </SectionIntro>
          <ol className="grid gap-4 sm:grid-cols-2">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.name} className="rounded-card border-border bg-paper border p-5">
                <span className="text-brand-600 font-mono text-xs">0{index + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{step.name}</h3>
                <p className="text-muted mt-1 text-sm">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Visibility report */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionIntro
              eyebrow="Free Visibility Report"
              title="Find out what's helping, and what's holding you back."
            >
              Enter your website and get a structured snapshot across search, AI discoverability,
              content, local presence and conversion. Every finding explains:
            </SectionIntro>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
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
              An initial snapshot based on your public website, not a full SEO audit. No meaningless
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
                <dd className="mt-1">Your H1 is &ldquo;Engage. Inspire. Convert.&rdquo;</dd>
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

      {/* Why Mea Creo */}
      <Section tone="surface">
        <SectionIntro eyebrow="Why Mea Creo" title="Capability through clarity." />
        <div className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {reasons.map(([title, body]) => (
            <div key={title} className="border-border border-t pt-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-muted mt-2 text-sm">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Transparency */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <SectionIntro
            eyebrow="Your client workspace"
            title="See exactly what we're doing for you."
          >
            Every client gets a simple, secure workspace: current work, what needs your approval,
            reports in plain language, files, invoices and a growth timeline. It shows simple
            inputs, clear activity and results you can understand.
          </SectionIntro>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "This month",
                "3 pages optimised · 1 article published · 18 approved outreach emails",
              ],
              ["Needs your approval", "October article · service page titles"],
              ["What changed", "More visibility for priority searches, measured in Search Console"],
              ["What's next", "Second outreach wave · fleet maintenance page"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-card border-border bg-surface shadow-card border p-5"
              >
                <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
                  {title}
                </p>
                <p className="text-ink-soft mt-2 text-sm">{body}</p>
              </div>
            ))}
            <p className="text-muted text-xs sm:col-span-2">
              Illustration of the client workspace.
            </p>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
