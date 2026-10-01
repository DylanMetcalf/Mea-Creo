"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { kickJobs } from "@/jobs/kick";
import { type ActionState, formValues, parseForm, runAction } from "@/lib/actions";
import { requestMeta } from "@/modules/auth/context";
import { hitRateLimit } from "@/modules/auth/rate-limit";
import { bookingSchema, bookPublicCall } from "@/modules/meetings/service";

export async function bookCallAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("company_website_confirm") ?? "")) return { ok: true };
  let meetingId: string | undefined;
  const state = await runAction(async () => {
    const values = formValues(formData);
    if (values.consent !== "on")
      return {
        ok: false,
        fieldErrors: { consent: ["Please confirm we may contact you about this call."] },
        values,
      };
    const parsed = parseForm(bookingSchema, values);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const { ipAddress } = await requestMeta();
    const limit = await hitRateLimit(db, `book:${ipAddress ?? "unknown"}`, 5, 3600);
    if (limit.limited)
      return {
        ok: false,
        message: "Several bookings were made from here recently. Please email us instead.",
        values,
      };
    ({ meetingId } = await bookPublicCall(db, parsed.data));
    kickJobs();
  }, formData);
  if (meetingId) redirect(`/book/confirmed`);
  return state;
}
