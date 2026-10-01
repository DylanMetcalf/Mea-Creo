import { and, eq, gte, inArray, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { audits, clients, leadActivities, leads, meetings, type MeetingType } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { enqueue } from "@/jobs/queue";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, SYSTEM } from "@/modules/activity/log";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { emitEvent, notifyStaff } from "@/modules/notifications/service";
import { getPlatformSetting } from "@/modules/settings/service";
import { computeSlots, type DaySlots, type Interval } from "./availability";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  discovery: "Visibility review call",
  strategy: "Strategy call",
  onboarding: "Onboarding session",
  monthly_review: "Monthly review",
  client: "Client meeting",
  internal: "Internal meeting",
};

/** Busy time from our own meetings plus the connected calendar(s), and bookings per day. */
async function busyIntervals(
  db: DbOrTx,
  from: Date,
  to: Date,
  timezone: string,
): Promise<{ busy: Interval[]; bookedPerDay: Map<string, number> }> {
  const rows = await db
    .select({ start: meetings.startsAt, end: meetings.endsAt, type: meetings.type })
    .from(meetings)
    .where(
      and(
        inArray(meetings.status, ["scheduled", "requested"]),
        lte(meetings.startsAt, to),
        gte(meetings.endsAt, from),
      ),
    );
  const busy: Interval[] = rows.map((r) => ({ start: r.start, end: r.end }));
  const bookedPerDay = new Map<string, number>();
  for (const r of rows) {
    if (r.type === "internal") continue;
    const key = r.start.toLocaleDateString("en-CA", { timeZone: timezone });
    bookedPerDay.set(key, (bookedPerDay.get(key) ?? 0) + 1);
  }
  const calendar = resolveIntegration("calendar");
  if (calendar.available) {
    try {
      busy.push(...(await calendar.adapter.getBusy("primary", { start: from, end: to })));
    } catch (error) {
      logger.warn(
        { err: String(error) },
        "calendar busy lookup failed; using internal meetings only",
      );
    }
  }
  return { busy, bookedPerDay };
}

export async function availableSlots(
  db: DbOrTx,
  type: MeetingType,
): Promise<{ days: DaySlots[]; timezone: string; durationMinutes: number }> {
  const settings = await getPlatformSetting(db, "booking");
  const durationMinutes = settings.durations[type];
  const now = new Date();
  const { busy, bookedPerDay } = await busyIntervals(
    db,
    now,
    new Date(now.getTime() + (settings.horizonDays + 1) * 86400_000),
    settings.timezone,
  );
  return {
    days: computeSlots({
      settings,
      durationMinutes,
      busy,
      now,
      bookedPerDay,
      workingDays: type === "discovery" ? settings.discoveryDays : undefined,
    }),
    timezone: settings.timezone,
    durationMinutes,
  };
}

