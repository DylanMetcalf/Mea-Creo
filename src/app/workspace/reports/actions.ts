"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { approvals, reports } from "@/db/schema";
import { type ActionState, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { executeApprovalAction, requestApproval } from "@/modules/approvals/service";
import { checkQuality } from "@/agents/quality";

const LIST_FIELDS = [
  "whatWeDid",
  "whatChanged",
  "whatWeLearned",
  "opportunities",
  "whatHappensNext",
  "needsFromYou",
] as const;
const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

async function loadReport(id: string, permission: "reports.write" | "reports.publish") {
  const ctx = await requireStaff(permission);
  const db = await getDb();
  const [report] = await db.select().from(reports).where(eq(reports.id, id));
  if (!report) throw new AppError("NOT_FOUND");
  await assertStaffClientAccess(ctx, report.organisationId);
  return { ctx, db, report };
}

export async function saveReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { db, report } = await loadReport(String(formData.get("reportId")), "reports.write");
    if (report.status === "published")
      return {
        ok: false,
        message: "Published reports can't be edited. Create a new version instead.",
      };
    const content = {
      ...report.content,
      headline:
        String(formData.get("headline") ?? "")
          .trim()
          .slice(0, 600) || report.content.headline,
    };
    for (const f of LIST_FIELDS) content[f] = lines(formData.get(f));
    await db
      .update(reports)
      .set({ title: String(formData.get("title") ?? report.title).slice(0, 200), content })
      .where(eq(reports.id, report.id));
    refresh();
    return { ok: true, message: "Saved." };
  }, formData);
}

function qcIssues(content: typeof reports.$inferSelect.content) {
  const text = [content.headline, ...LIST_FIELDS.flatMap((f) => content[f])].join("\n");
  return checkQuality(text).issues.filter((i) => i.severity === "block");
}

/** Sends the report for Mea Creo review (or client approval if settings say so). */
export async function submitReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { ctx, db, report } = await loadReport(String(formData.get("reportId")), "reports.write");
    const issues = qcIssues(report.content);
    if (issues.length)
      throw new AppError("VALIDATION", {
        userMessage: `Fix before review: ${issues.map((i) => `${i.rule} (${i.detail}).`).join(" ")}`,
      });
    const [existing] = await db
      .select({ id: approvals.id })
      .from(approvals)
      .where(and(eq(approvals.entityId, report.id), eq(approvals.status, "pending")));
    if (!existing)
      await requestApproval(db, {
        organisationId: report.organisationId,
        level: "internal",
        type: "report",
        title: `Publish report: ${report.title}`,
        description: "Check numbers, sources and tone before the client sees it.",
        preview: report.content.headline,
        requestedAction: "Approve & publish",
        action: { type: "report.publish", payload: { reportId: report.id } },
        entityType: "report",
        entityId: report.id,
        requestedById: ctx.user.id,
      });
    await db.update(reports).set({ status: "in_review" }).where(eq(reports.id, report.id));
    refresh();
    return { ok: true, message: "Sent for review." };
  }, formData);
}

/** Direct publish for people with publish rights. Logged like an approval. */
export async function publishReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const reportId = String(formData.get("reportId"));
    const { ctx, db, report } = await loadReport(reportId, "reports.publish");
    const issues = qcIssues(report.content);
    if (issues.length)
      throw new AppError("VALIDATION", {
        userMessage: `Fix before publishing: ${issues.map((i) => `${i.rule} (${i.detail}).`).join(" ")}`,
      });
    await executeApprovalAction(
      db,
      report.organisationId,
      { type: "report.publish", payload: { reportId } },
      userActor(ctx.user),
    );
    await db
      .update(approvals)
      .set({
        status: "approved",
        decidedById: ctx.user.id,
        decidedAt: new Date(),
        decisionComment: "Published directly.",
      })
      .where(and(eq(approvals.entityId, reportId), eq(approvals.status, "pending")));
    refresh();
    return { ok: true, message: "Published. The client has been notified." };
  }, formData);
}
