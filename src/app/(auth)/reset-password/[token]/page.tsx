import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { findAuthToken } from "@/modules/auth/tokens";
import { NewPasswordForm } from "../../forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const valid = await findAuthToken(await getDb(), token, "password_reset");
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {valid ? (
        <div className="mt-6">
          <NewPasswordForm token={token} mode="reset" />
        </div>
      ) : (
        <p className="text-muted mt-3 text-sm">
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className="text-brand-700 underline">
            Request a new one
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
