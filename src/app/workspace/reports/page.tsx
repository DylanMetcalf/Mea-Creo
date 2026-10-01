import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { clients, organisations, reports } from "@/db/schema";
import { fmtDate, fmtRelative } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { runClientAction } from "../clients/actions";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireStaff();
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const inScope = scope === "all" ? undefined : inArray(reports.organisationId, scope);
  const [rows, clientRows] = await Promise.all([
    db
      .select({ r: reports, org: organisations.name })
      .from(reports)
      .innerJoin(organisations, eq(organisations.id, reports.organisationId))
      .where(inScope)
      .orderBy(desc(reports.createdAt))
      .limit(200),
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
  ]);
  return (
    <>
      <PageHeader
        title="Reports"
        description="Monthly reports separate what we did from what changed, and name the source of every number. Clients see them only once published."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {rows.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="No reports yet"
            description="Run a Monthly Client Review to draft one."
          />
        ) : (
          <Card>
            <ul className="divide-border divide-y">
              {rows.map(({ r, org }) => (
                <li key={r.id}>
                  <Link
                    href={`/workspace/reports/${r.id}`}
                    className="hover:bg-surface-2 flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.title}</span>
                      <span className="text-muted block text-xs">
                        {org} ·{" "}
                        {r.periodStart
                          ? `${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)}`
                          : r.kind}{" "}
                        · updated {fmtRelative(r.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge kind="report" value={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {ctx.can("runs.execute") && (
          <Card className="h-fit">
            <CardHeader
              title="Draft a monthly report"
              description="Runs the Monthly Client Review: gathers the month's work, any connected data, and drafts a report for review."
            />
            <CardBody>
              <form action={runClientAction} className="space-y-3">
                <input type="hidden" name="kind" value="monthly_client_review" />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Client</span>
                  <select
                    name="organisationId"
                    className="border-border-strong bg-surface h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    {clientRows.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton>Run Monthly Client Review</SubmitButton>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
