import { and, asc, desc, gte, inArray, ne } from "drizzle-orm";
import { CalendarDays, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { clients, leads, MEETING_TYPES, meetings } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { fmtDate, fmtTime } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/service";
import { scheduleMeetingAction } from "./actions";

export const metadata: Metadata = { title: "Calendar" };

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });

export default async function MeetingsPage({ searchParams }: PageProps<"/workspace/meetings">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const leadParam = typeof sp.lead === "string" ? sp.lead : undefined;
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const now = new Date();
  const startOfToday = new Date(`${dayKey(now)}T00:00:00+02:00`);
  const rows = await db
    .select()
    .from(meetings)
    .where(gte(meetings.startsAt, new Date(startOfToday.getTime() - 14 * 86400_000)))
    .orderBy(asc(meetings.startsAt));
  const visible = rows.filter(
    (m) => scope === "all" || !m.organisationId || scope.includes(m.organisationId),
  );
  const upcoming = visible.filter((m) => m.startsAt >= startOfToday && m.status !== "cancelled");
  const past = visible.filter((m) => m.startsAt < startOfToday).reverse();
  const groups = new Map<string, typeof upcoming>();
  for (const m of upcoming)
    groups.set(dayKey(m.startsAt), [...(groups.get(dayKey(m.startsAt)) ?? []), m]);
  const [clientRows, leadRows] = await Promise.all([
    db
      .select({ id: clients.organisationId, name: clients.name })
      .from(clients)
      .where(
        and(
          ne(clients.lifecycle, "offboarded"),
          scope === "all" ? undefined : inArray(clients.organisationId, scope),
        ),
      )
      .orderBy(asc(clients.name)),
    db
      .select({ id: leads.id, company: leads.company })
      .from(leads)
      .where(ne(leads.stage, "archived"))
      .orderBy(desc(leads.createdAt))
      .limit(100),
  ]);
  const calendar = resolveIntegration("calendar");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Calls and meetings. Visibility review calls booked on the website appear here automatically, with a briefing prepared beforehand."
      />
      {!calendar.available || calendar.adapter.isMock ? (
        <div className="mb-6">
          <Callout tone="info" title="Google Calendar: not connected">
            Bookings use Mea Creo&apos;s own availability and meetings. Connect Google Calendar in
            Settings → Integrations to avoid double-booking and add Meet links. REQUIRES
            CONFIGURATION.
          </Callout>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {groups.size === 0 ? (
            <EmptyState icon={<CalendarDays className="size-6" />} title="No upcoming meetings" />
          ) : (
            [...groups.entries()].map(([day, items]) => (
              <section key={day}>
                <h2 className="text-muted mb-2 text-sm font-semibold">
                  {day === dayKey(now)
                    ? "Today"
                    : items[0].startsAt.toLocaleDateString("en-ZA", {
                        timeZone: "Africa/Johannesburg",
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                </h2>
                <Card>
                  <ul className="divide-border divide-y">
                    {items.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/workspace/meetings/${m.id}`}
                          className="hover:bg-surface-2 flex items-center gap-4 px-4 py-3"
                        >
                          <span className="w-24 shrink-0 text-sm tabular-nums">
                            {fmtTime(m.startsAt)}–{fmtTime(m.endsAt)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{m.title}</span>
                            <span className="text-muted block text-xs">
                              {MEETING_TYPE_LABELS[m.type]}
                              {m.briefing ? " · briefing ready" : ""}
                            </span>
                          </span>
                          {m.meetingUrl && (
                            <Video className="text-muted size-4" aria-label="Has video link" />
                          )}
                          <StatusBadge kind="meeting" value={m.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ))
          )}
          {past.length > 0 && (
            <details className="rounded-card border-border bg-surface border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Past two weeks ({past.length})
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {past.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <Link href={`/workspace/meetings/${m.id}`} className="hover:underline">
                      {fmtDate(m.startsAt)} · {m.title}
                    </Link>
                    <span className="flex items-center gap-2">
                      {m.status === "completed" && !m.outcome && (
                        <span className="text-warning-700 text-xs">notes not processed</span>
                      )}
                      <StatusBadge kind="meeting" value={m.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {ctx.can("meetings.write") && (
          <Card className="h-fit">
            <CardHeader
              title="Schedule a meeting"
              description="For times already agreed. Prospects can book themselves at /book."
            />
            <CardBody>
              <ActionForm action={scheduleMeetingAction} className="space-y-3">
                <SelectField
                  name="type"
                  label="Type"
                  defaultValue={leadParam ? "discovery" : "client"}
                  options={MEETING_TYPES.map((t) => ({ value: t, label: MEETING_TYPE_LABELS[t] }))}
                />
                <SelectField
                  name="leadId"
                  label="Lead"
                  placeholder="None"
                  defaultValue={leadParam}
                  options={leadRows.map((l) => ({ value: l.id, label: l.company }))}
                />
                <SelectField
                  name="organisationId"
                  label="Client"
                  placeholder="None"
                  options={clientRows.map((c) => ({ value: c.id, label: c.name }))}
                />
                <TextField name="title" label="Title (optional)" />
                <div className="grid grid-cols-3 gap-2">
                  <TextField
                    name="date"
                    type="date"
                    label="Date"
                    defaultValue={dayKey(new Date(now.getTime() + 86400_000))}
                    required
                  />
                  <TextField name="time" type="time" label="Time" defaultValue="10:00" required />
                  <TextField
                    name="durationMinutes"
                    type="number"
                    label="Minutes"
                    defaultValue="30"
                  />
                </div>
                <TextField
                  name="attendees"
                  label="Attendee emails"
                  placeholder="name@company.co.za, …"
                />
                <TextField name="location" label="Location or link" />
                <TextArea name="agenda" label="Agenda" rows={3} />
                <SubmitButton>Schedule</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
