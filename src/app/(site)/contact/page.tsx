import { Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { getDb } from "@/db";
import { getPlatformSetting } from "@/modules/settings/service";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to Mea Creo about visibility, growth and automation for your business.",
  alternates: { canonical: "/contact" },
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const c = await getPlatformSetting(await getDb(), "company");
  return (
    <section className="py-14 sm:py-20">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 sm:text-5xl">
            Talk to Mea Creo.
          </DisplayHeading>
          <p className="text-muted mt-5 text-lg">
            Tell us where you are and where you want to be. You&apos;ll hear back from Dylan, not an
            autoresponder.
          </p>
          <ul className="text-ink-soft mt-8 space-y-4">
            <li className="flex items-center gap-3">
              <Mail className="text-brand-600 size-5" aria-hidden />
              <a href={`mailto:${c.email}`} className="hover:text-brand-700">
                {c.email}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="text-brand-600 size-5" aria-hidden />
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-brand-700">
                {c.phone}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="text-brand-600 size-5" aria-hidden />
              {c.locality}, {c.region}, {c.country}. Working with clients in South Africa and
              internationally.
            </li>
          </ul>
          <div className="rounded-card border-border bg-surface mt-10 border p-5">
            <p className="font-medium">Prefer to see where you stand first?</p>
            <p className="text-muted mt-1 text-sm">
              The free Visibility Report takes about a minute and shows your biggest opportunities.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <Link href="/visibility-report" className="text-brand-700 font-medium underline">
                Get your free Visibility Report
              </Link>
              <Link href="/book" className="text-brand-700 font-medium underline">
                Book a call
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded-card border-border bg-surface shadow-card border p-6 sm:p-8">
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
