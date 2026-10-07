import { FileDown } from "lucide-react";
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
        <p className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            Last updated {new Date(d.updated).toLocaleDateString("en-ZA", { dateStyle: "long" })}
          </span>
          <a
            href={`/legal/${d.slug}/pdf`}
            className="text-brand-700 inline-flex items-center gap-1 font-medium underline decoration-current/30 underline-offset-2 hover:decoration-current"
          >
            <FileDown className="size-4" aria-hidden /> Download PDF
          </a>
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
