import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { CtaBand, Container, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { getDb } from "@/db";
import { caseStudies } from "@/db/schema";
import { humanize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected Mea Creo work, published with each client's permission.",
  alternates: { canonical: "/work" },
};
export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const rows = await (
    await getDb()
  )
    .select()
    .from(caseStudies)
    .where(and(eq(caseStudies.status, "published"), eq(caseStudies.clientPermission, true)))
    .orderBy(asc(caseStudies.sortOrder));
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container>
          <Eyebrow>Work</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Selected work.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Published only with our clients&apos; permission, and only with outcomes we can verify.
          </p>
          {rows.length === 0 ? (
            <div className="rounded-card border-border bg-surface mt-12 border p-8">
              <p className="font-medium">Case studies are on their way.</p>
              <p className="text-muted mt-2">
                We publish client work once the client has agreed and the results have been
                verified. In the meantime, the free Visibility Report shows exactly how we think.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              {rows.map((c) => (
                <article key={c.id} className="rounded-card border-border bg-surface border p-6">
                  <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
                    {humanize(c.type)}
                    {c.industry ? ` · ${c.industry}` : ""}
                  </p>
                  <h2 className="font-display mt-2 text-2xl">{c.title}</h2>
                  <p className="text-muted mt-1 text-sm">{c.clientName}</p>
                  <p className="text-ink-soft mt-3">{c.summary}</p>
                  {c.challenge && (
                    <p className="mt-3 text-sm">
                      <span className="font-medium">Challenge:</span> {c.challenge}
                    </p>
                  )}
                  {c.workCompleted && (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">What we did:</span> {c.workCompleted}
                    </p>
                  )}
                  {c.outcomes.filter((o) => o.verified).length > 0 && (
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                      {c.outcomes
                        .filter((o) => o.verified)
                        .map((o) => (
                          <div key={o.label} className="bg-brand-50 rounded-lg p-3">
                            <dt className="text-brand-900 text-xs">{o.label}</dt>
                            <dd className="text-brand-900 text-lg font-semibold">{o.value}</dd>
                            {o.source && (
                              <dd className="text-brand-800 text-[0.7rem]">Source: {o.source}</dd>
                            )}
                          </div>
                        ))}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          )}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
