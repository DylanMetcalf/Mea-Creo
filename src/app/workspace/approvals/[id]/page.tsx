import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/approvals/decision-form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
} from "@/components/ui/primitives";
import { Prose } from "@/components/ui/prose";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { approvals, organisations, users } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { canDecide, LEVEL_LABELS } from "@/modules/approvals/service";
import { decideApprovalAction } from "../actions";

export const metadata: Metadata = { title: "Approval" };

const ACTION_LABELS: Record<string, string> = {
  "report.publish": "Publishes the report to the client portal.",
  "content.approve": "Marks the content as approved and ready to schedule.",
  "outreach.send":
    "Re-checks opt-outs and the daily limit, then sends the email with an unsubscribe link. LinkedIn, phone and WhatsApp messages become a task for you to send yourself.",
  "task.create": "Creates a task for the team.",
};

export default async function ApprovalPage({ params }: PageProps<"/workspace/approvals/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ a: approvals, org: organisations.name })
    .from(approvals)
    .innerJoin(organisations, eq(organisations.id, approvals.organisationId))
    .where(eq(approvals.id, id))
    .limit(1);
  if (!row) notFound();
  const { a, org } = row;
  await assertStaffClientAccess(ctx, a.organisationId);
  const [decider] = a.decidedById
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, a.decidedById))
    : [];
  const [requester] = a.requestedById
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, a.requestedById))
    : [];

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/approvals" className="hover:text-ink">
          Approvals
        </Link>{" "}
        / {a.title}
      </div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
          <StatusBadge kind="approval" value={a.status} />
          <Badge tone="neutral">{LEVEL_LABELS[a.level]}</Badge>
        </div>
        <p className="text-muted mt-1 text-sm">
          <Link
            href={`/workspace/clients/${a.organisationId}`}
            className="text-brand-700 hover:underline"
          >
            {org}
          </Link>{" "}
          · {statusLabel(a.type)} · requested {fmtDateTime(a.createdAt)} by{" "}
          {a.requestedByAgent ? `the ${a.requestedByAgent} agent` : (requester?.name ?? "the team")}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {a.description && <p className="text-ink-soft max-w-3xl">{a.description}</p>}
          <Card>
            <CardHeader title="What you're approving" />
            <CardBody>
              {a.preview ? (
                <Prose markdown={a.preview} breaks />
              ) : (
                <p className="text-muted text-sm">No preview attached.</p>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Decision" />
            <CardBody className="space-y-4">
              <p className="text-ink-soft text-sm">
                {a.action
                  ? (ACTION_LABELS[a.action.type] ?? "Runs the attached action.")
                  : "No automatic action: approving records the decision."}
              </p>
              {a.status !== "pending" ? (
                <DescriptionList
                  items={[
                    ["Decision", statusLabel(a.status)],
                    ["By", decider?.name ?? null],
                    ["When", a.decidedAt ? fmtDateTime(a.decidedAt) : null],
                    ["Comment", a.decisionComment],
                  ]}
                />
              ) : canDecide(ctx, a) ? (
                <DecisionForm
                  action={decideApprovalAction}
                  approvalId={a.id}
                  approveLabel={a.level === "manual" ? "Mark as done" : "Approve"}
                />
              ) : a.level === "client" ? (
                <Callout tone="info" title="Waiting on the client">
                  They approve this in their portal. You&apos;ll be notified when they decide.
                </Callout>
              ) : (
                <Callout tone="warning">Your role can&apos;t decide approvals.</Callout>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
