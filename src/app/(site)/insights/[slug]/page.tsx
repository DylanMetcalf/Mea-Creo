import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CtaBand, Container, Eyebrow, FaqList, JsonLd } from "@/components/site/marketing";
import { Prose } from "@/components/ui/prose";
import { getDb } from "@/db";
import { INSIGHT_CATEGORY_LABELS, insights } from "@/db/schema";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const getArticle = cache(async (slug: string) => {
  const [a] = await (
    await getDb()
  )
    .select()
    .from(insights)
    .where(and(eq(insights.slug, slug), eq(insights.status, "published")))
    .limit(1);
  return a ?? null;
});

export async function generateMetadata({
  params,
}: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return {};
  return {
    title: a.seoTitle ?? a.title,
    description: a.seoDescription ?? a.summary,
    alternates: { canonical: `/insights/${a.slug}` },
    openGraph: {
      type: "article",
      title: a.title,
      description: a.summary,
      publishedTime: a.publishedAt?.toISOString(),
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/insights/[slug]">) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.title,
            description: a.summary,
            datePublished: a.publishedAt?.toISOString(),
            dateModified: a.updatedAt.toISOString(),
            author: { "@type": "Person", name: a.authorName },
            publisher: { "@id": `${siteUrl}/#organization` },
            mainEntityOfPage: `${siteUrl}/insights/${a.slug}`,
          },
          ...(a.faq.length
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: a.faq.map((f) => ({
                    "@type": "Question",
                    name: f.question,
                    acceptedAnswer: { "@type": "Answer", text: f.answer },
                  })),
                },
              ]
            : []),
        ]}
      />
      <article className="py-14 sm:py-20">
        <Container className="max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-muted text-sm">
            <Link href="/insights" className="hover:text-ink">
              Insights
            </Link>
          </nav>
          <Eyebrow>{INSIGHT_CATEGORY_LABELS[a.category]}</Eyebrow>
          <h1 className="font-display mt-3 text-3xl leading-tight text-balance sm:text-5xl">
            {a.title}
          </h1>
          <p className="text-muted mt-4 text-lg">{a.summary}</p>
          <p className="text-subtle mt-4 text-sm">
            {a.authorName} · {fmtDate(a.publishedAt)} · {a.readingMinutes} min read
          </p>
          <Prose markdown={a.body} className="mt-10" />
          {a.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display mb-4 text-2xl">Questions</h2>
              <FaqList items={a.faq} />
            </section>
          )}
        </Container>
      </article>
      <CtaBand />
    </>
  );
}
