import { eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportBody } from "@/components/reports/report-body";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { organisations, reports } from "@/db/schema";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { publishReportAction, saveReportAction, submitReportAction } from "../actions";

export const metadata: Metadata = { title: "Report" };

const FIELDS = [
  ["whatWeDid", "What we did"],
  ["whatChanged", "What changed"],
  ["whatWeLearned", "What we learned"],
  ["opportunities", "Opportunities"],
  ["whatHappensNext", "What happens next"],
  ["needsFromYou", "What we need from the client"],
] as const;

export default async function ReportPage({
  params,
  searchParams,
}: PageProps<"/workspace/reports/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const [row] = await db
    .select({ r: reports, org: organisations.name })
    .from(reports)
    .innerJoin(organisations, eq(organisations.id, reports.organisationId))
    .where(eq(reports.id, id))
    .limit(1);
  if (!row) notFound();
  const { r, org } = row;
  await assertStaffClientAccess(ctx, r.organisationId);
  const editing = sp.edit === "1" && r.status !== "published" && ctx.can("reports.write");

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/reports" className="hover:text-ink">
          Reports
        </Link>{" "}
        / {r.title}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
            <StatusBadge kind="report" value={r.status} />
          </div>
          <p className="text-muted mt-1 text-sm">
            <Link
              href={`/workspace/clients/${r.organisationId}?tab=reports`}
              className="text-brand-700 decoration-brand-300 underline underline-offset-[3px] hover:decoration-current"
            >
              {org}
            </Link>
            {r.periodStart && ` · ${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)}`}
            {r.publishedAt && ` · published ${fmtDateTime(r.publishedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/reports/${r.id}/pdf`} variant="secondary" target="_blank">
            <Download className="size-4" aria-hidden /> PDF
          </LinkButton>
          {r.status !== "published" && ctx.can("reports.write") && (
            <LinkButton
              href={editing ? `/workspace/reports/${r.id}` : `/workspace/reports/${r.id}?edit=1`}
              variant="secondary"
            >
              {editing ? "Preview" : "Edit"}
            </LinkButton>
          )}
          {r.status === "draft" && ctx.can("reports.write") && (
            <ActionForm action={submitReportAction}>
              <input type="hidden" name="reportId" value={r.id} />
              <SubmitButton variant="secondary">Submit for review</SubmitButton>
            </ActionForm>
          )}
          {r.status !== "published" && ctx.can("reports.publish") && (
            <ActionForm action={publishReportAction}>
              <input type="hidden" name="reportId" value={r.id} />
              <SubmitButton>Publish to client</SubmitButton>
            </ActionForm>
          )}
        </div>
      </header>
      {r.status !== "published" && (
        <div className="mb-6">
          <Callout tone="info">
            The client can&apos;t see this report until it&apos;s published. Publishing notifies
            them in their portal.
          </Callout>
        </div>
      )}
      {editing ? (
        <Card>
          <CardHeader
            title="Edit narrative"
            description="One point per line. Numbers come from the run and their sources, and are not edited here."
          />
          <CardBody>
            <ActionForm action={saveReportAction} className="space-y-4">
              <input type="hidden" name="reportId" value={r.id} />
              <TextField name="title" label="Title" defaultValue={r.title} />
              <TextArea
                name="headline"
                label="Headline"
                defaultValue={r.content.headline}
                rows={3}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {FIELDS.map(([key, label]) => (
                  <TextArea
                    key={key}
                    name={key}
                    label={label}
                    defaultValue={r.content[key].join("\n")}
                    rows={6}
                  />
                ))}
              </div>
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      ) : (
        <ReportBody content={r.content} />
      )}
    </>
  );
}
