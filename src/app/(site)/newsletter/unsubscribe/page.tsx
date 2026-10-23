import type { Metadata } from "next";
import Link from "next/link";
import { Container, DisplayHeading } from "@/components/site/marketing";
import { getDb } from "@/db";
import { unsubscribe } from "@/modules/newsletter/service";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/newsletter/unsubscribe">) {
  const token = (await searchParams).token;
  const done = typeof token === "string" && (await unsubscribe(await getDb(), token));
  return (
    <section className="py-20">
      <Container className="max-w-2xl">
        <DisplayHeading as="h1" className="sm:text-4xl">
          {done ? "You've been unsubscribed." : "That unsubscribe link isn't valid."}
        </DisplayHeading>
        <p className="text-muted mt-4 text-lg">
          {done
            ? "You won't receive the Mea Creo newsletter again. Sorry to see you go."
            : "It may have been copied incompletely. Reply to any newsletter email or contact us and we'll remove you straight away."}
        </p>
        <Link href="/" className="text-brand-700 mt-8 inline-block font-medium underline">
          Back to the home page
        </Link>
      </Container>
    </section>
  );
}
