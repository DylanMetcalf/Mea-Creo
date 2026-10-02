import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCards } from "@/components/site/package-cards";
import {
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  FaqList,
  Section,
} from "@/components/site/marketing";
import { getDb } from "@/db";
import { getPublicPackages } from "@/modules/website/packages";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Mea Creo packages: Foundation (once-off), Visibility, Growth and Scale monthly programmes, and custom quotations for complex requirements.",
  alternates: { canonical: "/pricing" },
};
export const dynamic = "force-dynamic";

const FAQ = [
  {
    question: "Where should we start?",
    answer:
      "Most businesses start with a Foundation: a full assessment and roadmap, so any monthly programme is built on what your business actually needs rather than guesswork.",
  },
  {
    question: "Do the prices include VAT?",
    answer:
      "Mea Creo is not VAT registered, so no VAT is added. The price shown is the price you pay.",
  },
  {
    question: "Can a package be adjusted?",
    answer:
      "Yes. Packages describe the typical scope. Your proposal sets out exactly what's included for your business, and larger or more complex work is quoted as Custom.",
  },
  {
    question: "Do you guarantee results?",
    answer:
      "No one can honestly guarantee rankings, AI mentions or leads. We commit to the work, transparent reporting and honest advice about what is and isn't working.",
  },
];

export default async function PricingPage() {
  const packages = await getPublicPackages(await getDb());
  if (!packages) notFound();
  return (
    <>
      <section className="relative isolate overflow-hidden pt-14 pb-6 sm:pt-20">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
        />
        <Container>
          <Eyebrow>Pricing</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Priced for the problem being solved, not the hours on a timesheet.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Every programme is scoped in a proposal after a strategy conversation, so you know
            exactly what you&apos;re getting before you commit.
          </p>
        </Container>
      </section>
      <Section className="pt-6 sm:pt-8">
        <PackageCards packages={packages} />
      </Section>
      <Section tone="surface">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr]">
          <DisplayHeading>Questions about pricing</DisplayHeading>
          <FaqList items={FAQ} />
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
