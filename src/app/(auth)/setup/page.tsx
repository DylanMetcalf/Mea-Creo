import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Callout, Card } from "@/components/ui/primitives";
import { getEnv } from "@/config/env";
import { getDb } from "@/db";
import { setupStatus, SETUP_TOKEN_MIN_LENGTH } from "@/modules/auth/setup";
import { SetupForm } from "../forms";

export const metadata: Metadata = { title: "First-time setup", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Creates the founder account in the browser. Gone for good once a founder exists. */
export default async function SetupPage() {
  const status = await setupStatus(await getDb(), getEnv().SETUP_TOKEN);
  if (status === "done") notFound();
  return (
    <Card className="p-6 sm:p-8">
      <p className="label-mono text-brand-700">First-time setup</p>
      <h1 className="mt-1 text-xl font-semibold">Create your founder account</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        This page works once. As soon as your account exists it closes for good, and you sign in
        normally from then on.
      </p>
      {status === "not_configured" ? (
        <Callout tone="warning" title="Setup isn't switched on yet">
          In Vercel, open Settings → Environment Variables and add <code>SETUP_TOKEN</code> with a
          code of at least {SETUP_TOKEN_MIN_LENGTH} characters that only you know. Redeploy, then
          come back to this page.
        </Callout>
      ) : (
        <SetupForm />
      )}
    </Card>
  );
}
