import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Card, CardBody } from "@/components/ui/primitives";
import { siteConfig } from "@/config/site";
import { verifyUnsubscribeToken } from "@/modules/outreach/identifiers";
import { unsubscribeAction } from "./actions";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * Opt-out page linked from every outreach email. A button (rather than the link alone)
 * stops email security scanners from unsubscribing people by following links. The
 * page reveals nothing about the person or what we hold.
 */
export default async function UnsubscribePage({ params }: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  if (!verifyUnsubscribeToken(token)) notFound();
  return (
    <Card className="mx-auto max-w-lg">
      <CardBody>
        <h1 className="font-display text-ink text-3xl">Stop hearing from Mea Creo</h1>
        <p className="text-ink-soft mt-3">
          Confirm below and we won&apos;t contact you again by email, phone, LinkedIn or any other
          channel. You don&apos;t need to give a reason.
        </p>
        <ActionForm action={unsubscribeAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <SubmitButton>Unsubscribe me</SubmitButton>
        </ActionForm>
        <p className="text-muted mt-6 text-sm">
          Questions about your information? Email{" "}
          <a className="underline" href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </a>
          . See our{" "}
          <Link className="underline" href="/legal/privacy">
            privacy policy
          </Link>
          .
        </p>
      </CardBody>
    </Card>
  );
}
