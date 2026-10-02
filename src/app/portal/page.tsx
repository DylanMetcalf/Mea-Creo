import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { ArrowRight, CalendarDays, CheckSquare, CreditCard, FileText, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IndexRing } from "@/components/audits/index-ring";
import { AskBox } from "@/components/portal/ask-box";
import { cn } from "@/components/ui/cn";
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
import { latestClientAudit } from "@/modules/audits/service";
import { BAND_LABELS, visibilityIndex } from "@/modules/audits/visibility-index";
import { portalAskAction } from "./actions";

export const metadata: Metadata = { title: "Home" };

function greetingPart() {
  const hour = Number(
    new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "numeric",
      hour12: false,
    }),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function PortalHome() {
  const ctx = await requireClient();
  const org = ctx.organisationId;
  const db = await getDb();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [pending, waiting, open, plan, [report], upcoming, timeline, audit, [done]] =
    await Promise.all([
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
        .where(
          and(eq(timelineEntries.organisationId, org), eq(timelineEntries.visibility, "client")),
        )
        .orderBy(desc(timelineEntries.occurredAt))
        .limit(6),
      latestClientAudit(db, org),
      db
        .select({ n: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.organisationId, org),
            eq(tasks.visibility, "client"),
            eq(tasks.status, "complete"),
            gte(tasks.completedAt, monthStart),
          ),
        ),
    ]);
  const index = audit?.result ? visibilityIndex(audit.result) : null;
  const lastUpdate = [timeline[0]?.occurredAt, report?.publishedAt, audit?.completedAt]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const attention = pending.length + waiting.length + open.length;
  const company = ctx.organisationName.replace(/\s*\(Demo\)$/, "");

  return (
    <div className="space-y-7">
      <header className="bg-night text-night-text relative isolate overflow-hidden rounded-[24px] p-6 sm:p-8">
        <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-85" />
        <div
          aria-hidden
          className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(60%_90%_at_100%_0%,#000,transparent)]"
        />
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-lg">
            <p className="label-mono text-signal">{greetingPart()}</p>
            <h1 className="font-display mt-3 text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
              {company}.
            </h1>
            <p className="text-night-text/85 mt-2 text-[1.02rem]">
              Here&apos;s what&apos;s happening with your visibility.
            </p>
            <p
              className={cn(
                "mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
                attention ? "bg-ember-500/15 text-[#f3c99a]" : "bg-signal/12 text-signal",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", attention ? "bg-ember-500" : "bg-signal")}
              />
              {attention
                ? `${attention} thing${attention === 1 ? "" : "s"} need${attention === 1 ? "s" : ""} you. Everything else is in hand.`
                : "Everything is on track. Nothing needs you right now."}
            </p>
          </div>
          {index && audit && (
            <Link
              href={`/visibility-report/${audit.publicToken}`}
              className="group flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4 pr-6 backdrop-blur transition-colors hover:bg-white/[0.08]"
            >
              <IndexRing
                value={index.score}
                size={96}
                stroke={8}
                inverse
                label="Your Mea Creo Visibility Index"
              />
              <div>
                <p className="label-mono text-night-muted">Visibility Index</p>
                <p className="font-display mt-1 text-white">{BAND_LABELS[index.band]}</p>
                <p className="text-night-muted mt-1 text-xs">
                  From your Visibility Report, {fmtDate(audit.completedAt)}
                </p>
                <p className="text-signal mt-2 inline-flex items-center gap-1 text-xs font-medium">
                  See the breakdown
                  <ArrowRight
                    className="size-3 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </p>
              </div>
            </Link>
          )}
        </div>
        <ul className="border-night-line text-night-muted mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs">
          <li>
            Last updated{" "}
            <span className="text-night-text">
              {lastUpdate ? fmtRelative(lastUpdate) : "not yet"}
            </span>
          </li>
          <li>
            <span className="text-night-text tabular-nums">{done?.n ?? 0}</span> task
            {done?.n === 1 ? "" : "s"} completed this month
          </li>
          <li>
            <span className="text-night-text tabular-nums">{pending.length}</span> approval
            {pending.length === 1 ? "" : "s"} required
          </li>
          {plan.filter((p) => p.status === "active").length > 0 && (
            <li>
              <span className="text-night-text tabular-nums">
                {plan.filter((p) => p.status === "active").length}
              </span>{" "}
              active service{plan.filter((p) => p.status === "active").length === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      </header>

      {attention > 0 && (
        <Card>
          <CardHeader
            title="Needs your attention"
            description="The only things waiting on you. Everything else is in hand."
          />
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
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
