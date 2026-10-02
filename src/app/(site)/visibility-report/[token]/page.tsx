import { CalendarCheck, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/audits/report-view";
import { IndexPanel } from "@/components/audits/index-panel";
import { Container, CtaBand, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { LinkButton } from "@/components/ui/button";
import { getDb } from "@/db";
import { kickJobs } from "@/jobs/kick";
import { getAuditByToken } from "@/modules/audits/service";
import { visibilityIndex } from "@/modules/audits/visibility-index";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Visibility Report",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: PageProps<"/visibility-report/[token]">) {
  const { token } = await params;
  const db = await getDb();
  const audit = await getAuditByToken(db, token);
  if (!audit) notFound();

  const host = (() => {
    try {
      return new URL(audit.url).hostname.replace(/^www\./, "");
    } catch {
      return audit.url;
    }
  })();

  if (audit.status === "queued" || audit.status === "running") {
    kickJobs();
    return (
      <section className="py-20">
        <AutoRefresh />
        <Container className="max-w-2xl text-center">
          <Loader2 className="text-brand-600 mx-auto size-8 animate-spin" aria-hidden />
          <DisplayHeading as="h1" className="mt-6">
            Analysing {host}…
          </DisplayHeading>
          <p className="text-muted mt-4" role="status" aria-live="polite">
            We&apos;re checking search foundations, AI discoverability, content and conversion
            signals. This usually takes under a minute. This page updates automatically.
          </p>
          <ul className="text-ink-soft mx-auto mt-8 max-w-sm space-y-2 text-left text-sm">
            <li>· Reading your home page</li>
            <li>· Checking robots.txt, sitemap and structured data</li>
            <li>· Looking for answers, proof and clear next steps</li>
          </ul>
        </Container>
      </section>
    );
  }

  if (audit.status === "failed" || !audit.result) {
    return (
      <section className="py-20">
        <Container className="max-w-2xl">
          <DisplayHeading as="h1">We couldn&apos;t finish your report.</DisplayHeading>
          <p className="text-muted mt-4">
            {audit.error ?? "Something went wrong while analysing the website."}
          </p>
          <p className="text-muted mt-2">
            Please check the address and try again, or get in touch and we&apos;ll look at it
            personally.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/visibility-report">Try again</LinkButton>
            <LinkButton href="/contact" variant="secondary">
              Contact us
            </LinkButton>
          </div>
        </Container>
      </section>
    );
  }

  const result = audit.result;
  const index = visibilityIndex(result);
  return (
    <>
      <section className="bg-night text-night-text relative isolate overflow-hidden py-14 sm:py-20">
        <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-80" />
        <div
          aria-hidden
          className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(70%_70%_at_20%_0%,#000,transparent)]"
        />
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <Eyebrow inverse>Initial Visibility Snapshot</Eyebrow>
            <DisplayHeading as="h1" className="mt-4 text-white sm:text-[3.2rem]">
              {audit.companyName ?? host}
            </DisplayHeading>
            <p className="text-night-muted mt-2 font-mono text-sm">{result.finalUrl}</p>
            <p className="text-night-text/90 mt-6 max-w-xl text-lg leading-relaxed">
              {result.headline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href={`/book?report=${token}`} variant="inverse" size="lg">
                <CalendarCheck className="size-4" aria-hidden /> Book your free visibility review
              </LinkButton>
              <LinkButton href="#opportunities" variant="glass" size="lg">
                See your biggest opportunities
              </LinkButton>
            </div>
          </div>
          {index && (
            <div className="edge-glow rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md sm:p-8">
              <IndexPanel index={index} inverse />
            </div>
          )}
        </Container>
      </section>
      <section className="py-14 sm:py-20">
        <Container>
          <ReportView result={result} />
        </Container>
      </section>
      <CtaBand
        bookHref={`/book?report=${token}`}
        showReport={false}
        title="Want to talk it through?"
        body="In a free 30-minute visibility review we'll walk through these findings, explain which ones matter most for your business, and outline what we'd do first. No pressure, no obligation."
      />
      <div className="h-4" />
    </>
  );
}
