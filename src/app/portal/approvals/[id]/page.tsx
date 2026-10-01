import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/approvals/decision-form";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { Prose } from "@/components/ui/prose";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { canDecide } from "@/modules/approvals/service";
import { portalDecideAction } from "../../actions";

export const metadata: Metadata = { title: "Approval" };

export default async function PortalApproval({ params }: PageProps<"/portal/approvals/[id]">) {
  const ctx = await requireClient();
  const { id } = await params;
  // Scoped to the session's organisation and client-level items only.
  const [a] = await (
    await getDb()
  )
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.id, id),
        eq(approvals.organisationId, ctx.organisationId),
        eq(approvals.level, "client"),
      ),
    )
    .limit(1);
  if (!a) notFound();
  return (
    <div className="space-y-6">
      <div className="text-muted text-sm">
        <Link href="/portal/approvals" className="hover:text-ink">
          Approvals
        </Link>
      </div>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-ink text-2xl sm:text-3xl">{a.title}</h1>
          <StatusBadge kind="approval" value={a.status} />
        </div>
        {a.description && <p className="text-ink-soft mt-2">{a.description}</p>}
      </header>
      <Card>
        <CardHeader title="For your review" />
        <CardBody>
          {a.preview ? (
            <Prose markdown={a.preview} breaks />
          ) : (
            <p className="text-muted text-sm">No preview attached.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={a.requestedAction} />
        <CardBody>
          {a.status !== "pending" ? (
            <p className="text-sm">
              Decided {fmtDateTime(a.decidedAt)}
              {a.decisionComment && (
                <span className="text-muted block">&ldquo;{a.decisionComment}&rdquo;</span>
              )}
            </p>
          ) : canDecide(ctx, a) ? (
            <DecisionForm action={portalDecideAction} approvalId={a.id} />
          ) : (
            <Callout tone="info">
              Someone with approval rights in your team needs to decide this.
            </Callout>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
