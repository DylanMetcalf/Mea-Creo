import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { agentRuns, clients, clientServices, invoices, leads, payments } from "@/db/schema";
import { requireApiKey } from "@/modules/api-keys/guard";

export const dynamic = "force-dynamic";

/** Business snapshot for Founder OS. Amounts are integer minor units (ZAR cents). */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "read:business");
  if ("error" in auth) return auth.error;
  const { db } = auth;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [[mrr], clientRows, [pipeline], [ar], [received], [ai]] = await Promise.all([
    db
      .select({ v: sql<number>`coalesce(sum(${clientServices.monthlyMinor}),0)::bigint` })
      .from(clientServices)
      .innerJoin(clients, eq(clients.organisationId, clientServices.organisationId))
      .where(
        and(
          eq(clientServices.status, "active"),
          eq(clientServices.currency, "ZAR"),
          eq(clients.isInternal, false),
        ),
      ),
    db
      .select({
        lifecycle: clients.lifecycle,
        health: clients.health,
        isInternal: clients.isInternal,
      })
      .from(clients),
    db
      .select({
        n: sql<number>`count(*)::int`,
        v: sql<number>`coalesce(sum(${leads.estimatedMonthlyMinor}),0)::bigint`,
      })
      .from(leads)
      .where(
        inArray(leads.stage, [
          "new",
          "audit_generated",
          "qualified",
          "contacted",
          "call_booked",
          "call_completed",
          "proposal_draft",
          "proposal_sent",
          "negotiation",
        ]),
      ),
    db
      .select({
        open: sql<number>`coalesce(sum(${invoices.totalMinor}-${invoices.amountPaidMinor}) filter (where ${invoices.status} in ('open','overdue')),0)::bigint`,
        overdue: sql<number>`coalesce(sum(${invoices.totalMinor}-${invoices.amountPaidMinor}) filter (where ${invoices.status}='overdue'),0)::bigint`,
      })
      .from(invoices)
      .where(eq(invoices.currency, "ZAR")),
    db
      .select({ v: sql<number>`coalesce(sum(${payments.amountMinor}),0)::bigint` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "succeeded"),
          eq(payments.currency, "ZAR"),
          gte(payments.receivedAt, monthStart),
        ),
      ),
    db
      .select({ v: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}),0)::bigint` })
      .from(agentRuns)
      .where(gte(agentRuns.createdAt, monthStart)),
  ]);
  const external = clientRows.filter((c) => !c.isInternal);
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    currency: "ZAR",
    mrrMinor: Number(mrr?.v ?? 0),
    clients: {
      active: external.filter((c) => c.lifecycle === "active").length,
      onboarding: external.filter((c) => c.lifecycle === "onboarding").length,
      atRisk: external.filter((c) => c.health === "at_risk").length,
      watch: external.filter((c) => c.health === "watch").length,
    },
    pipeline: { openLeads: pipeline?.n ?? 0, estimatedMonthlyMinor: Number(pipeline?.v ?? 0) },
    receivables: {
      outstandingMinor: Number(ar?.open ?? 0),
      overdueMinor: Number(ar?.overdue ?? 0),
    },
    cashReceivedThisMonthMinor: Number(received?.v ?? 0),
    aiCostThisMonthMicroUsd: Number(ai?.v ?? 0),
  });
}
