import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import {
  clients,
  domainEvents,
  leads,
  memberships,
  organisations,
  tasks,
  users,
} from "@/db/schema";
import { absoluteUrl } from "@/lib/urls";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { logger } from "@/lib/logger";
import { logActivity, SYSTEM } from "@/modules/activity/log";
import { recomputeHealth } from "@/modules/clients/health";
import { getPlatformOrganisation, getPlatformSetting } from "@/modules/settings/service";

export type Maturity = "manual" | "assisted" | "automated";

export interface WorkflowRule {
  id: string;
  name: string;
  when: string;
  description: string;
  then: string[];
  /** Default maturity: automated runs actions; assisted creates a task; manual only logs. */
  defaultMaturity: Maturity;
  handler: (db: DbOrTx, event: typeof domainEvents.$inferSelect) => Promise<void>;
}

/**
 * Built-in workflow rules (WHEN event THEN actions). Billing, approvals, onboarding and
 * payments already act in their own modules; these rules add the follow-on automation.
 */
export const WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: "lead-assign-owner",
    name: "Assign new leads",
    when: "lead.created",
    description:
      "New leads without an owner are assigned to the founder so nothing falls through the cracks.",
    then: ["Assign owner", "Create a follow-up task"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      const leadId = String(event.payload.leadId ?? "");
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead || lead.ownerId) return;
      const platform = await getPlatformOrganisation(db);
      const [founder] = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(eq(memberships.organisationId, platform.id))
        .limit(1);
      if (!founder) return;
      await db.update(leads).set({ ownerId: founder.userId }).where(eq(leads.id, leadId));
      await db.insert(tasks).values({
        organisationId: platform.id,
        title: `Follow up with ${lead.company}`,
        assigneeId: founder.userId,
        dueAt: new Date(Date.now() + 2 * 86400_000),
        source: "workflow",
        sourceRef: `lead:${leadId}`,
      });
    },
  },
  {
    id: "lead-email-alert",
    name: "Email new enquiries",
    when: "lead.created",
    description:
      "Emails the founder and managers about every new enquiry, and confirms receipt to people who used the contact form.",
    then: ["Email Mea Creo", "Confirm to the enquirer"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      const leadId = String(event.payload.leadId ?? "");
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
      if (!lead) return;
      const platform = await getPlatformOrganisation(db);
      const staff = await db
        .select({ id: users.id, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.organisationId, platform.id),
            inArray(memberships.role, ["founder", "manager"]),
          ),
        );
      const source = lead.source === "visibility_report" ? "Visibility Report request" : "Enquiry";
      const body = [
        `${lead.contactName ?? "Someone"} at ${lead.company}${lead.email ? ` (${lead.email})` : ""}.`,
        lead.message ?? (lead.website ? `Website: ${lead.website}` : ""),
      ]
        .filter(Boolean)
        .join(" ");
      // Idempotency keys make retries safe: each person gets one email per lead.
      for (const member of staff)
        await sendEmail(db, {
          to: { email: member.email },
          template: "staffNotification",
          email: emailTemplates.staffNotification({
            title: `${source}: ${lead.company}`,
            body,
            url: absoluteUrl(`/workspace/leads/${lead.id}`),
          }),
          category: "transactional",
          idempotencyKey: `lead-alert:${lead.id}:${member.id}`,
          replyTo: lead.email ?? undefined,
        });
      if (lead.source === "contact_form" && lead.email)
        await sendEmail(db, {
          to: { email: lead.email, name: lead.contactName ?? undefined },
          template: "enquiryReceived",
          email: emailTemplates.enquiryReceived({ name: lead.contactName ?? "there" }),
          category: "transactional",
          idempotencyKey: `enquiry-received:${lead.id}`,
        });
    },
  },
  {
    id: "invoice-overdue-task",
    name: "Overdue invoice follow-up",
    when: "invoice.overdue",
    description:
      "When an invoice becomes overdue, the client is notified (billing), the account manager gets a follow-up task, and health is recalculated.",
    then: [
      "Notify client",
      "Notify admin",
      "Create follow-up task",
      "Recalculate client health",
      "Pause configured services after the grace period",
    ],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (!event.organisationId) return;
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.organisationId, event.organisationId))
        .limit(1);
      await db.insert(tasks).values({
        organisationId: event.organisationId,
        title: "Follow up on overdue invoice",
        priority: "urgent",
        assigneeId: client?.accountManagerId ?? null,
        dueAt: new Date(Date.now() + 86400_000),
        source: "workflow",
        sourceRef: `event:${event.id}`,
      });
      await recomputeHealth(db, event.organisationId);
    },
  },
  {
    id: "payment-health",
    name: "Payment received",
    when: "payment.completed",
    description:
      "Recalculates client health after a payment. Service restoration happens in billing.",
    then: ["Restore paused services", "Recalculate client health"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (event.organisationId) await recomputeHealth(db, event.organisationId);
    },
  },
  {
    id: "approval-completed-health",
    name: "Approval decided",
    when: "approval.completed",
    description: "Keeps client health current when approvals are decided.",
    then: ["Recalculate client health"],
    defaultMaturity: "automated",
    handler: async (db, event) => {
      if (event.organisationId) {
        const [org] = await db
          .select({ kind: organisations.kind })
          .from(organisations)
          .where(eq(organisations.id, event.organisationId));
        if (org?.kind === "client") await recomputeHealth(db, event.organisationId);
      }
    },
  },
  {
    id: "run-growth-monthly",
    name: "Monthly client cycle",
    when: "monthly_cycle.started",
    description:
      "On the configured day, a monthly review run is created for every active client, producing draft reports for approval.",
    then: [
      "Run Monthly Client Review per active client",
      "Request internal approval for each report",
    ],
    defaultMaturity: "assisted",
    handler: async (db) => {
      const { createRun } = await import("@/modules/runs/engine");
      const active = await db
        .select({ organisationId: clients.organisationId })
        .from(clients)
        .where(eq(clients.lifecycle, "active"));
      for (const c of active)
        await createRun(db, {
          organisationId: c.organisationId,
          kind: "monthly_client_review",
          trigger: "schedule",
        });
    },
  },
];

