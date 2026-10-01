import { eq } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { leads, MEETING_STATUSES, meetings, organisations } from "@/db/schema";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/service";
import {
  briefingAction,
  meetingStatusAction,
  processNotesAction,
  saveNotesAction,
} from "../actions";

export const metadata: Metadata = { title: "Meeting" };

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-muted text-sm">Nothing noted.</p>;
  return (
    <ul className="text-ink-soft list-disc space-y-1 pl-5 text-sm">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export default async function MeetingPage({ params }: PageProps<"/workspace/meetings/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const db = await getDb();
  const [m] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!m) notFound();
  if (m.organisationId) await assertStaffClientAccess(ctx, m.organisationId);
  const [lead] = m.leadId
    ? await db
        .select({ id: leads.id, company: leads.company })
        .from(leads)
        .where(eq(leads.id, m.leadId))
    : [];
  const [org] = m.organisationId
    ? await db
        .select({ id: organisations.id, name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, m.organisationId))
    : [];
  const canWrite = ctx.can("meetings.write");

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/meetings" className="hover:text-ink">
          Calendar
        </Link>{" "}
        / {m.title}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{m.title}</h1>
            <StatusBadge kind="meeting" value={m.status} />
          </div>
          <p className="text-muted mt-1 text-sm">
            {MEETING_TYPE_LABELS[m.type]} · {fmtDateTime(m.startsAt)}–{fmtTime(m.endsAt)}
            {lead && (
              <>
                {" · "}
                <Link
                  href={`/workspace/leads/${lead.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {lead.company}
                </Link>
              </>
            )}
            {org && (
              <>
                {" · "}
                <Link
                  href={`/workspace/clients/${org.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {org.name}
                </Link>
              </>
            )}
          </p>
        </div>
        {canWrite && (
          <form action={meetingStatusAction.bind(null, m.id)} className="flex items-center gap-2">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={m.status}
              className="border-border-strong bg-surface h-9 rounded-md border px-2 text-sm"
            >
              {MEETING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <SubmitButton size="sm" variant="secondary">
              Update
            </SubmitButton>
          </form>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Briefing"
              description="Built from stored data with sources: no guesses."
              action={
                canWrite && (
                  <form action={briefingAction.bind(null, m.id)}>
                    <SubmitButton size="sm" variant="secondary">
                      <Sparkles className="size-4" aria-hidden />{" "}
                      {m.briefing ? "Refresh" : "Prepare"}
                    </SubmitButton>
                  </form>
                )
              }
            />
            <CardBody className="space-y-5">
              {m.briefing && m.briefing.sections.length === 0 ? (
                <p className="text-muted text-sm">
                  Nothing stored to brief on: this meeting isn&apos;t linked to a lead or client.
                </p>
              ) : m.briefing ? (
                <>
                  {m.briefing.sections.map((s) => (
                    <section key={s.heading}>
                      <h3 className="mb-1.5 text-sm font-semibold">{s.heading}</h3>
                      <Bullets items={s.items} />
                    </section>
                  ))}
                  <p className="text-subtle text-xs">
                    Sources: {m.briefing.sources.join(" · ") || "none"} · prepared{" "}
                    {fmtDateTime(m.briefing.generatedAt)}
                  </p>
                </>
              ) : (
                <p className="text-muted text-sm">
                  No briefing yet. Briefings are prepared automatically the day before calls.
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescriptionList
                items={[
                  [
                    "Attendees",
                    m.attendees
                      .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
                      .join(", ") || null,
                  ],
                  ["Location", m.location],
                  ["Video link", m.meetingUrl],
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Agenda & notes"
              description="After the call, process the notes: Mea Creo drafts a summary, next-step tasks and a follow-up email for your approval."
            />
            <CardBody>
              <ActionForm action={saveNotesAction} className="space-y-3">
                <input type="hidden" name="meetingId" value={m.id} />
                <TextArea
                  name="agenda"
                  label="Agenda"
                  defaultValue={m.agenda ?? ""}
                  rows={3}
                  disabled={!canWrite}
                />
                <TextArea
                  name="notes"
                  label="Notes"
                  defaultValue={m.notes ?? ""}
                  rows={10}
                  disabled={!canWrite}
                  hint='Tip: start lines with "Need:", "Goal:", "Budget:", "Concern:" or "Next:".'
                />
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton variant="secondary">Save notes</SubmitButton>
                    {m.notes && (
                      <button
                        formAction={processNotesAction.bind(null, m.id)}
                        className="bg-brand-700 hover:bg-brand-800 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-white"
                      >
                        <Sparkles className="size-4" aria-hidden /> Process notes
                      </button>
                    )}
                  </div>
                )}
              </ActionForm>
            </CardBody>
          </Card>
          {m.outcome && (
            <Card>
              <CardHeader
                title="Outcome"
                description={`Processed ${fmtDateTime(m.outcome.generatedAt)}`}
              />
              <CardBody className="space-y-4">
                <p className="text-sm">{m.outcome.summary}</p>
                <DescriptionList
                  items={[
                    ["Budget", m.outcome.budget ?? null],
                    ["Timeline", m.outcome.timeline ?? null],
                    ["Services discussed", m.outcome.servicesDiscussed.join(", ") || null],
                  ]}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">Needs</h3>
                    <Bullets items={m.outcome.needs} />
                  </section>
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">Goals</h3>
                    <Bullets items={m.outcome.goals} />
                  </section>
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">Concerns</h3>
                    <Bullets items={m.outcome.objections} />
                  </section>
                  <section>
                    <h3 className="mb-1 text-sm font-semibold">Next steps (tasks created)</h3>
                    <Bullets items={m.outcome.nextSteps} />
                  </section>
                </div>
                <details>
                  <summary className="text-brand-700 cursor-pointer text-sm">
                    Follow-up email draft
                  </summary>
                  <pre className="bg-surface-2 mt-2 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {m.outcome.followUpEmail}
                  </pre>
                  <p className="text-muted mt-1 text-xs">Sent only after approval in Approvals.</p>
                </details>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
