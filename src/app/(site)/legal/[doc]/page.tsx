import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/site/marketing";
import { Callout } from "@/components/ui/primitives";
import { Prose } from "@/components/ui/prose";
import { getLegalDoc, LEGAL_DOCS } from "@/content/legal";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const d = getLegalDoc((await params).doc);
  return d
    ? { title: d.title, description: d.description, alternates: { canonical: `/legal/${d.slug}` } }
    : {};
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const d = getLegalDoc((await params).doc);
  if (!d) notFound();
  return (
    <section className="py-14 sm:py-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl sm:text-5xl">{d.title}</h1>
        {!d.reviewed && (
          <div className="mt-6">
            <Callout tone="warning" title="Draft">
              This page is a draft awaiting legal review. Contact us with any questions.
            </Callout>
          </div>
        )}
        <Prose markdown={d.body} className="mt-8" />
      </Container>
    </section>
  );
}
