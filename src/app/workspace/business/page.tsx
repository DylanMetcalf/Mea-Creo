import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList, Sparkline } from "@/components/ui/charts";
import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  Progress,
  Stat,
} from "@/components/ui/primitives";
import { HealthLabel, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import {
  agentRuns,
  clients,
  clientServices,
  invoices,
  leads,
  payments,
  services,
} from "@/db/schema";
import { formatMicroUsd } from "@/integrations/ai/pricing";
import { fmtMoney } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { getPlatformSetting } from "@/modules/settings/service";

export const metadata: Metadata = { title: "Business" };

const OPEN_STAGES = [
  "new",
  "audit_generated",
  "qualified",
  "contacted",
  "call_booked",
  "call_completed",
  "proposal_draft",
  "proposal_sent",
  "negotiation",
] as const;

export default async function BusinessPage() {
  await requireStaff("dashboard.business");
  const db = await getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [byService, clientRows, pipeline, [outstanding], monthly, [aiSpend], targets, billing] =
    await Promise.all([
      db
        .select({
          name: services.name,
          total: sql<number>`sum(${clientServices.monthlyMinor})::bigint`,
          clients: sql<number>`count(distinct ${clientServices.organisationId})::int`,
        })
        .from(clientServices)
        .innerJoin(services, eq(services.id, clientServices.serviceId))
        .innerJoin(clients, eq(clients.organisationId, clientServices.organisationId))
        .where(
          and(
            eq(clientServices.status, "active"),
            eq(clientServices.currency, "ZAR"),
            eq(clients.isInternal, false),
          ),
        )
        .groupBy(services.name),
      db
        .select({
          id: clients.organisationId,
          name: clients.name,
          health: clients.health,
          lifecycle: clients.lifecycle,
          billingState: clients.billingState,
          isInternal: clients.isInternal,
        })
        .from(clients),
      db
        .select({
          stage: leads.stage,
          n: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${leads.estimatedMonthlyMinor}),0)::bigint`,
        })
        .from(leads)
        .where(inArray(leads.stage, [...OPEN_STAGES]))
        .groupBy(leads.stage),
      db
        .select({
          total: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}),0)::bigint`,
        })
        .from(invoices)
        .where(and(inArray(invoices.status, ["open", "overdue"]), eq(invoices.currency, "ZAR"))),
      db
        .select({
          month: sql<string>`to_char(${payments.receivedAt}, 'YYYY-MM')`,
          total: sql<number>`sum(${payments.amountMinor})::bigint`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, "succeeded"),
            eq(payments.currency, "ZAR"),
            gte(payments.receivedAt, sixMonthsAgo),
          ),
        )
        .groupBy(sql`1`),
      db
        .select({ total: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}),0)::bigint` })
        .from(agentRuns)
        .where(gte(agentRuns.createdAt, monthStart)),
      getPlatformSetting(db, "targets"),
      getPlatformSetting(db, "billing"),
    ]);

  const mrr = byService.reduce((s, r) => s + Number(r.total), 0);
  const external = clientRows.filter((c) => !c.isInternal && c.lifecycle !== "offboarded");
  const pipelineValue = pipeline.reduce((s, r) => s + Number(r.value), 0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const received = months.map((m) => Number(monthly.find((r) => r.month === m)?.total ?? 0));
  const healthOrder = ["at_risk", "watch", "healthy", "paused"] as const;

  return (
    <>
      <PageHeader
        title="Business"
        description="How Mea Creo itself is doing. Figures come from this system only (ZAR, excluding VAT)."
      />
      {billing.pricesAreDemo && (
        <div className="mb-6">
          <Callout tone="warning" title="Includes demo prices">
            Revenue figures are based on placeholder prices until real prices are set.
          </Callout>
        </div>
      )}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Monthly recurring revenue"
          value={fmtMoney(mrr)}
          hint="Active client services"
        />
        <Stat
          label="Active clients"
          value={external.filter((c) => c.lifecycle === "active").length}
          hint={`${external.filter((c) => c.lifecycle === "onboarding").length} onboarding`}
          href="/workspace/clients"
        />
        <Stat
          label="Open pipeline"
          value={fmtMoney(pipelineValue)}
          hint={`${pipeline.reduce((s, r) => s + r.n, 0)} open leads, estimated monthly`}
          href="/workspace/leads"
        />
        <Stat
          label="Outstanding invoices"
          value={fmtMoney(Number(outstanding?.total ?? 0))}
          href="/workspace/billing?tab=open"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Monthly revenue by service"
            description="Active services, after agreed discounts."
          />
          <CardBody>
            <BarList
              ariaLabel="Monthly revenue by service"
              data={byService
                .map((r) => ({
                  label: r.name,
                  value: Number(r.total),
                  display: fmtMoney(Number(r.total)),
                  detail: `${r.name}: ${fmtMoney(Number(r.total))} a month from ${r.clients} client${r.clients === 1 ? "" : "s"}`,
                }))
                .sort((a, b) => b.value - a.value)}
              emptyText="No active paid services yet."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Client health"
            description="Worst condition wins; reasons are on each client."
          />
          <CardBody>
            <ul className="space-y-2">
              {healthOrder.map((h) => {
                const list = external.filter((c) => c.health === h);
                return (
                  <li key={h} className="flex items-start justify-between gap-3 text-sm">
                    <HealthLabel value={h} />
                    <span className="text-right">
                      <span className="font-semibold tabular-nums">{list.length}</span>
                      {list.length > 0 && h !== "healthy" && (
                        <span className="text-muted block text-xs">
                          {list.map((c, i) => (
                            <span key={c.id}>
                              {i > 0 && ", "}
                              <Link href={`/workspace/clients/${c.id}`} className="hover:underline">
                                {c.name}
                              </Link>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            title="Pipeline by stage"
            description="Estimated monthly value of open leads."
          />
          <CardBody>
            <BarList
              ariaLabel="Pipeline by stage"
              data={OPEN_STAGES.map((s) => pipeline.find((p) => p.stage === s))
                .filter((p): p is NonNullable<typeof p> => !!p)
                .map((p) => ({
                  label: statusLabel(p.stage),
                  value: Number(p.value) || p.n,
                  display: Number(p.value)
                    ? fmtMoney(Number(p.value))
                    : `${p.n} lead${p.n === 1 ? "" : "s"}`,
                  href: `/workspace/leads?stage=${p.stage}`,
                  detail: `${p.n} lead(s), ${fmtMoney(Number(p.value))}/mo estimated`,
                }))}
              emptyText="No open leads."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cash received" description="Last six months" />
          <CardBody className="space-y-2">
            <div className="flex items-end justify-between">
              <p className="text-2xl font-semibold tabular-nums">{fmtMoney(received[5])}</p>
              <Sparkline values={received} />
            </div>
            <p className="text-muted text-xs">
              This month so far. Six-month total {fmtMoney(received.reduce((a, b) => a + b, 0))}.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Targets" />
          <CardBody className="space-y-4">
            {targets.targetMrrMinor ? (
              <div>
                <Progress
                  value={(mrr / targets.targetMrrMinor) * 100}
                  label={`MRR ${fmtMoney(mrr)} of ${fmtMoney(targets.targetMrrMinor)}`}
                />
              </div>
            ) : (
              <p className="text-muted text-sm">
                No targets set.{" "}
                <Link href="/workspace/settings?tab=business" className="text-brand-700 underline">
                  Set targets
                </Link>
              </p>
            )}
            {targets.monthlyOperatingCostsMinor != null && (
              <p className="text-sm">
                Estimated monthly margin:{" "}
                <span className="font-semibold tabular-nums">
                  {fmtMoney(mrr - targets.monthlyOperatingCostsMinor)}
                </span>
                <span className="text-muted block text-xs">
                  MRR minus your recorded operating costs (
                  {fmtMoney(targets.monthlyOperatingCostsMinor)}).
                </span>
              </p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="AI costs this month" />
          <CardBody>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMicroUsd(Number(aiSpend?.total ?? 0))}
            </p>
            <p className="text-muted mt-1 text-xs">
              Estimated from token usage.{" "}
              <Link href="/workspace/runs" className="text-brand-700 underline">
                By agent
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