export const bookingSchema = z.object({
  slot: z.iso.datetime({ message: "Please choose a time." }),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  email: z.email("Please enter a valid email address."),
  company: z.string().trim().min(2, "Please enter your company.").max(160),
  website: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  reportToken: z.string().max(64).optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;

async function assertSlotAvailable(db: DbOrTx, type: MeetingType, start: Date): Promise<Date> {
  const { days, durationMinutes } = await availableSlots(db, type);
  const ok = days.some((d) => d.slots.some((s) => s.getTime() === start.getTime()));
  if (!ok)
    throw new AppError("CONFLICT", {
      userMessage: "That time is no longer available. Please choose another.",
    });
  return new Date(start.getTime() + durationMinutes * 60_000);
}

async function mirrorToCalendar(
  db: DbOrTx,
  meetingId: string,
  input: {
    title: string;
    start: Date;
    end: Date;
    attendees: { email: string; name?: string }[];
    description?: string;
  },
) {
  const calendar = resolveIntegration("calendar");
  if (!calendar.available) return;
  try {
    const event = await calendar.adapter.createEvent({
      calendarId: "primary",
      title: input.title,
      description: input.description,
      start: input.start,
      end: input.end,
      attendees: input.attendees,
      withMeetingLink: true,
    });
    await db
      .update(meetings)
      .set({ externalId: event.externalId, meetingUrl: event.meetingUrl ?? null })
      .where(eq(meetings.id, meetingId));
  } catch (error) {
    logger.warn({ err: String(error), meetingId }, "calendar event creation failed");
  }
}

/** Public booking of a visibility review / strategy call. Creates or links the lead. */
export async function bookPublicCall(db: Db, input: BookingInput): Promise<{ meetingId: string }> {
  const start = new Date(input.slot);
  const end = await assertSlotAvailable(db, "discovery", start);
  const email = input.email.toLowerCase();

  const result = await db.transaction(async (tx) => {
    let leadId: string | undefined;
    if (input.reportToken) {
      const [audit] = await tx
        .select({ leadId: audits.leadId })
        .from(audits)
        .where(eq(audits.publicToken, input.reportToken))
        .limit(1);
      leadId = audit?.leadId ?? undefined;
    }
    if (!leadId) {
      const [existing] = await tx
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.email, email))
        .limit(1);
      leadId = existing?.id;
    }
    if (!leadId) {
      const [created] = await tx
        .insert(leads)
        .values({
          company: input.company,
          website: input.website || null,
          contactName: input.name,
          email,
          phone: input.phone || null,
          source: "booking",
          message: input.notes || null,
          consentAt: new Date(),
          consentText: "Booked a call via the website.",
        })
        .returning({ id: leads.id });
      leadId = created.id;
      await emitEvent(tx, "lead.created", null, { leadId, source: "booking" });
    }
    await tx
      .update(leads)
      .set({ stage: "call_booked", lastActivityAt: new Date() })
      .where(eq(leads.id, leadId));
    const [meeting] = await tx
      .insert(meetings)
      .values({
        leadId,
        type: "discovery",
        title: `Visibility review: ${input.company}`,
        startsAt: start,
        endsAt: end,
        attendees: [{ name: input.name, email }],
        agenda: input.notes || null,
      })
      .returning({ id: meetings.id });
    await tx.insert(leadActivities).values({
      leadId,
      type: "meeting",
      summary: `Booked a visibility review for ${start.toISOString()}.`,
    });
    await emitEvent(tx, "call.booked", null, { meetingId: meeting.id, leadId });
    await enqueue(tx, "meeting.briefing", { meetingId: meeting.id });
    return { meetingId: meeting.id, leadId };
  });

  await mirrorToCalendar(db, result.meetingId, {
    title: `Visibility review: ${input.company}`,
    start,
    end,
    attendees: [{ email, name: input.name }],
    description: input.notes,
  });
  const booking = await getPlatformSetting(db, "booking");
  const when = start.toLocaleString("en-ZA", {
    timeZone: booking.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });
  const [meeting] = await db
    .select({ meetingUrl: meetings.meetingUrl })
    .from(meetings)
    .where(eq(meetings.id, result.meetingId));
  await sendEmail(db, {
    to: { email, name: input.name },
    template: "bookingConfirmed",
    category: "transactional",
    email: emailTemplates.bookingConfirmed({
      name: input.name,
      when,
      type: "visibility review",
      meetingUrl: meeting?.meetingUrl ?? undefined,
      manageUrl: absoluteUrl("/contact"),
    }),
    idempotencyKey: `booking:${result.meetingId}`,
  });
  await notifyStaff(db, {
    kind: "meeting.booked",
    title: `Call booked: ${input.company}`,
    body: when,
    link: `/workspace/meetings/${result.meetingId}`,
  });
  await logActivity(db, SYSTEM, {
    action: "meeting.booked",
    summary: `${input.name} (${input.company}) booked a visibility review.`,
    entityType: "meeting",
    entityId: result.meetingId,
  });
  return { meetingId: result.meetingId };
}

/** A client books (or requests) a meeting from their portal. */
export async function bookClientMeeting(
  db: Db,
  input: {
    organisationId: string;
    userId: string;
    userName: string;
    userEmail: string;
    slot: string;
    topic: string;
  },
): Promise<string> {
  const start = new Date(input.slot);
  const end = await assertSlotAvailable(db, "client", start);
  const [client] = await db
    .select({ name: clients.name, accountManagerId: clients.accountManagerId })
    .from(clients)
    .where(eq(clients.organisationId, input.organisationId));
  const [meeting] = await db
    .insert(meetings)
    .values({
      organisationId: input.organisationId,
      type: "client",
      title: `${client?.name ?? "Client"}: ${input.topic}`,
      startsAt: start,
      endsAt: end,
      hostId: client?.accountManagerId ?? null,
      attendees: [{ name: input.userName, email: input.userEmail }],
      agenda: input.topic,
    })
    .returning({ id: meetings.id });
  await mirrorToCalendar(db, meeting.id, {
    title: `${client?.name}: ${input.topic}`,
    start,
    end,
    attendees: [{ email: input.userEmail, name: input.userName }],
  });
  await notifyStaff(db, {
    kind: "meeting.booked",
    title: `${client?.name} booked a meeting`,
    body: input.topic,
    link: `/workspace/meetings/${meeting.id}`,
    organisationId: input.organisationId,
  });
  await emitEvent(db, "call.booked", input.organisationId, { meetingId: meeting.id });
  return meeting.id;
}

/** Meetings in a date window, optionally for one organisation (portal) or all (workspace). */
export async function meetingsBetween(db: DbOrTx, from: Date, to: Date, organisationId?: string) {
  const window = and(gte(meetings.startsAt, from), lte(meetings.startsAt, to));
  return db
    .select()
    .from(meetings)
    .where(organisationId ? and(window, eq(meetings.organisationId, organisationId)) : or(window))
    .orderBy(meetings.startsAt);
}
