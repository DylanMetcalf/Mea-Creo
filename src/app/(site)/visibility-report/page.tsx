import { Clock, FileSearch, Lock } from "lucide-react";
import type { Metadata } from "next";
import {
  CheckList,
  Container,
  DisplayHeading,
  Eyebrow,
  FaqList,
} from "@/components/site/marketing";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Free Visibility Report: How visible is your business?",
  description:
    "Get a free, structured snapshot of your visibility across Google search, AI discoverability, content, local presence and conversion, with clear next steps.",
  alternates: { canonical: "/visibility-report" },
};

const faq = [
  {
    question: "Is it really free?",
    answer:
      "Yes. There's no cost and no obligation. If it's useful, you can book a free visibility review call to talk it through.",
  },
  {
    question: "What does the report check?",
    answer:
      "Your public website: search foundations, technical SEO, content depth, AI discoverability (entity and structured data), answer readiness, local and LinkedIn signals, and how easy it is to enquire.",
  },
  {
    question: "Is this a full SEO audit?",
    answer:
      "No. It's an initial visibility snapshot from your public pages. Search performance data (rankings, clicks) and deeper analysis need access to tools like Google Search Console, which we cover in a full engagement.",
  },
  {
    question: "What happens to my details?",
    answer:
      "We use them to prepare your report and to follow up about it. You can ask us to delete them at any time.",
  },
];

export default async function VisibilityReportPage({
  searchParams,
}: PageProps<"/visibility-report">) {
  const params = await searchParams;
  const utm = Object.fromEntries(
    Object.entries(params)
      .filter(([k, v]) => k.startsWith("utm_") && typeof v === "string")
      .map(([k, v]) => [k, String(v).slice(0, 200)]),
  );

  return (
    <section className="py-12 sm:py-20">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Eyebrow>Free Visibility Report</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 sm:text-5xl">
            How easy is your business to find, trust and choose?
          </DisplayHeading>
          <p className="text-muted mt-5 text-lg">
            Enter your website and we&apos;ll analyse how you show up across search, AI discovery
            and your own site. You get a structured report, not a meaningless score.
          </p>
          <div className="mt-8">
            <CheckList
              items={[
                "Search, technical SEO and content foundations",
                "AI discoverability (GEO) and answer readiness (AEO)",
                "Local, Google and LinkedIn presence signals",
                "Conversion and lead-capture basics",
                "Your 3–7 biggest opportunities, prioritised",
              ]}
            />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [Clock, "Ready in about a minute"],
              [FileSearch, "What, why and what to do"],
              [Lock, "Your details stay private"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Clock;
              return (
                <div
                  key={label as string}
                  className="text-ink-soft flex items-center gap-2 text-sm"
                >
                  <I className="text-brand-600 size-4" aria-hidden />
                  {label as string}
                </div>
              );
            })}
          </div>
          <div className="mt-12 hidden lg:block">
            <FaqList items={faq} />
          </div>
        </div>
        <div>
          <div className="border-border bg-surface shadow-raised rounded-2xl border p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Get your report</h2>
            <p className="text-muted mt-1 mb-6 text-sm">Takes under a minute to fill in.</p>
            <ReportForm utm={utm} />
          </div>
          <div className="mt-8 lg:hidden">
            <FaqList items={faq} />
          </div>
        </div>
      </Container>
    </section>
  );
}
