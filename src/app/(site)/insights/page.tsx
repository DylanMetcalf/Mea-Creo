import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, Container, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { getDb } from "@/db";
import { INSIGHT_CATEGORY_LABELS, insights } from "@/db/schema";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Practical writing on SEO, AI search visibility, lead generation and automation for B2B and professional service businesses.",
  alternates: { canonical: "/insights" },
};
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const rows = await (
    await getDb()
  )
    .select()
    .from(insights)
    .where(eq(insights.status, "published"))
    .orderBy(desc(insights.publishedAt));
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container>
          <Eyebrow>Insights</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Clear thinking on being found, trusted and chosen.
          </DisplayHeading>
          {rows.length === 0 ? (
            <p className="text-muted mt-10">
              The first articles are being written. Check back soon.
            </p>
          ) : (
            <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/insights/${a.slug}`}
                    className="group rounded-card border-border bg-surface hover:border-brand-300 flex h-full flex-col border p-6"
                  >
                    <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
                      {INSIGHT_CATEGORY_LABELS[a.category]}
                    </p>
                    <h2 className="font-display mt-2 text-xl leading-snug group-hover:underline">
                      {a.title}
                    </h2>
                    <p className="text-muted mt-3 flex-1 text-sm">{a.summary}</p>
                    <p className="text-subtle mt-4 text-xs">
                      {fmtDate(a.publishedAt)} · {a.readingMinutes} min read
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
