import { eq } from "drizzle-orm";
import { ExternalLink, Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/audits/report-view";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form";
import { Callout, Card, CardBody } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { audits, leads, organisations } from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { rerunAuditAction, saveAuditAsLeadAction } from "../actions";

export const metadata: Metadata = { title: "Visibility report" };

export default async function AuditPage({ params }: PageProps<"/workspace/audits/[id]">) {
  const ctx = await requireStaff("leads.read");
  const { id } = await params;
  const db = await getDb();
  const [audit] = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  if (!audit) notFound();
  if (audit.organisationId) await assertStaffClientAccess(ctx, audit.organisationId);
  const [lead] = audit.leadId
    ? await db
        .select({ id: leads.id, company: leads.company })
        .from(leads)
        .where(eq(leads.id, audit.leadId))
    : [];
  const [org] = audit.organisationId
    ? await db
        .select({ id: organisations.id, name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, audit.organisationId))
    : [];
  const host = new URL(audit.url).hostname.replace(/^www\./, "");
  const pending = audit.status === "queued" || audit.status === "running";
  if (pending) kickJobs();

  return (
    <>
      {pending && <AutoRefresh />}
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/audits" className="hover:text-ink">
          Visibility reports
        </Link>{" "}
        / {host}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{audit.companyName ?? host}</h1>
            <StatusBadge kind="audit" value={audit.status} />
          </div>
          <p className="text-muted mt-1 text-sm">
            <a href={audit.url} target="_blank" rel="noreferrer" className="hover:underline">
              {audit.url}
            </a>{" "}
            · requested {fmtDateTime(audit.createdAt)}
            {audit.completedAt && ` · completed ${fmtDateTime(audit.completedAt)}`}
          </p>
          <p className="mt-1 text-sm">
            {org ? (
              <Link
                href={`/workspace/clients/${org.id}?tab=visibility`}
                className="text-brand-700 hover:underline"
              >
                Client: {org.name}
              </Link>
            ) : lead ? (
              <Link href={`/workspace/leads/${lead.id}`} className="text-brand-700 hover:underline">
                Lead: {lead.company}
              </Link>
            ) : (
              <span className="text-muted">Not linked to a lead or client</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {audit.status === "complete" && (
            <LinkButton
              href={`/visibility-report/${audit.publicToken}`}
              variant="secondary"
              target="_blank"
            >
              Client-facing view <ExternalLink className="size-3.5" aria-hidden />
            </LinkButton>
          )}
          {!pending && ctx.can("audits.run") && (
            <form action={rerunAuditAction}>
              <input type="hidden" name="auditId" value={audit.id} />
              <SubmitButton variant="secondary">Run again</SubmitButton>
            </form>
          )}
          {!audit.leadId && !audit.organisationId && ctx.can("leads.write") && (
            <form action={saveAuditAsLeadAction}>
              <input type="hidden" name="auditId" value={audit.id} />
              <SubmitButton>Save as lead</SubmitButton>
            </form>
          )}
        </div>
      </header>

      {pending ? (
        <Card>
          <CardBody className="flex items-center gap-3 py-10" role="status" aria-live="polite">
            <Loader2 className="text-brand-600 size-5 animate-spin" aria-hidden />
            Analysing {host}. This page updates automatically.
          </CardBody>
        </Card>
      ) : audit.status === "failed" || !audit.result ? (
        <Callout tone="danger" title="The report could not be completed">
          {audit.error ?? "Unknown error."} Check the address and run it again.
        </Callout>
      ) : (
        <>
          <p className="font-display text-ink mb-6 max-w-3xl text-xl">{audit.result.headline}</p>
          <ReportView result={audit.result} showSignals />
        </>
      )}
    </>
  );
}
