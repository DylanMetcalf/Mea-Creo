"use server";

import { recordAttribution } from "@/modules/leads/attribution";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { kickJobs } from "@/jobs/kick";
import { type ActionState, formValues, parseForm, runAction } from "@/lib/actions";
import { requestMeta } from "@/modules/auth/context";
import { hitRateLimit } from "@/modules/auth/rate-limit";
import { requestVisibilityReport, visibilityReportSchema } from "@/modules/audits/service";

export async function requestReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honeypot: real people never fill this hidden field.
  if (String(formData.get("company_website_confirm") ?? "")) return { ok: true };

  let token: string | undefined;
  const state = await runAction(async () => {
    const values = formValues(formData);
    const utm = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => k.startsWith("utm_") && v),
    );
    const parsed = parseForm(visibilityReportSchema, {
      ...values,
      consent: values.consent === "on" ? true : undefined,
      marketingOptIn: values.marketingOptIn === "on",
      utm,
    });
    if (!parsed.success) return { ...parsed.state, values };

    const db = await getDb();
    const { ipAddress } = await requestMeta();
    const byIp = await hitRateLimit(db, `report:ip:${ipAddress ?? "unknown"}`, 5, 60 * 60);
    const byEmail = await hitRateLimit(
      db,
      `report:email:${parsed.data.email.toLowerCase()}`,
      3,
      24 * 60 * 60,
    );
    if (byIp.limited || byEmail.limited) {
      return {
        ok: false,
        message:
          "You've requested several reports recently. Please try again later, or contact us directly.",
        values,
      };
    }

    const result = await requestVisibilityReport(db, parsed.data);
    await recordAttribution(db, result.leadId);
    token = result.token;
    kickJobs();
  }, formData);

  if (token) redirect(`/visibility-report/${token}`);
  return state;
}
