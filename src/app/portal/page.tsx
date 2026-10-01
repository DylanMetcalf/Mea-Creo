import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { ArrowRight, CalendarDays, CheckSquare, CreditCard, FileText, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AskBox } from "@/components/portal/ask-box";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { DueLabel, StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import {
  approvals,
  clientServices,
  invoices,
  meetings,
  reports,
  services,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { fmtDate, fmtDateTime, fmtMoney, fmtRelative } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { portalAskAction } from "./actions";

export const metadata: Metadata = { title: "Home" };

export default async function PortalHome() {
  const ctx = await requireClient();
  const org = ctx.organisationId;
  const db = await getDb();
  const [pending, waiting, open, plan, [report], upcoming, timeline] = await Promise.all([
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, org),
          eq(approvals.status, "pending"),
          eq(approvals.level, "client"),
        ),
      )
      .orderBy(asc(approvals.dueAt)),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, org),
          eq(tasks.visibility, "client"),
          eq(tasks.status, "waiting_client"),
        ),
      )
      .orderBy(asc(tasks.dueAt)),
    ctx.can("portal.billing")
      ? db
          .select()
          .from(invoices)
          .where(
            and(eq(invoices.organisationId, org), inArray(invoices.status, ["open", "overdue"])),
          )
      : Promise.resolve([]),
    db
      .select({
        name: services.name,
        status: clientServices.status,
        focus: clientServices.currentFocus,
        pauseReason: clientServices.pauseReason,
      })
      .from(clientServices)
      .innerJoin(services, eq(services.id, clientServices.serviceId))
      .where(
        and(
          eq(clientServices.organisationId, org),
          inArray(clientServices.status, ["active", "paused", "pending"]),
        ),
      ),
    db
      .select()
      .from(reports)
      .where(and(eq(reports.organisationId, org), eq(reports.status, "published")))
      .orderBy(desc(reports.publishedAt))
      .limit(1),
    db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.organisationId, org),
          gte(meetings.startsAt, new Date()),
          inArray(meetings.status, ["scheduled", "requested"]),
        ),
      )
      .orderBy(asc(meetings.startsAt))
      .limit(3),
    db
      .select()
      .from(timelineEntries)
      .where(and(eq(timelineEntries.organisationId, org), eq(timelineEntries.visibility, "client")))
      .orderBy(desc(timelineEntries.occurredAt))
      .limit(6),
  ]);
  const first = ctx.user.name.split(" ")[0];
  const attention = pending.length + waiting.length + open.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Hello, {first}.</h1>
        <p className="text-muted mt-1">
          {attention
            ? `${attention} thing${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} you. Everything else is in hand.`
            : "Nothing needs you right now. Here's where things stand."}
        </p>
      </header>

      {attention > 0 && (
        <Card>
          <CardHeader title="Needs your attention" />
          <ul className="divide-border divide-y">
            {pending.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/approvals/${a.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <CheckSquare className="text-clay-600 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="text-muted block text-xs">{a.requestedAction}</span>
                  </span>
                  {a.dueAt && <DueLabel due={a.dueAt} />}
                  <ArrowRight className="text-muted size-4" aria-hidden />
                </Link>
              </li>
            ))}
            {waiting.map((t) => (
              <li key={t.id}>
                <Link
                  href="/portal/work"
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <Upload className="text-clay-600 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="text-muted block text-xs">
                      We&apos;re waiting on this from you
                    </span>
                  </span>
                  {t.dueAt && <DueLabel due={t.dueAt} />}
                </Link>
              </li>
            ))}
            {open.map((i) => (
              <li key={i.id}>
                <Link
                  href="/portal/billing"
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <CreditCard className="text-clay-600 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Invoice {i.number}: {fmtMoney(i.totalMinor - i.amountPaidMinor, i.currency)}
                    </span>
                    <span className="text-muted block text-xs">Due {fmtDate(i.dueAt)}</span>
                  </span>
                  <StatusBadge kind="invoice" value={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AskBox action={portalAskAction} compact />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your services"
            action={
              <Link href="/portal/services" className="text-brand-700 text-sm hover:underline">
                All
              </Link>
            }
          />
          <ul className="divide-border divide-y">
            {plan.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">No services yet.</li>
            )}
            {plan.map((s) => (
              <li key={s.name} className="px-5 py-3">
                <p className="flex items-center justify-between gap-2 text-sm font-medium">
                  {s.name} <StatusBadge kind="service" value={s.status} />
                </p>
                {s.focus && <p className="text-muted text-xs">Now: {s.focus}</p>}
                {s.status === "paused" && s.pauseReason && (
                  <p className="text-warning-700 text-xs">{s.pauseReason}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Latest report" />
          <CardBody>
            {report ? (
              <Link href={`/portal/reports/${report.id}`} className="group block">
                <p className="flex items-center gap-2 font-medium group-hover:underline">
                  <FileText className="text-brand-700 size-4" aria-hidden /> {report.title}
                </p>
                <p className="text-ink-soft mt-2 text-sm">{report.content.headline}</p>
                <p className="text-muted mt-2 text-xs">Published {fmtDate(report.publishedAt)}</p>
              </Link>
            ) : (
              <p className="text-muted text-sm">Your first monthly report will appear here.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Upcoming meetings"
            action={
              <Link href="/portal/meetings" className="text-brand-700 text-sm hover:underline">
                Book
              </Link>
            }
          />
          <ul className="divide-border divide-y">
            {upcoming.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">Nothing booked.</li>
            )}
            {upcoming.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <CalendarDays className="text-brand-700 size-4" aria-hidden />
                <span className="flex-1">{m.title}</span>
                <span className="text-muted text-xs">{fmtDateTime(m.startsAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Recent progress"
            action={
              <Link href="/portal/work" className="text-brand-700 text-sm hover:underline">
                Timeline
              </Link>
            }
          />
          <ul className="divide-border divide-y">
            {timeline.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">
                Progress will show here as work is completed.
              </li>
            )}
            {timeline.map((t) => (
              <li key={t.id} className="px-5 py-3">
                <p className="text-sm">
                  {t.link ? (
                    <Link href={t.link} className="hover:underline">
                      {t.title}
                    </Link>
                  ) : (
                    t.title
                  )}
                </p>
                <p className="text-muted text-xs">
                  <Badge tone="neutral">{t.kind}</Badge> {fmtRelative(t.occurredAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
