import { desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { audits, leads, organisations } from "@/db/schema";
import { fmtRelative } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { runAdHocAuditAction } from "./actions";

export const metadata: Metadata = { title: "Visibility reports" };

export default async function AuditsPage() {
  const ctx = await requireStaff("leads.read");
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const where =
    scope === "all"
      ? undefined
      : scope.length
        ? or(isNull(audits.organisationId), inArray(audits.organisationId, scope))
        : isNull(audits.organisationId);
  const rows = await db
    .select({ audit: audits, lead: leads.company, org: organisations.name })
    .from(audits)
    .leftJoin(leads, eq(leads.id, audits.leadId))
    .leftJoin(organisations, eq(organisations.id, audits.organisationId))
    .where(where)
    .orderBy(desc(audits.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Visibility reports"
        description="Every Visibility Report: public requests, prospects and clients. Findings are rule-based and explained. There is no overall score."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Run one on any website, or wait for requests from the public Visibility Report page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs">
                  <tr className="border-border border-b">
                    <th className="px-4 py-3 font-medium">Website</th>
                    <th className="px-4 py-3 font-medium">For</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Findings</th>
                    <th className="px-4 py-3 font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ audit, lead, org }) => (
                    <tr
                      key={audit.id}
                      className="border-border hover:bg-surface-2 border-b last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/workspace/audits/${audit.id}`}
                          className="font-medium hover:underline"
                        >
                          {audit.companyName ?? new URL(audit.url).hostname}
                        </Link>
                        <p className="text-muted text-xs">{new URL(audit.url).hostname}</p>
                      </td>
                      <td className="text-ink-soft px-4 py-3">
                        {org ? `Client: ${org}` : lead ? `Lead: ${lead}` : "Ad hoc"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="audit" value={audit.status} />
                      </td>
                      <td className="text-ink-soft px-4 py-3 tabular-nums">
                        {audit.result
                          ? `${audit.result.counts.improvements} to improve · ${audit.result.counts.critical} critical`
                          : "-"}
                      </td>
                      <td className="text-muted px-4 py-3">{fmtRelative(audit.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {ctx.can("audits.run") && (
          <Card className="h-fit">
            <CardHeader
              title="Run a Visibility Report"
              description="On any public website. Save it as a lead afterwards if it's a prospect."
            />
            <CardBody>
              <ActionForm action={runAdHocAuditAction} className="space-y-3">
                <TextField name="url" label="Website" placeholder="company.co.za" required />
                <TextField name="companyName" label="Company name (optional)" />
                <SubmitButton>Run report</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
