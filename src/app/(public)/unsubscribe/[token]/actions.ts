"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { type ActionState, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { requestMeta } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/auth/rate-limit";
import { verifyUnsubscribeToken } from "@/modules/outreach/identifiers";
import { suppressLead } from "@/modules/outreach/service";

export async function unsubscribeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const meta = await requestMeta();
    const db = await getDb();
    await enforceRateLimit(db, `unsubscribe:${meta.ipAddress ?? "unknown"}`, 20, 3600);
    const leadId = verifyUnsubscribeToken(String(formData.get("token") ?? ""));
    if (!leadId) throw new AppError("NOT_FOUND", { userMessage: "This link isn't valid." });
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId));
    // Already removed (or the record was deleted): nothing more to do, and nothing to reveal.
    if (lead) await suppressLead(db, leadId, "opt_out", "unsubscribe link");
    return { ok: true, message: "Done. You won't hear from Mea Creo again." };
  }, formData);
}