export async function workflowMaturity(db: DbOrTx, ruleId: string): Promise<Maturity> {
  const automation = await getPlatformSetting(db, "automation");
  const override = automation.approvalOverrides[`workflow:${ruleId}`];
  if (override === "automatic") return "automated";
  if (override === "internal" || override === "client") return "assisted";
  if (override === "manual") return "manual";
  return WORKFLOW_RULES.find((r) => r.id === ruleId)?.defaultMaturity ?? "manual";
}

/**
 * Delivers unprocessed events to matching rules. Events are claimed atomically
 * (FOR UPDATE SKIP LOCKED), so concurrent runners (inline after a request, the worker,
 * the cron endpoint) never handle the same event twice. A rule's error is recorded on the
 * event and logged; handlers stay idempotent regardless.
 */
export async function processDomainEvents(db: Db, limit = 100): Promise<number> {
  const emergency = await getPlatformSetting(db, "emergency");
  const claim = db
    .select({ id: domainEvents.id })
    .from(domainEvents)
    .where(isNull(domainEvents.processedAt))
    .orderBy(asc(domainEvents.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });
  const pending = (
    await db
      .update(domainEvents)
      .set({ processedAt: new Date() })
      .where(inArray(domainEvents.id, claim))
      .returning()
  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const event of pending) {
    let error: string | null = null;
    if (!emergency.pauseAllAutomation) {
      for (const rule of WORKFLOW_RULES.filter((r) => r.when === event.type)) {
        try {
          const maturity = await workflowMaturity(db, rule.id);
          if (maturity === "automated") await rule.handler(db, event);
          else if (maturity === "assisted") {
            const platform = await getPlatformOrganisation(db);
            await db.insert(tasks).values({
              organisationId: event.organisationId ?? platform.id,
              title: `Workflow "${rule.name}": review and run`,
              description: rule.then.join(" → "),
              source: "workflow",
              sourceRef: `event:${event.id}`,
            });
          }
          await logActivity(db, SYSTEM, {
            organisationId: event.organisationId,
            action: `workflow.${rule.id}`,
            summary: `Workflow "${rule.name}" (${maturity}) handled ${event.type}`,
          });
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          logger.error({ rule: rule.id, eventId: event.id, err: error }, "workflow rule failed");
        }
      }
    }
    await db.update(domainEvents).set({ error }).where(eq(domainEvents.id, event.id));
  }
  return pending.length;
}
