import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Card } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { organisations } from "@/db/schema";
import { findAuthToken } from "@/modules/auth/tokens";
import { NewPasswordForm } from "../../forms";

export const metadata: Metadata = { title: "Accept your invitation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const db = await getDb();
  const invite = await findAuthToken(db, token, "invitation");
  const [org] = invite?.organisationId
    ? await db
        .select({ name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, invite.organisationId))
    : [];
  return (
    <Card className="p-6 sm:p-8">
      {invite ? (
        <>
          <h1 className="text-xl font-semibold">Welcome{org ? ` to ${org.name}` : ""}</h1>
          <p className="text-muted mt-1 mb-6 text-sm">
            Create your password to open your workspace.
          </p>
          <NewPasswordForm token={token} mode="invite" email={invite.email} />
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Invitation expired</h1>
          <p className="text-muted mt-2 text-sm">
            This invitation has expired or was already used. Please ask the person who invited you
            to send a new one.
          </p>
        </>
      )}
    </Card>
  );
}
