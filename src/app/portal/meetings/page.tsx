import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { SlotPicker } from "@/components/booking/slot-picker";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { meetings } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { availableSlots, MEETING_TYPE_LABELS } from "@/modules/meetings/service";
import { portalBookAction } from "../actions";

export const metadata: Metadata = { title: "Meetings" };

export default async function PortalMeetings() {
  const ctx = await requireClient();
  const db = await getDb();
  const now = new Date();
  const [upcoming, past, slots] = await Promise.all([
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organisationId, ctx.organisationId), gte(meetings.startsAt, now)))
      .orderBy(asc(meetings.startsAt)),
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organisationId, ctx.organisationId), lt(meetings.startsAt, now)))
      .orderBy(desc(meetings.startsAt))
      .limit(10),
    availableSlots(db, "client"),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Meetings</h1>
        <p className="text-muted mt-1">Book time with the team whenever you need it.</p>
      </header>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming" />
            <ul className="divide-border divide-y">
              {upcoming.length === 0 && (
                <li className="text-muted px-5 py-4 text-sm">Nothing booked.</li>
              )}
              {upcoming.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-medium">
                    {m.title} <StatusBadge kind="meeting" value={m.status} />
                  </p>
                  <p className="text-muted text-xs">
                    {MEETING_TYPE_LABELS[m.type]} · {fmtDateTime(m.startsAt)}
                    {m.meetingUrl && (
                      <>
                        {" · "}
                        <a
                          href={m.meetingUrl}
                          className="text-brand-700 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join link
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
          {past.length > 0 && (
            <Card>
              <CardHeader title="Past meetings" />
              <ul className="divide-border divide-y">
                {past.map((m) => (
                  <li key={m.id} className="px-5 py-3 text-sm">
                    {m.title}
                    <span className="text-muted block text-xs">{fmtDateTime(m.startsAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader
            title="Book a meeting"
            description={`${slots.durationMinutes} minutes, by video call.`}
          />
          <CardBody>
            <ActionForm action={portalBookAction} className="space-y-4" resetOnSuccess>
              <SlotPicker
                days={slots.days.map((d) => ({
                  date: d.date,
                  slots: d.slots.map((s) => s.toISOString()),
                }))}
                timezone={slots.timezone}
              />
              <TextField name="topic" label="What would you like to discuss?" required />
              <SubmitButton>Book</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
