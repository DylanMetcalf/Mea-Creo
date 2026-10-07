import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/portfolio/gallery";
import { LinkButton } from "@/components/ui/button";
import { PORTFOLIO_CATEGORIES, type PortfolioCategory } from "@/content/portfolio";
import { getDb } from "@/db";
import { openPortfolioLink } from "@/modules/portfolio/service";

export const metadata: Metadata = {
  title: "Photography",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** A private, shareable selection of Mea Creo photography. Not listed or indexed. */
export default async function SharedPortfolioPage({ params }: PageProps<"/portfolio/[token]">) {
  const { token } = await params;
  const data = await openPortfolioLink(await getDb(), token);
  if (!data) notFound();
  const groups = (Object.keys(PORTFOLIO_CATEGORIES) as PortfolioCategory[])
    .map((c) => ({ c, photos: data.photos.filter((p) => p.category === c) }))
    .filter((g) => g.photos.length);
  return (
    <div className="space-y-14">
      <header className="max-w-2xl">
        <p className="label-mono text-brand-600">Photography by Dylan Metcalf</p>
        <h1 className="font-display mt-3 text-[2.4rem] leading-tight sm:text-[3rem]">
          A selection of our work
        </h1>
        {data.link.message ? (
          <p className="text-ink-soft mt-4 text-lg leading-relaxed whitespace-pre-line">
            {data.link.message}
          </p>
        ) : (
          <p className="text-muted mt-4 text-lg">
            Brand, product, people and place photography, shot by Mea Creo.
          </p>
        )}
        <nav aria-label="Categories" className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <a
              key={g.c}
              href={`#${g.c}`}
              className="border-border bg-surface hover:border-brand-300 rounded-full border px-3.5 py-1.5 text-sm transition-colors"
            >
              {PORTFOLIO_CATEGORIES[g.c]} <span className="text-subtle">{g.photos.length}</span>
            </a>
          ))}
        </nav>
      </header>
      {groups.map((g) => (
        <section key={g.c} id={g.c} aria-labelledby={`${g.c}-h`} className="scroll-mt-24">
          <h2 id={`${g.c}-h`} className="font-display mb-5 text-[1.6rem]">
            {PORTFOLIO_CATEGORIES[g.c]}
          </h2>
          <Gallery
            photos={g.photos}
            altPrefix={`${PORTFOLIO_CATEGORIES[g.c]} photograph by Mea Creo,`}
          />
        </section>
      ))}
      <footer className="border-border flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted text-sm">
          Want something like this for your business? Let&apos;s talk.
        </p>
        <LinkButton href="/book" variant="cta">
          Book a strategy call
        </LinkButton>
      </footer>
    </div>
  );
}
