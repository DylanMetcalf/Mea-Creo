"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { leadActivities, leads } from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { type ActionState, formValues, optionalText, parseForm, runAction } from "@/lib/actions";
import { requestMeta } from "@/modules/auth/context";
import { hitRateLimit } from "@/modules/auth/rate-limit";
import { emitEvent, notifyStaff } from "@/modules/notifications/service";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email address."),
  company: z.string().trim().min(2, "Please enter your company.").max(160),
  website: optionalText(300),
  phone: optionalText(40),
  message: z.string().trim().min(10, "Tell us a little about what you need.").max(3000),
  consent: z.literal("on", { error: "Please confirm we may contact you about your enquiry." }),
});

export async function contactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("company_website_confirm") ?? ""))
    return { ok: true, message: "Thanks. We'll be in touch." };
  return runAction(async () => {
    const parsed = parseForm(contactSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const { ipAddress } = await requestMeta();
    const limit = await hitRateLimit(db, `contact:${ipAddress ?? "unknown"}`, 5, 3600);
    if (limit.limited)
      return {
        ok: false,
        message: "You've sent several messages recently. Please email us directly instead.",
        values: formValues(formData),
      };
    const [lead] = await db
      .insert(leads)
      .values({
        company: d.company,
        website: d.website ?? null,
        contactName: d.name,
        email: d.email.toLowerCase(),
        phone: d.phone ?? null,
        source: "contact_form",
        message: d.message,
        consentAt: new Date(),
        consentText: "Agreed on the contact form to be contacted about this enquiry.",
        lastActivityAt: new Date(),
      })
      .returning({ id: leads.id });
    await db.insert(leadActivities).values({
      leadId: lead.id,
      type: "note",
      summary: `Contact form: ${d.message.slice(0, 300)}`,
    });
    await emitEvent(db, "lead.created", null, { leadId: lead.id, source: "contact_form" });
    await notifyStaff(db, {
      kind: "lead.created",
      title: `New enquiry: ${d.company}`,
      body: d.message.slice(0, 140),
      link: `/workspace/leads/${lead.id}`,
    });
    kickJobs();
    return { ok: true, message: "Thanks. Dylan will reply within one working day." };
  }, formData);
}
