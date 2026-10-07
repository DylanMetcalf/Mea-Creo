import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/site/marketing";
import { Callout } from "@/components/ui/primitives";
import { Prose } from "@/components/ui/prose";
import { getLegalDoc, LEGAL_DOCS } from "@/content/legal";
import { getDb } from "@/db";
import { getPlatformSetting } from "@/modules/settings/service";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const d = getLegalDoc((await params).doc);
  return d
    ? { title: d.title, description: d.description, alternates: { canonical: `/legal/${d.slug}` } }
    : {};
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const d = getLegalDoc((await params).doc);
  if (!d) notFound();
  const legal = await getPlatformSetting(await getDb(), "legal").catch(() => null);
  const reviewed = legal?.reviewed[d.slug] ?? d.reviewed;
  return (
    <section className="relative isolate overflow-hidden py-14 sm:py-20">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-35"
      />
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl sm:text-5xl">{d.title}</h1>
        <p className="text-muted mt-3 text-sm">
          Last updated {new Date(d.updated).toLocaleDateString("en-ZA", { dateStyle: "long" })}
        </p>
        {!reviewed && (
          <div className="mt-6">
            <Callout tone="warning" title="Draft">
              This version is awaiting final review. Contact us with any questions.
            </Callout>
          </div>
        )}
        <Prose markdown={d.body} className="mt-8" />
      </Container>
    </section>
  );
}
