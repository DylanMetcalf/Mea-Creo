import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { Container, DisplayHeading } from "@/components/site/marketing";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Call booked", robots: { index: false } };

export default function BookedPage() {
  return (
    <section className="relative isolate overflow-hidden py-20">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-0 -z-10 opacity-60"
      />
      <Container className="max-w-2xl text-center">
        <CalendarCheck className="text-brand-600 mx-auto size-10" aria-hidden />
        <DisplayHeading as="h1" className="mt-6">
          You&apos;re booked in.
        </DisplayHeading>
        <p className="text-muted mt-4 text-lg">
          A confirmation is on its way to your inbox with the details. If you need to change the
          time, just reply to that email.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/visibility-report">Get your free Visibility Report</LinkButton>
          <LinkButton href="/insights" variant="secondary">
            Read our insights
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
