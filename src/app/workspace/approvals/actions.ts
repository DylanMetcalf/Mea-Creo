"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { type ActionState, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { decideApproval } from "@/modules/approvals/service";

const schema = z.object({
  approvalId: z.uuid(),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function decideApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("approvals.decide");
    const input = schema.parse({
      approvalId: formData.get("approvalId"),
      decision: formData.get("decision"),
      comment: formData.get("comment") ?? undefined,
    });
    if (input.decision !== "approved" && !input.comment)
      return {
        ok: false,
        fieldErrors: { comment: ["Say what needs to change, so the work can be fixed."] },
      };
    const db = await getDb();
    const [approval] = await db
      .select({ organisationId: approvals.organisationId })
      .from(approvals)
      .where(eq(approvals.id, input.approvalId));
    if (!approval) throw new AppError("NOT_FOUND");
    await assertStaffClientAccess(ctx, approval.organisationId);
    await decideApproval(db, ctx, input.approvalId, input.decision, input.comment);
    refresh();
    return {
      ok: true,
      message:
        input.decision === "approved"
          ? "Approved. Any attached action has run."
          : "Recorded. A follow-up task was created.",
    };
  }, formData);
}
