import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  type ApprovalAction,
  type ApprovalLevel,
  type ApprovalType,
  approvals,
  contentItems,
  leads,
  reports,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/urls";
import { type Actor, logActivity } from "@/modules/activity/log";
import type { AuthContext } from "@/modules/auth/context";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { emitEvent, notifyClient, notifyStaff } from "@/modules/notifications/service";
import { getPlatformSetting } from "@/modules/settings/service";

/** Action types that can never run without a human decision, whatever the settings say. */
export const HARD_LOCKED_TYPES: ApprovalType[] = ["budget"];
export const HARD_LOCKED_ACTIONS = [
  "payment",
  "refund",
  "contract",
  "cancellation",
  "budget.change",
];

export const LEVEL_LABELS: Record<ApprovalLevel, string> = {
  automatic: "Automatic",
  client: "Client approval",
  internal: "Mea Creo approval",
  manual: "Manual action",
};

/** Resolves the effective level: default → admin override → hard lock. */
export async function effectiveLevel(
  db: DbOrTx,
  actionType: string,
  approvalType: ApprovalType,
  requested: ApprovalLevel,
): Promise<ApprovalLevel> {
  const automation = await getPlatformSetting(db, "automation");
  let level = (automation.approvalOverrides[actionType] as ApprovalLevel | undefined) ?? requested;
  const locked =
    HARD_LOCKED_TYPES.includes(approvalType) ||
    HARD_LOCKED_ACTIONS.some((a) => actionType.startsWith(a));
  if (locked && level === "automatic") level = requested === "automatic" ? "internal" : requested;
  return level;
}

export interface ApprovalRequest {
  organisationId: string;
  level: ApprovalLevel;
  type: ApprovalType;
  title: string;
  description?: string;
  preview?: string;
  requestedAction?: string;
  action?: ApprovalAction;
  entityType?: string;
  entityId?: string;
  requestedById?: string;
  requestedByAgent?: string;
  runId?: string;
  dueAt?: Date;
}

/**
 * Creates an approval, or executes immediately when the effective level is automatic.
 * Returns the approval id and whether it still needs a decision.
 */
export async function requestApproval(
  db: DbOrTx,
  request: ApprovalRequest,
): Promise<{ id: string; pending: boolean }> {
  const level = await effectiveLevel(
    db,
    request.action?.type ?? request.type,
    request.type,
    request.level,
  );
  const [approval] = await db
    .insert(approvals)
    .values({
      organisationId: request.organisationId,
      level,
      type: request.type,
      title: request.title,
      description: request.description,
      preview: request.preview,
      requestedAction: request.requestedAction ?? "Approve",
      action: request.action,
      entityType: request.entityType,
      entityId: request.entityId,
      requestedById: request.requestedById,
      requestedByAgent: request.requestedByAgent,
      runId: request.runId,
      dueAt: request.dueAt,
      status: level === "automatic" ? "approved" : "pending",
      decidedAt: level === "automatic" ? new Date() : null,
      decisionComment:
        level === "automatic" ? "Approved automatically (automation level: automatic)." : null,
    })
    .returning();

  if (level === "automatic") {
    if (approval.action)
      await executeApprovalAction(db, approval.organisationId, approval.action, {
        type: "system",
        label: "Automation",
      });
    return { id: approval.id, pending: false };
  }

  await emitEvent(db, "approval.requested", request.organisationId, {
    approvalId: approval.id,
    level,
  });
  if (level === "client") {
    const userIds = await notifyClient(db, request.organisationId, {
      kind: "approval.requested",
      title: "Needs your approval",
      body: request.title,
      link: `/portal/approvals/${approval.id}`,
    });
    if (userIds.length) {
      const { users } = await import("@/db/schema");
      const { inArray } = await import("drizzle-orm");
      const recipients = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const r of recipients) {
        await sendEmail(db, {
          to: r,
          template: "approvalRequested",
          category: "notification",
          organisationId: request.organisationId,
          email: emailTemplates.approvalRequested({
            name: r.name,
            title: request.title,
            url: absoluteUrl(`/portal/approvals/${approval.id}`),
          }),
          idempotencyKey: `approval:${approval.id}:${r.email}`,
        });
      }
    }
  } else {
    await notifyStaff(
      db,
      {
        kind: "approval.requested",
        title: `Approval needed: ${request.title}`,
        link: `/workspace/approvals/${approval.id}`,
        organisationId: request.organisationId,
      },
      ["founder", "manager"],
    );
  }
  return { id: approval.id, pending: true };
}

export type Decision = "approved" | "changes_requested" | "rejected";

export function canDecide(
  ctx: AuthContext,
  approval: { organisationId: string; level: ApprovalLevel },
): boolean {
  if (ctx.kind === "client")
    return (
      approval.level === "client" &&
      approval.organisationId === ctx.organisationId &&
      ctx.can("portal.approve")
    );
  return (
    (approval.level === "internal" || approval.level === "manual") && ctx.can("approvals.decide")
  );
}

