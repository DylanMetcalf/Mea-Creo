"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { CHANNELS, leadActivities, leads, RESPONSE_CLASSES } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { requireStaff } from "@/modules/auth/context";
import {
  draftOutreach,
  logResponse,
  markCommunicationSent,
  suppressLead,
} from "@/modules/outreach/service";
import { researchLead } from "@/modules/prospects/research";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function researchLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireStaff("leads.write");
    const db = await getDb();
    const r = await researchLead(db, str(formData, "leadId"));
    refresh();
    return {
      ok: true,
      message: `Read ${r.pagesRead.length} page(s): ${r.decisionMakers.length} named people, ${r.emails.length} email(s), ${r.phones.length} phone number(s).${r.notes.length ? ` ${r.notes.join(" ")}` : ""}`,
    };
  }, formData);
}

const draftSchema = z.object({
  leadId: z.uuid(),
  channel: z.enum(CHANNELS),
  purpose: z.enum(["consent_request", "follow_up", "booking_link", "information", "reply"]),
  useAi: z.string().optional(),
});

export async function draftOutreachAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(draftSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const r = await draftOutreach(db, d.leadId, {
      channel: d.channel,
      purpose: d.purpose,
      actorId: ctx.user.id,
      useAi: d.useAi === "on",
    });
    refresh();
    return {
      ok: true,
      message: `Draft ready for approval.${r.qcIssues.length ? ` QC: ${r.qcIssues.join("; ")}` : ""}`,
    };
  }, formData);
}

const responseSchema = z.object({
  leadId: z.uuid(),
  channel: z.enum(CHANNELS),
  body: z.string().trim().min(1, "Paste or summarise their reply.").max(10_000),
  classification: z.union([z.enum(RESPONSE_CLASSES), z.literal("")]).optional(),
});

export async function logResponseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(responseSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const r = await logResponse(db, d.leadId, {
      channel: d.channel,
      body: d.body,
      actorId: ctx.user.id,
      classification: d.classification || undefined,
    });
    refresh();
    return {
      ok: true,
      message: `Classified as "${r.classification.replace(/_/g, " ")}". ${r.nextAction}`,
    };
  }, formData);
}

export async function markSentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const db = await getDb();
    await markCommunicationSent(db, str(formData, "communicationId"), ctx.user.id);
    refresh();
    return { ok: true, message: "Marked as sent." };
  }, formData);
}

export async function doNotContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    if (formData.get("confirm") !== "on")
      return { ok: false, fieldErrors: { confirm: ["Tick to confirm."] } };
    const db = await getDb();
    await suppressLead(db, str(formData, "leadId"), "manual", "Mea Creo", ctx.user.id);
    refresh();
    return { ok: true, message: "Added to the do-not-contact list." };
  }, formData);
}

const consentSchema = z.object({
  leadId: z.uuid(),
  how: z
    .string()
    .trim()
    .min(3, "Say how they agreed (e.g. 'Asked for info on a call, 3 Oct').")
    .max(300),
});

/** Records that the person agreed to hear from us outside the system (call, event, referral). */
export async function recordConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(consentSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const [lead] = await db.select().from(leads).where(eq(leads.id, parsed.data.leadId));
    if (lead?.optedOutAt)
      return {
        ok: false,
        message:
          "They opted out. Only record consent if they clearly asked to hear from us again; remove them from the do-not-contact list first.",
      };
    await db
      .update(leads)
      .set({
        consentStatus: "given",
        consentAt: new Date(),
        consentText: `Recorded by ${ctx.user.name}: ${parsed.data.how}`,
      })
      .where(eq(leads.id, parsed.data.leadId));
    await db.insert(leadActivities).values({
      leadId: parsed.data.leadId,
      type: "note",
      summary: `Consent recorded: ${parsed.data.how}`,
      actorId: ctx.user.id,
    });
    refresh();
    return { ok: true, message: "Consent recorded." };
  }, formData);
}
