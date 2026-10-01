import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Callout, Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { DueLabel, StatusBadge } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { getDb } from "@/db";
import { INVOICE_STATUSES, invoices, organisations, payments } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { fmtDate, fmtMoney } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { getPlatformSetting } from "@/modules/settings/service";
import { runDailyBillingAction } from "./actions";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: PageProps<"/workspace/billing">) {
  const ctx = await requireStaff("billing.read");
  const sp = await searchParams;
  const tab = (INVOICE_STATUSES as readonly string[]).includes(String(sp.tab))
    ? (sp.tab as (typeof INVOICE_STATUSES)[number])
    : "all";
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const inScope = scope === "all" ? undefined : inArray(invoices.organisationId, scope);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, [totals], [received], billing] = await Promise.all([
    db
      .select({ i: invoices, org: organisations.name })
      .from(invoices)
      .innerJoin(organisations, eq(organisations.id, invoices.organisationId))
      .where(and(inScope, tab === "all" ? undefined : eq(invoices.status, tab)))
      .orderBy(desc(invoices.createdAt))
      .limit(300),
    db
      .select({
        outstanding: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}) filter (where ${invoices.status} in ('open','overdue')),0)::bigint`,
        overdue: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}) filter (where ${invoices.status} = 'overdue'),0)::bigint`,
        overdueCount: sql<number>`count(*) filter (where ${invoices.status} = 'overdue')::int`,
      })
      .from(invoices)
      .where(and(inScope, eq(invoices.currency, "ZAR"))),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amountMinor}),0)::bigint` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "succeeded"),
          gte(payments.receivedAt, monthStart),
          eq(payments.currency, "ZAR"),
          scope === "all" ? undefined : inArray(payments.organisationId, scope),
        ),
      ),
    getPlatformSetting(db, "billing"),
  ]);
  const paymentsIntegration = resolveIntegration("payments");
  const accounting = resolveIntegration("accounting");

  return (
    <>
      <PageHeader
        title="Billing"
        description="Invoices, payments and billing status. Unpaid clients have automated services paused, never their data deleted."
        actions={
          ctx.can("billing.manage") && (
            <LinkButton href="/workspace/billing/new">
              <Plus className="size-4" aria-hidden /> New invoice
            </LinkButton>
          )
        }
      />
      <div className="mb-6 space-y-3">
        {(!paymentsIntegration.available || paymentsIntegration.adapter.isMock) && (
          <Callout tone="info" title="Payfast: not connected">
            Online payments use the test checkout: no real money moves. Add Payfast merchant
            credentials to take real payments. REQUIRES CONFIGURATION.
          </Callout>
        )}
        {(!accounting.available || accounting.adapter.isMock) && (
          <Callout tone="info" title="Xero: not connected">
            Invoices are kept here and not synced to accounting. Connect Xero in Settings →
            Integrations. REQUIRES CONFIGURATION.
          </Callout>
        )}
        {!billing.eftDetails && (
          <Callout tone="warning" title="No EFT details on invoices">
            Add your bank details in Settings → Billing so invoices show how to pay by EFT.
          </Callout>
        )}
        {billing.pricesAreDemo && (
          <Callout tone="warning" title="Demo prices in use">
            Catalogue prices are placeholders. Set real prices in Services & pricing.
          </Callout>
        )}
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding (ZAR)" value={fmtMoney(Number(totals?.outstanding ?? 0))} />
        <Stat
          label="Overdue (ZAR)"
          value={fmtMoney(Number(totals?.overdue ?? 0))}
          hint={`${totals?.overdueCount ?? 0} invoice${totals?.overdueCount === 1 ? "" : "s"}`}
          tone={Number(totals?.overdue) > 0 ? "danger" : "default"}
        />
        <Stat label="Received this month (ZAR)" value={fmtMoney(Number(received?.total ?? 0))} />
      </div>
      <Tabs
        baseHref="/workspace/billing"
        active={tab}
        tabs={[
          { key: "all", label: "All" },
          ...INVOICE_STATUSES.map((s) => ({
            key: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          })),
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted px-4 py-6 text-center">
                      No invoices.
                    </td>
                  </tr>
                )}
                {rows.map(({ i, org }) => (
                  <tr
                    key={i.id}
                    className="border-border hover:bg-surface-2 border-b last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/workspace/billing/${i.id}`}
                        className="font-medium whitespace-nowrap hover:underline"
                      >
                        {i.number}
                      </Link>
                      <p className="text-muted text-xs whitespace-nowrap">
                        {i.kind.replace("_", "-")} · {fmtDate(i.issuedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{org}</td>
                    <td className="px-4 py-3">
                      <StatusBadge kind="invoice" value={i.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtMoney(i.totalMinor, i.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtMoney(i.totalMinor - i.amountPaidMinor, i.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {i.status === "open" || i.status === "overdue" ? (
                        <DueLabel due={i.dueAt} />
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {ctx.can("billing.manage") && (
          <Card className="h-fit">
            <CardHeader
              title="Billing cycle"
              description="Runs automatically each day with the worker. Issues due monthly invoices, marks overdue ones, sends reminders and pauses automated services after the grace period."
            />
            <CardBody>
              <ActionForm action={runDailyBillingAction}>
                <SubmitButton variant="secondary">Run billing cycle now</SubmitButton>
              </ActionForm>
              <p className="text-muted mt-3 text-xs">
                Terms: {billing.paymentTermsDays} days · reminders{" "}
                {billing.reminderDaysAfterDue.join(", ")} days after due · pause after{" "}
                {billing.pauseAfterOverdueDays} days overdue.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