/** Records a human decision and, on approval, executes the attached action. */
export async function decideApproval(
  db: DbOrTx,
  ctx: AuthContext,
  approvalId: string,
  decision: Decision,
  comment?: string,
): Promise<void> {
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
  if (!approval) throw new AppError("NOT_FOUND");
  if (!canDecide(ctx, approval)) {
    throw new AppError("FORBIDDEN", {
      userMessage:
        approval.level === "client"
          ? "This item needs the client's approval in their portal."
          : "You don't have permission to decide this approval.",
    });
  }
  if (approval.status !== "pending")
    throw new AppError("CONFLICT", { userMessage: "This item has already been decided." });

  const actor: Actor =
    ctx.kind === "client"
      ? { type: "client", id: ctx.user.id, label: ctx.user.name }
      : { type: "user", id: ctx.user.id, label: ctx.user.name };
  await db
    .update(approvals)
    .set({
      status: decision,
      decidedById: ctx.user.id,
      decidedAt: new Date(),
      decisionComment: comment || null,
    })
    .where(and(eq(approvals.id, approvalId), eq(approvals.status, "pending")));

  await logActivity(db, actor, {
    organisationId: approval.organisationId,
    action: `approval.${decision}`,
    summary: `${actor.label} ${decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "requested changes to"} "${approval.title}"`,
    entityType: "approval",
    entityId: approvalId,
    before: { status: "pending" },
    after: { status: decision },
    reason: comment,
  });
  await emitEvent(db, "approval.completed", approval.organisationId, { approvalId, decision });

  if (decision === "approved" && approval.action) {
    await executeApprovalAction(db, approval.organisationId, approval.action, actor);
  }
  if (decision !== "approved") {
    await db.insert(tasks).values({
      organisationId: approval.organisationId,
      title: `${decision === "rejected" ? "Rejected" : "Changes requested"}: ${approval.title}`,
      description: comment || "No comment given.",
      priority: "high",
      source: "workflow",
      status: "ready",
    });
  }
  if (ctx.kind === "client") {
    await notifyStaff(db, {
      kind: `approval.${decision}`,
      title: `${ctx.organisationName}: ${decision.replace("_", " ")}`,
      body: approval.title,
      link: `/workspace/approvals/${approvalId}`,
      organisationId: approval.organisationId,
    });
  }
}

/** Executes what an approval authorises. Only these action types exist; anything else is a task for a person. */
export async function executeApprovalAction(
  db: DbOrTx,
  organisationId: string,
  action: ApprovalAction,
  actor: Actor,
): Promise<void> {
  const p = action.payload;
  switch (action.type) {
    case "report.publish": {
      await db
        .update(reports)
        .set({ status: "published", publishedAt: new Date() })
        .where(and(eq(reports.id, String(p.reportId)), eq(reports.organisationId, organisationId)));
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, String(p.reportId)));
      if (report) {
        await db.insert(timelineEntries).values({
          organisationId,
          kind: "report",
          title: `${report.title} published`,
          link: `/portal/reports/${report.id}`,
          visibility: "client",
        });
        await notifyClient(db, organisationId, {
          kind: "report.ready",
          title: "New report available",
          body: report.title,
          link: `/portal/reports/${report.id}`,
        });
        await emitEvent(db, "report.generated", organisationId, { reportId: report.id });
      }
      break;
    }
    case "content.approve": {
      await db
        .update(contentItems)
        .set({ stage: "scheduled" })
        .where(
          and(
            eq(contentItems.id, String(p.contentItemId)),
            eq(contentItems.organisationId, organisationId),
          ),
        );
      await db.insert(tasks).values({
        organisationId,
        title: `Publish approved content: ${String(p.title ?? "")}`,
        status: "ready",
        source: "workflow",
        visibility: "client",
      });
      break;
    }
    case "outreach.send": {
      const { sendApprovedCommunication } = await import("@/modules/outreach/service");
      let communicationId = p.communicationId ? String(p.communicationId) : null;
      if (!communicationId && p.leadId) {
        // Approvals created before the outreach module: record the message first so it
        // goes through the same compliance checks and history.
        const { communications } = await import("@/db/schema");
        const [lead] = await db
          .select()
          .from(leads)
          .where(eq(leads.id, String(p.leadId)))
          .limit(1);
        if (!lead) break;
        const [comm] = await db
          .insert(communications)
          .values({
            leadId: lead.id,
            direction: "outbound",
            channel: "email",
            purpose: "follow_up",
            status: "approved",
            toName: lead.contactName,
            toAddress: lead.email,
            subject: String(p.subject ?? lead.company),
            body: String(p.body ?? ""),
          })
          .returning({ id: communications.id });
        communicationId = comm.id;
      }
      if (communicationId) {
        const result = await sendApprovedCommunication(db, communicationId);
        if (result.status === "blocked" || result.status === "failed")
          await notifyStaff(db, {
            kind: "outreach.blocked",
            title: `Message not sent: ${result.reason ?? result.status}`,
            link: p.leadId ? `/workspace/leads/${String(p.leadId)}` : "/workspace/outreach",
            organisationId,
          });
      }
      break;
    }
    case "task.create": {
      await db.insert(tasks).values({
        organisationId,
        title: String(p.title),
        description: p.description ? String(p.description) : null,
        status: "ready",
        source: "workflow",
        visibility: (p.visibility as "client" | "internal") ?? "internal",
      });
      break;
    }
    default: {
      // Actions without an automated executor (e.g. website changes, ad budget changes)
      // become a task for a person to carry out.
      await db.insert(tasks).values({
        organisationId,
        title: `Carry out approved change: ${String(p.title ?? action.type)}`,
        description: p.description ? String(p.description) : null,
        status: "ready",
        priority: "high",
        source: "workflow",
        visibility: "client",
      });
    }
  }
  await logActivity(db, actor, {
    organisationId,
    action: `action.${action.type}`,
    summary: `Executed approved action: ${action.type}`,
    after: p,
  });
}
