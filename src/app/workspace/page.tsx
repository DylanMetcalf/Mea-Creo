import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/ui/charts";
import { cn } from "@/components/ui/cn";
import { Card, CardBody, CardHeader, EmptyState, Stat } from "@/components/ui/primitives";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { fmtMoney, fmtMoneyShort, fmtRelative, fmtTime } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { commandCentre } from "@/modules/dashboard/service";

export const metadata: Metadata = { title: "Command Centre" };

function greeting(name: string) {
  const hour = Number(
    new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "numeric",
      hour12: false,
    }),
  );
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${name.split(" ")[0]}.`;
}

export default async function CommandCentrePage() {
  const ctx = await requireStaff();
  const db = await getDb();
  const data = await commandCentre(
    db,
    await staffClientScope(ctx),
    ctx.user.id,
    ctx.platformOrganisationId,
  );
  const showBusiness = ctx.can("dashboard.business");
  const today = new Date().toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Attention: things that need a person. Activity: what changed.
  const attention: [string, number, string, "danger" | "warning" | "brand"][] = [
    ["Approvals waiting on you", data.internalApprovals.length, "/workspace/approvals", "warning"],
    ["Overdue tasks", data.overdueTasks.length, "/workspace/tasks?view=overdue", "danger"],
    ["Due today", data.dueToday.length, "/workspace/tasks?view=today", "brand"],
    [
      "Payments needing attention",
      data.overdueInvoices.length + data.failedPayments,
      "/workspace/billing",
      "danger",
    ],
    [
      "Automation alerts",
      data.alerts.failedRuns.length + data.alerts.failedJobs,
      "/workspace/runs",
      "danger",
    ],
    ["Reports to review", data.reportsInReview.length, "/workspace/reports", "warning"],
  ];
  const activity: [string, number, string][] = [
    ["New leads, 7 days", data.newLeads.length, "/workspace/leads"],
    ["New clients, 30 days", data.newClients.length, "/workspace/clients"],
    ["Meetings today & tomorrow", data.meetingsSoon.length, "/workspace/meetings"],
    ["Waiting on clients", data.clientApprovalsWaiting.length, "/workspace/approvals?tab=client"],
    ["Content awaiting approval", data.contentAwaiting, "/workspace/clients"],
    ["Opportunities found", data.openOpportunities, "/workspace/clients"],
  ];
  const stripe = {
    danger: "bg-danger-solid",
    warning: "bg-ember-500",
    brand: "bg-brand-500",
  };

  return (
    <div className="space-y-9">
      {/* Daily brief */}
      <section className="bg-night text-night-text relative isolate overflow-hidden rounded-[24px] p-6 sm:p-9">
        <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-85" />
        <div
          aria-hidden
          className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(60%_90%_at_100%_0%,#000,transparent)]"
        />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="label-mono text-signal">{today}</p>
            <h1 className="font-display mt-3 text-[2.1rem] leading-tight text-white sm:text-[2.6rem]">
              {greeting(ctx.user.name)}
            </h1>
            <p className="text-night-text/80 mt-3 text-[0.95rem] leading-relaxed">
              {data.meetingsSoon.length} meeting{data.meetingsSoon.length === 1 ? "" : "s"} coming
              up · {data.internalApprovals.length} approval
              {data.internalApprovals.length === 1 ? "" : "s"} for you ·{" "}
              {data.dueToday.length + data.overdueTasks.length} task
              {data.dueToday.length + data.overdueTasks.length === 1 ? "" : "s"} due ·{" "}
              {data.newLeads.length} new lead{data.newLeads.length === 1 ? "" : "s"}
              {data.overdueInvoices.length
                ? ` · ${data.overdueInvoices.length} payment issue${data.overdueInvoices.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <div className="w-full lg:max-w-[540px]">
            <p className="label-mono text-night-muted mb-3">Today&apos;s priorities</p>
            {data.priorities.length > 0 ? (
              <ol className="space-y-1.5">
                {data.priorities.slice(0, 6).map((p, i) => (
                  <li key={p.text}>
                    <Link
                      href={p.href}
                      className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.05] px-3.5 py-2.5 text-sm backdrop-blur transition-colors hover:border-white/15 hover:bg-white/[0.09]"
                    >
                      <span className="text-signal mt-px font-mono text-xs">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-white">{p.text}</span>
                      <ArrowRight
                        className="text-night-muted mt-0.5 size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-night-text flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-signal size-4" aria-hidden /> Nothing urgent. A good
                day to work on growth.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Attention */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="label-mono text-muted mb-3">
          Needs attention
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {attention.map(([label, value, href, tone]) => (
            <Link
              key={label}
              href={href}
              className={cn(
                "rounded-card group relative overflow-hidden border px-4 py-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5",
                value
                  ? "border-border/80 bg-surface shadow-card hover:shadow-raised"
                  : "border-border/50 bg-surface/50",
              )}
            >
              {value > 0 && (
                <span
                  aria-hidden
                  className={cn("absolute inset-x-0 top-0 h-[3px]", stripe[tone])}
                />
              )}
              <div
                className={cn(
                  "font-display text-[1.75rem] leading-none tabular-nums",
                  !value && "text-subtle",
                )}
              >
                {value}
              </div>
              <div
                className={cn(
                  "mt-1.5 text-xs leading-snug",
                  value ? "text-ink-soft" : "text-subtle",
                )}
              >
                {label}
              </div>
            </Link>
          ))}
        </div>
        <ul className="border-border/70 bg-surface/60 mt-3 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-sm">
          {activity.map(([label, value, href]) => (
            <li key={label}>
              <Link href={href} className="text-muted hover:text-ink transition-colors">
                <span className="text-ink font-semibold tabular-nums">{value}</span> {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Upcoming meetings"
            action={
              <Link href="/workspace/meetings" className="text-brand-700 text-sm hover:underline">
                Calendar
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.meetingsSoon.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CalendarDays className="size-6" />}
                  title="No meetings today or tomorrow"
                  description="Booked calls from the website and client portal appear here with their briefings."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {data.meetingsSoon.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/workspace/meetings/${m.id}`}
                      className="hover:bg-surface-2 flex items-center gap-4 px-5 py-3"
                    >
                      <div className="w-20 shrink-0 text-sm">
                        <div className="font-semibold tabular-nums">{fmtTime(m.startsAt)}</div>
                        <div className="text-muted text-xs">{fmtRelative(m.startsAt)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.title}</p>
                        <p className="text-muted text-xs">
                          {m.briefing ? "Briefing ready" : "Briefing not generated yet"}
                        </p>
                      </div>
                      <StatusBadge kind="meeting" value={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Approvals"
            description="Waiting on Mea Creo"
            action={
              <Link href="/workspace/approvals" className="text-brand-700 text-sm hover:underline">
                All
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.internalApprovals.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<ClipboardCheck className="size-6" />}
                  title="Nothing to approve"
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {data.internalApprovals.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/workspace/approvals/${a.id}`}
                      className="hover:bg-surface-2 block px-5 py-3"
                    >
                      <p className="line-clamp-2 text-sm font-medium">{a.title}</p>
                      <p className="text-muted mt-0.5 text-xs">
                        {data.clientName(a.organisationId)} · {statusLabel(a.level)} ·{" "}
                        {fmtRelative(a.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Overdue & due today"
            action={
              <Link href="/workspace/tasks" className="text-brand-700 text-sm hover:underline">
                Tasks
              </Link>
            }
          />
          <CardBody className="p-0">
            {[...data.overdueTasks, ...data.dueToday].length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="You're up to date"
                  description="No overdue tasks and nothing due today."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {[...data.overdueTasks, ...data.dueToday].slice(0, 8).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                    {t.dueAt && t.dueAt < new Date() ? (
                      <AlertTriangle
                        className="text-danger-700 size-4 shrink-0"
                        aria-label="Overdue"
                      />
                    ) : (
                      <CalendarDays
                        className="text-subtle size-4 shrink-0"
                        aria-label="Due today"
                      />
                    )}
                    <Link
                      href={`/workspace/tasks?task=${t.id}`}
                      className="min-w-0 flex-1 truncate text-sm hover:underline"
                    >
                      {t.title}
                    </Link>
                    <span className="text-muted shrink-0 text-xs">
                      {data.clientName(t.organisationId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="New leads"
            description="Last 7 days"
            action={
              <Link href="/workspace/leads" className="text-brand-700 text-sm hover:underline">
                Pipeline
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.newLeads.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No new leads this week"
                  description="Visibility Report requests, bookings and contact forms create leads automatically."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {data.newLeads.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/workspace/leads/${l.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.company}</p>
                        <p className="text-muted text-xs">
                          {statusLabel(l.source)} · fit {l.score?.fit.level ?? "unknown"}
                        </p>
                      </div>
                      <StatusBadge kind="lead" value={l.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {showBusiness && (
        <section aria-labelledby="business-heading" className="space-y-4">
          <h2 id="business-heading" className="label-mono text-muted">
            How Mea Creo is performing
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Monthly recurring revenue"
              value={fmtMoneyShort(data.kpis.mrrMinor)}
              hint={`${data.kpis.activeClients} paying client${data.kpis.activeClients === 1 ? "" : "s"}`}
              href="/workspace/business"
            />
            <Stat
              label="Pipeline value (monthly)"
              value={fmtMoneyShort(data.kpis.pipelineValueMinor)}
              hint={`${data.kpis.openLeads} open leads`}
              href="/workspace/leads"
            />
            <Stat
              label="Outstanding invoices"
              value={fmtMoneyShort(data.kpis.outstandingMinor)}
              tone={data.overdueInvoices.length ? "danger" : undefined}
              hint={
                data.overdueInvoices.length
                  ? `${data.overdueInvoices.length} overdue`
                  : "None overdue"
              }
              href="/workspace/billing"
            />
            <Stat
              label="Lead conversion (180 days)"
              value={data.kpis.conversion === null ? "Not enough data" : `${data.kpis.conversion}%`}
              hint={`${data.kpis.renewals.length} renewal${data.kpis.renewals.length === 1 ? "" : "s"} in 30 days`}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Monthly revenue by service"
                description="Active and paused client services"
              />
              <CardBody>
                <BarList
                  ariaLabel="Monthly revenue by service"
                  data={data.serviceRevenue
                    .slice(0, 8)
                    .map((s) => ({ label: s.name, value: s.total, display: fmtMoney(s.total) }))}
                  emptyText="No services sold yet."
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Client health"
                description="Why each client is where they are is on their profile."
              />
              <CardBody>
                <ul className="space-y-3">
                  {[
                    ["healthy", "Healthy", CheckCircle2, "text-success-700"],
                    ["watch", "Watch", AlertTriangle, "text-warning-700"],
                    ["at_risk", "At risk", XCircle, "text-danger-700"],
                    ["paused", "Paused", PauseCircle, "text-subtle"],
                  ].map(([key, label, Icon, cls]) => {
                    const I = Icon as typeof CheckCircle2;
                    return (
                      <li key={key as string}>
                        <Link
                          href={`/workspace/clients?health=${key}`}
                          className="hover:bg-surface-2 flex items-center gap-3 rounded-md px-1 py-1"
                        >
                          <I className={`size-4 ${cls}`} aria-hidden />
                          <span className="flex-1 text-sm">{label as string}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {data.health[key as string] ?? 0}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader
              title="Pipeline by stage"
              description="Estimated monthly value of open leads"
            />
            <CardBody>
              <BarList
                ariaLabel="Pipeline value by stage"
                data={data.pipeline
                  .sort((a, b) => b.value - a.value || b.n - a.n)
                  .map((p) => ({
                    label: `${statusLabel(p.stage)} (${p.n})`,
                    value: Math.max(p.value, 1),
                    display: p.value ? fmtMoney(p.value) : "Value not set",
                    href: `/workspace/leads?stage=${p.stage}`,
                  }))}
                emptyText="No open leads."
              />
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  );
}
