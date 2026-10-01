import type { Metadata } from "next";
import { CheckList, Container, DisplayHeading, Eyebrow } from "@/components/site/marketing";
import { getDb } from "@/db";
import { availableSlots } from "@/modules/meetings/service";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = {
  title: "Book a visibility review call",
  description:
    "Book a 30-minute call with Mea Creo to talk through your visibility, growth and next steps.",
  alternates: { canonical: "/book" },
};
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const slots = await availableSlots(await getDb(), "discovery");
  const reportToken =
    typeof sp.report === "string" && /^[A-Za-z0-9_-]{10,64}$/.test(sp.report)
      ? sp.report
      : undefined;
  return (
    <section className="py-14 sm:py-20">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Eyebrow>Talk to Mea Creo</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 sm:text-5xl">
            Book a visibility review call.
          </DisplayHeading>
          <p className="text-muted mt-5 text-lg">
            {slots.durationMinutes} minutes by video call. No pitch deck, no pressure.
          </p>
          <div className="mt-8">
            <CheckList
              items={[
                "We look at how you're found today, on search and in AI answers",
                "We talk through what's worth fixing first, and why",
                "You leave with clear next steps, whether or not we work together",
              ]}
            />
          </div>
          {reportToken && (
            <p className="bg-brand-50 text-brand-900 mt-6 rounded-lg p-3 text-sm">
              We&apos;ll have your Visibility Report open on the call.
            </p>
          )}
        </div>
        <div className="rounded-card border-border bg-surface shadow-card border p-6 sm:p-8">
          <BookingForm
            days={slots.days.map((d) => ({
              date: d.date,
              slots: d.slots.map((s) => s.toISOString()),
            }))}
            timezone={slots.timezone}
            reportToken={reportToken}
          />
        </div>
      </Container>
    </section>
  );
}
