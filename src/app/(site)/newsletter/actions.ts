"use server";

import { getDb } from "@/db";
import { type ActionState, formValues, parseForm, runAction } from "@/lib/actions";
import { requestMeta } from "@/modules/auth/context";
import { hitRateLimit } from "@/modules/auth/rate-limit";
import { subscribe, subscribeSchema } from "@/modules/newsletter/service";

const DONE = "You're subscribed. Every email has a one-click unsubscribe link.";

export async function subscribeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honeypot: bots fill every field; people never see this one.
  if (String(formData.get("company_website_confirm") ?? "")) return { ok: true, message: DONE };
  return runAction(async () => {
    const parsed = parseForm(subscribeSchema, {
      ...formValues(formData),
      topics: formData.getAll("topics").map(String),
    });
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const { ipAddress } = await requestMeta();
    const limit = await hitRateLimit(db, `newsletter:${ipAddress ?? "unknown"}`, 5, 3600);
    if (limit.limited)
      return {
        ok: false,
        message: "Too many sign-ups from this connection. Please try again later.",
        values: formValues(formData),
      };
    await subscribe(db, parsed.data);
    return { ok: true, message: DONE };
  }, formData);
}
