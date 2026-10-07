import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import {
  clients,
  DELIVERABLE_KINDS,
  type DeliverableKind,
  deliverables,
  type QaCheck,
  type QaStage,
  QA_STAGES,
  timelineEntries,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { type Actor, logActivity } from "@/modules/activity/log";
import { requestApproval } from "@/modules/approvals/service";
import { getPlatformSetting } from "@/modules/settings/service";

/**
 * Quality assurance pipeline (handoff §34):
 * DRAFT → INTERNAL REVIEW → QA → CLIENT REVIEW → APPROVED → PUBLISHED.
 *
 * - Each deliverable gets the checklist from Settings → Quality for its kind.
 * - Nothing leaves QA until every check is ticked.
 * - Client review is a portal approval; "changes requested" returns it to internal review.
 */

export const QA_STAGE_LABELS: Record<QaStage, string> = {
  draft: "Draft",
  internal_review: "Internal review",
  qa: "QA",
  client_review: "Client review",
  approved: "Approved",
  published: "Published",
};

export const KIND_LABELS: Record<DeliverableKind, string> = {
  content: "Content",
  website: "Website",
  seo: "SEO",
  geo: "GEO",
  aeo: "AEO",
  social: "Social",
  ads: "Ads",
  design: "Design",
  report: "Report",
  document: "Document",
  other: "Other",
};

const who = (actor: Actor) => actor.label ?? "Mea Creo";

export async function checklistFor(db: DbOrTx, kind: DeliverableKind): Promise<QaCheck[]> {
  const { checks } = await getPlatformSetting(db, "qa");
  return checks
    .filter((c) => c.kinds.length === 0 || c.kinds.includes(kind))
    .map((c) => ({ key: c.key, label: c.label, done: false }));
}

export const deliverableSchema = z.object({
  organisationId: z.uuid("Choose a client."),
  title: z.string().trim().min(3, "Give it a title.").max(200),
  kind: z.enum(DELIVERABLE_KINDS),
  link: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || null),
  dueAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T17:00:00+02:00`) : null)),
});

export async function createDeliverable(
  db: DbOrTx,
  input: z.infer<typeof deliverableSchema>,
  actor: Actor & { userId: string },
): Promise<string> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(deliverables)
    .values({
      ...input,
      checklist: await checklistFor(db, input.kind),
      history: [{ stage: "draft", at: now, by: who(actor) }],
      ownerId: actor.userId,
      createdById: actor.userId,
    })
    .returning({ id: deliverables.id });
  await logActivity(db, actor, {
    organisationId: input.organisationId,
    action: "deliverable.created",
    summary: `Created deliverable "${input.title}"`,
    entityType: "deliverable",
    entityId: row.id,
  });
  return row.id;
}

export async function getDeliverable(db: DbOrTx, id: string) {
  const [row] = await db.select().from(deliverables).where(eq(deliverables.id, id)).limit(1);
  return row ?? null;
}

export async function setCheck(
  db: DbOrTx,
  id: string,
  key: string,
  done: boolean,
  actor: Actor,
): Promise<void> {
  const d = await getDeliverable(db, id);
  if (!d) throw new AppError("NOT_FOUND");
  if (d.stage !== "qa" && d.stage !== "internal_review")
    throw new AppError("CONFLICT", {
      userMessage: "Checks can be changed during internal review and QA.",
    });
  const checklist = d.checklist.map((c) =>
    c.key === key
      ? {
          ...c,
          done,
          by: done ? who(actor) : undefined,
          at: done ? new Date().toISOString() : undefined,
        }
      : c,
  );
  await db.update(deliverables).set({ checklist }).where(eq(deliverables.id, id));
}

/** Which stage comes next, and what blocks it. */
export function nextStage(d: { stage: QaStage; checklist: QaCheck[] }): {
  next: QaStage | null;
  blocked?: string;
} {
  const i = QA_STAGES.indexOf(d.stage);
  const next = QA_STAGES[i + 1] ?? null;
  if (d.stage === "qa") {
    const open = d.checklist.filter((c) => !c.done).length;
    if (open) return { next, blocked: `${open} check${open === 1 ? "" : "s"} still open.` };
  }
  if (d.stage === "client_review")
    return { next, blocked: "Waiting for the client's decision in their portal." };
  return { next };
}

/** Moves a deliverable forward one stage (or back to an earlier one, with a note). */
export async function moveDeliverable(
  db: DbOrTx,
  id: string,
  to: QaStage,
  actor: Actor & { userId?: string },
  note?: string,
): Promise<void> {
  const d = await getDeliverable(db, id);
  if (!d) throw new AppError("NOT_FOUND");
  const from = QA_STAGES.indexOf(d.stage);
  const target = QA_STAGES.indexOf(to);
  if (target === from) return;
  if (target > from) {
    const { next, blocked } = nextStage(d);
    if (next !== to) throw new AppError("CONFLICT", { userMessage: "Move one stage at a time." });
    if (blocked) throw new AppError("CONFLICT", { userMessage: blocked });
  } else if (!note?.trim()) {
    throw new AppError("VALIDATION", { userMessage: "Say why it's going back a stage." });
  }

  const history = [
    ...d.history,
    { stage: to, at: new Date().toISOString(), by: who(actor), ...(note ? { note } : {}) },
  ];
  let stage: QaStage = to;
  let approvalId = d.approvalId;
  if (to === "client_review") {
    const approval = await requestApproval(db, {
      organisationId: d.organisationId,
      level: "client",
      type: d.kind === "report" ? "report" : d.kind === "website" ? "website_change" : "content",
      title: `Review: ${d.title}`,
      description:
        [d.notes, d.link ? `Link: ${d.link}` : null].filter(Boolean).join("\n\n") || undefined,
      preview: d.link ?? undefined,
      requestedAction: "Approve",
      entityType: "deliverable",
      entityId: d.id,
      requestedById: actor.userId,
      action: { type: "deliverable.approve", payload: { deliverableId: d.id } },
    });
    approvalId = approval.id;
    // Clients set to automatic approval for this type skip the wait.
    if (!approval.pending) {
      stage = "approved";
      history.push({ stage: "approved", at: new Date().toISOString(), by: "Automatic approval" });
    }
  }
  if (target < from) {
    // Going back re-opens the checks.
    await db
      .update(deliverables)
      .set({ checklist: d.checklist.map((c) => ({ key: c.key, label: c.label, done: false })) })
      .where(eq(deliverables.id, id));
  }
  await db
    .update(deliverables)
    .set({
      stage,
      history,
      approvalId,
      ...(stage === "published" ? { publishedAt: new Date() } : {}),
    })
    .where(eq(deliverables.id, id));
  if (stage === "published")
    await db.insert(timelineEntries).values({
      organisationId: d.organisationId,
      kind: "work",
      title: `${d.title} published`,
      link: d.link,
      visibility: "client",
    });
  await logActivity(db, actor, {
    organisationId: d.organisationId,
    action: "deliverable.stage",
    summary: `"${d.title}": ${QA_STAGE_LABELS[d.stage]} → ${QA_STAGE_LABELS[stage]}`,
    entityType: "deliverable",
    entityId: id,
    before: { stage: d.stage },
    after: { stage },
    reason: note,
  });
}

/** Called by the approvals module when the client decides. */
export async function applyClientDecision(
  db: DbOrTx,
  organisationId: string,
  deliverableId: string,
  approved: boolean,
  by: string,
  comment?: string,
): Promise<void> {
  const d = await getDeliverable(db, deliverableId);
  if (!d || d.organisationId !== organisationId || d.stage !== "client_review") return;
  const stage: QaStage = approved ? "approved" : "internal_review";
  await db
    .update(deliverables)
    .set({
      stage,
      history: [
        ...d.history,
        { stage, at: new Date().toISOString(), by, ...(comment ? { note: comment } : {}) },
      ],
      ...(approved
        ? {}
        : { checklist: d.checklist.map((c) => ({ key: c.key, label: c.label, done: false })) }),
    })
    .where(eq(deliverables.id, deliverableId));
}

/** Deliverables for the clients a staff member can see ("all" or a list of organisation ids). */
export async function listDeliverables(db: DbOrTx, scope: "all" | string[]) {
  if (scope !== "all" && !scope.length) return [];
  return db
    .select({ d: deliverables, clientName: clients.name })
    .from(deliverables)
    .innerJoin(clients, eq(clients.organisationId, deliverables.organisationId))
    .where(scope === "all" ? undefined : inArray(deliverables.organisationId, scope))
    .orderBy(asc(deliverables.dueAt), asc(deliverables.createdAt));
}
