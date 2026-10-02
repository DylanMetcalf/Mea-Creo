import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckList,
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  FaqList,
  JsonLd,
  Section,
} from "@/components/site/marketing";
import { LinkButton } from "@/components/ui/button";
import { getPillar, PILLARS } from "@/content/pillars";

export function generateStaticParams() {
  return PILLARS.map((p) => ({ pillar: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[pillar]">): Promise<Metadata> {
  const pillar = getPillar((await params).pillar);
  if (!pillar) return {};
  return {
    title: `${pillar.name}: ${pillar.headline}`,
    description: pillar.metaDescription,
    alternates: { canonical: `/services/${pillar.slug}` },
    openGraph: { title: `${pillar.name} | Mea Creo`, description: pillar.metaDescription },
  };
}

export default async function PillarPage({ params }: PageProps<"/services/[pillar]">) {
  const pillar = getPillar((await params).pillar);
  if (!pillar) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const others = PILLARS.filter((p) => p.slug !== pillar.slug);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Services", item: `${siteUrl}/services` },
              {
                "@type": "ListItem",
                position: 2,
                name: pillar.name,
                item: `${siteUrl}/services/${pillar.slug}`,
              },
            ],
          },
          ...pillar.services.map((s) => ({
            "@context": "https://schema.org",
            "@type": "Service",
            name: s.name,
            description: s.description,
            provider: { "@id": `${siteUrl}/#organization` },
            areaServed: ["ZA", "Worldwide"],
          })),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: pillar.faq.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]}
      />
      <section className="relative isolate overflow-hidden pt-12 pb-14 sm:pt-20 sm:pb-20">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-70"
        />
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-muted text-sm">
              <Link href="/services" className="hover:text-ink">
                Services
              </Link>{" "}
              / <span className="text-ink">{pillar.name}</span>
            </nav>
            <Eyebrow>{pillar.tagline}</Eyebrow>
            <DisplayHeading as="h1" className="mt-3 sm:text-5xl">
              {pillar.headline}
            </DisplayHeading>
            <p className="text-muted mt-5 max-w-2xl text-lg">{pillar.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/visibility-report" size="lg">
                Get your free Visibility Report
              </LinkButton>
              <LinkButton href="/book" variant="secondary" size="lg">
                Talk to Mea Creo
              </LinkButton>
            </div>
          </div>
          <div className="rounded-card border-border bg-surface shadow-card border p-6">
            <p className="text-sm font-semibold">What you can expect</p>
            <div className="mt-4">
              <CheckList items={pillar.outcomes} />
            </div>
            <div className="bg-brand-50 text-brand-900 mt-6 flex gap-3 rounded-lg p-3 text-sm">
              <ShieldCheck className="size-5 shrink-0" aria-hidden />
              <p>{pillar.honesty}</p>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="surface">
        <div className="space-y-6">
          {pillar.services.map((service) => (
            <article
              key={service.name}
              className="border-border grid grid-cols-1 gap-6 border-t pt-8 first:border-0 first:pt-0 md:grid-cols-[1fr_1.2fr]"
            >
              <div>
                <h2 className="font-display text-2xl sm:text-3xl">{service.name}</h2>
                <p className="text-muted mt-3">{service.description}</p>
              </div>
              <div className="rounded-card bg-paper p-5">
                <p className="text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
                  Includes
                </p>
                <CheckList items={service.points} />
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr]">
          <DisplayHeading>Questions we get asked</DisplayHeading>
          <FaqList items={pillar.faq} />
        </div>
      </Section>

      <Section tone="surface">
        <p className="text-muted text-sm font-semibold">Other services</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={`/services/${p.slug}`}
              className="group rounded-card border-border bg-paper hover:border-brand-300 border p-5"
            >
              <p className="text-brand-600 text-xs font-semibold tracking-wide uppercase">
                {p.tagline}
              </p>
              <p className="font-display mt-1 text-xl">{p.name}</p>
              <p className="text-muted mt-1 text-sm">{p.headline}</p>
              <ArrowRight
                className="text-brand-700 mt-3 size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
