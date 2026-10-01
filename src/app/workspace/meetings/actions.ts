"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { leadActivities, leads, MEETING_STATUSES, MEETING_TYPES, meetings } from "@/db/schema";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { requireStaff } from "@/modules/auth/context";
import { generateMeetingBriefing, processMeetingNotes } from "@/modules/meetings/briefing";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/service";

const scheduleSchema = z.object({
  type: z.enum(MEETING_TYPES),
  title: optionalText(200),
  date: z.iso.date("Choose a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  durationMinutes: z.coerce.number().int().min(10).max(480),
  organisationId: z.union([z.uuid(), z.literal("")]).optional(),
  leadId: z.union([z.uuid(), z.literal("")]).optional(),
  attendees: optionalText(1000),
  location: optionalText(300),
  agenda: optionalText(4000),
});

/** Staff scheduling (already agreed with the attendee). Times are South African time. */
export async function scheduleMeetingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("meetings.write");
    const parsed = parseForm(scheduleSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const start = new Date(`${d.date}T${d.time}:00+02:00`);
    const attendees = (d.attendees ?? "")
      .split(/[,;\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => z.email().safeParse(e).success)
      .map((email) => ({ email }));
    const db = await getDb();
    let title = d.title;
    if (!title && d.leadId) {
      const [lead] = await db
        .select({ company: leads.company })
        .from(leads)
        .where(eq(leads.id, d.leadId));
      title = `${MEETING_TYPE_LABELS[d.type]}: ${lead?.company ?? ""}`;
    }
    const [meeting] = await db
      .insert(meetings)
      .values({
        type: d.type,
        title: title ?? MEETING_TYPE_LABELS[d.type],
        startsAt: start,
        endsAt: new Date(start.getTime() + d.durationMinutes * 60_000),
        organisationId: d.organisationId || null,
        leadId: d.leadId || null,
        attendees,
        location: d.location,
        agenda: d.agenda,
        hostId: ctx.user.id,
      })
      .returning({ id: meetings.id });
    if (d.leadId) {
      await db
        .update(leads)
        .set({ stage: "call_booked", lastActivityAt: new Date() })
        .where(eq(leads.id, d.leadId));
      await db
        .insert(leadActivities)
        .values({
          leadId: d.leadId,
          type: "meeting",
          summary: `Call scheduled for ${d.date} ${d.time}.`,
          actorId: ctx.user.id,
        });
    }
    id = meeting.id;
  }, formData);
  if (id) redirect(`/workspace/meetings/${id}`);
  return state;
}

export async function saveNotesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireStaff("meetings.write");
    const db = await getDb();
    await db
      .update(meetings)
      .set({
        notes: String(formData.get("notes") ?? "").slice(0, 30_000),
        agenda: String(formData.get("agenda") ?? "").slice(0, 4000) || null,
      })
      .where(eq(meetings.id, String(formData.get("meetingId"))));
    refresh();
    return { ok: true, message: "Notes saved." };
  }, formData);
}

export async function processNotesAction(meetingId: string): Promise<void> {
  const ctx = await requireStaff("meetings.write");
  const outcome = await processMeetingNotes(await getDb(), meetingId, {
    id: ctx.user.id,
    name: ctx.user.name,
  });
  if (!outcome) throw new AppError("VALIDATION", { userMessage: "Add notes before processing." });
  refresh();
}

export async function briefingAction(meetingId: string): Promise<void> {
  await requireStaff("meetings.write");
  await generateMeetingBriefing(await getDb(), meetingId);
  refresh();
}

export async function meetingStatusAction(meetingId: string, formData: FormData): Promise<void> {
  await requireStaff("meetings.write");
  const status = z.enum(MEETING_STATUSES).parse(formData.get("status"));
  await (await getDb()).update(meetings).set({ status }).where(eq(meetings.id, meetingId));
  refresh();
}
