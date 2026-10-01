import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DueLabel, StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { OPEN_TASK_STATUSES, tasks, timelineEntries } from "@/db/schema";
import { fmtDate, humanize } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Work" };

export default async function PortalWork() {
  const ctx = await requireClient();
  const db = await getDb();
  const org = ctx.organisationId;
  const [open, timeline] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, org),
          eq(tasks.visibility, "client"),
          inArray(tasks.status, OPEN_TASK_STATUSES),
        ),
      )
      .orderBy(asc(tasks.dueAt)),
    db
      .select()
      .from(timelineEntries)
      .where(and(eq(timelineEntries.organisationId, org), eq(timelineEntries.visibility, "client")))
      .orderBy(desc(timelineEntries.occurredAt))
      .limit(60),
  ]);
  const yours = open.filter((t) => t.status === "waiting_client");
  const ours = open.filter((t) => t.status !== "waiting_client");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Work</h1>
        <p className="text-muted mt-1">
          What we&apos;re working on, what we need from you, and everything done so far.
        </p>
      </header>
      {yours.length > 0 && (
        <Card>
          <CardHeader
            title="Waiting on you"
            description="Upload files under Files, or reply in Messages."
          />
          <ul className="divide-border divide-y">
            {yours.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  {t.title}
                  {t.description && (
                    <span className="text-muted block text-xs">{t.description}</span>
                  )}
                </span>
                <DueLabel due={t.dueAt} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="In progress and planned" />
        <ul className="divide-border divide-y">
          {ours.length === 0 && (
            <li className="text-muted px-5 py-4 text-sm">Nothing scheduled right now.</li>
          )}
          {ours.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>{t.title}</span>
              <span className="flex shrink-0 items-center gap-2">
                <DueLabel due={t.dueAt} />
                <StatusBadge kind="task" value={t.status} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Growth timeline" />
        <ol className="before:bg-border relative space-y-4 px-5 py-4 before:absolute before:top-5 before:bottom-5 before:left-[1.6rem] before:w-px">
          {timeline.length === 0 && (
            <li className="text-muted text-sm">Milestones appear here as work is completed.</li>
          )}
          {timeline.map((e) => (
            <li key={e.id} className="relative flex gap-4">
              <span
                className="bg-brand-600 ring-surface relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4"
                aria-hidden
              />
              <span>
                <span className="block text-sm font-medium">
                  {e.link?.startsWith("/portal") ? (
                    <Link href={e.link} className="hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    e.title
                  )}
                </span>
                {e.description && (
                  <span className="text-ink-soft block text-sm">{e.description}</span>
                )}
                <span className="text-muted block text-xs">
                  {humanize(e.kind)} · {fmtDate(e.occurredAt)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
