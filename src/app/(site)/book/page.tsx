import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckList, Container, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { getEnv } from "@/config/env";
import { getDb } from "@/db";
import { availableSlots } from "@/modules/meetings/service";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Book a free discovery call",
  description:
    "Book a free 30-minute call with Mea Creo about SEO, AEO and GEO, LinkedIn, social media, photography and video, websites, apps or automation.",
  alternates: { canonical: "/book" },
};
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const calendly = getEnv().CALENDLY_URL;
  const slots = calendly ? null : await availableSlots(await getDb(), "discovery");
  const reportToken =
    typeof sp.report === "string" && /^[A-Za-z0-9_-]{10,64}$/.test(sp.report)
      ? sp.report
      : undefined;
  return (
    <section className="relative isolate overflow-hidden py-14 sm:py-20">
      <div aria-hidden className="bg-aurora absolute inset-0 -z-10 opacity-60" />
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-16">
        <div>
          <Eyebrow>Talk to Mea Creo</Eyebrow>
          <DisplayHeading as="h1" className="mt-4 sm:text-[3rem]">
            Book a discovery call.
          </DisplayHeading>
          <p className="text-muted mt-5 text-lg">
            {slots?.durationMinutes ?? 30} minutes by video call. No pitch deck, no pressure.
          </p>
          <div className="mt-8">
            <CheckList
              items={[
                "Tell us what you need: visibility, LinkedIn, social media, photo and video, websites, apps or automation",
                "We look at where you are today and what's worth doing first, and why",
                "You leave with clear next steps, whether or not we work together",
              ]}
            />
          </div>
          <div className="border-border/70 bg-surface/70 mt-8 flex items-center gap-4 rounded-2xl border p-3 pr-5 backdrop-blur">
            <Image
              src="/images/dylan-metcalf.jpg"
              alt=""
              width={112}
              height={112}
              className="size-14 rounded-xl object-cover object-[50%_25%]"
            />
            <div>
              <p className="text-sm font-semibold">You&apos;ll speak with Dylan Metcalf</p>
              <p className="text-muted text-xs">Founder, Mea Creo. Not a salesperson.</p>
            </div>
          </div>
          {reportToken && (
            <p className="bg-brand-50 text-brand-900 mt-6 rounded-lg p-3 text-sm">
              We&apos;ll have your Visibility Report open on the call.
            </p>
          )}
        </div>
        <div className="border-border/80 bg-surface shadow-raised min-w-0 rounded-[22px] border p-6 sm:p-8">
          {calendly ? (
            <>
              <iframe
                title="Book a call with Mea Creo (Calendly)"
                src={`${calendly}?embed_type=Inline&embed_domain=${new URL(getEnv().NEXT_PUBLIC_SITE_URL).host}&hide_gdpr_banner=1&primary_color=2e8050`}
                className="h-[700px] w-full rounded-xl"
                loading="lazy"
              />
              <p className="text-muted mt-3 text-xs">
                Scheduling by Calendly. Prefer to write?{" "}
                <Link href="/contact" className="underline">
                  Send a message
                </Link>{" "}
                or{" "}
                <a href={calendly} className="underline" target="_blank" rel="noreferrer">
                  open the booking page
                </a>
                .
              </p>
            </>
          ) : (
            slots && (
              <BookingForm
                days={slots.days.map((d) => ({
                  date: d.date,
                  slots: d.slots.map((s) => s.toISOString()),
                }))}
                timezone={slots.timezone}
                reportToken={reportToken}
              />
            )
          )}
        </div>
      </Container>
    </section>
  );
}
