import { desc, eq } from "drizzle-orm";
import { ExternalLink, FileText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportSummary } from "@/components/audits/report-view";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  EmptyState,
} from "@/components/ui/primitives";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { ScoreDimensions } from "@/components/workspace/score";
import { getDb } from "@/db";
import {
  audits,
  LEAD_STAGES,
  leadActivities,
  leads,
  meetings,
  proposals,
  users,
} from "@/db/schema";
import { fmtDateTime, fmtMoney, fmtRelative, humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { serviceName } from "@/modules/services/catalogue";
import {
  convertLeadAction,
  createProposalAction,
  leadNoteAction,
  runLeadAuditAction,
  updateLeadAction,
  updateLeadStageAction,
} from "../actions";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/workspace/leads/[id]">) {
  const ctx = await requireStaff("leads.read");
  const { id } = await params;
  const db = await getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) notFound();
  const [owner] = lead.ownerId
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, lead.ownerId))
    : [];
  const [activity, auditRows, meetingRows, proposalRows] = await Promise.all([
    db
      .select({ a: leadActivities, actor: users.name })
      .from(leadActivities)
      .leftJoin(users, eq(users.id, leadActivities.actorId))
      .where(eq(leadActivities.leadId, id))
      .orderBy(desc(leadActivities.createdAt)),
    db.select().from(audits).where(eq(audits.leadId, id)).orderBy(desc(audits.createdAt)),
    db.select().from(meetings).where(eq(meetings.leadId, id)).orderBy(desc(meetings.startsAt)),
    db.select().from(proposals).where(eq(proposals.leadId, id)).orderBy(desc(proposals.createdAt)),
  ]);
  const audit = auditRows.find((a) => a.status === "complete");
  const canWrite = ctx.can("leads.write");

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/leads" className="hover:text-ink">
          Leads
        </Link>{" "}
        / {lead.company}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.company}</h1>
            <StatusBadge kind="lead" value={lead.stage} />
            {lead.isDemo && <Badge tone="warning">Demo</Badge>}
          </div>
          <p className="text-muted mt-1 text-sm">
            {[
              lead.contactName &&
                `${lead.contactName}${lead.contactRole ? `, ${lead.contactRole}` : ""}`,
              lead.industry,
              lead.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-subtle mt-1 text-xs">
            Source: {statusLabel(lead.source)} · added {fmtRelative(lead.createdAt)} · owner{" "}
            {owner?.name ?? "unassigned"} · consent{" "}
            {lead.consentAt ? `recorded ${fmtRelative(lead.consentAt)}` : "not recorded"}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {lead.website && (
              <form action={runLeadAuditAction}>
                <input type="hidden" name="leadId" value={id} />
                <SubmitButton variant="secondary">
                  <Search className="size-4" aria-hidden /> Run Visibility Report
                </SubmitButton>
              </form>
            )}
            <LinkButton href={`/workspace/meetings?new=1&lead=${id}`} variant="secondary">
              Book call
            </LinkButton>
            {ctx.can("proposals.write") && (
              <form action={createProposalAction}>
                <input type="hidden" name="leadId" value={id} />
                <SubmitButton>
                  <FileText className="size-4" aria-hidden /> Draft proposal
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {lead.opportunitySummary && (
            <Callout tone="brand" title="Opportunity">
              <p>{lead.opportunitySummary}</p>
              {lead.outreachAngle && (
                <p className="mt-2">
                  <span className="font-medium">Outreach angle:</span> {lead.outreachAngle}
                </p>
              )}
              {lead.recommendedServices.length > 0 && (
                <p className="mt-2">
                  <span className="font-medium">Recommended:</span>{" "}
                  {lead.recommendedServices.map(serviceName).join(", ")}
                </p>
              )}
            </Callout>
          )}
          <Card>
            <CardHeader
              title="Qualification"
              description="Explained dimensions. Recalculated when details or the snapshot change."
            />
            <CardBody>
              {lead.score ? (
                <ScoreDimensions score={lead.score} />
              ) : (
                <p className="text-muted text-sm">
                  Not qualified yet. Add industry and size, or run a Visibility Report.
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Visibility snapshot"
              action={
                audit && (
                  <LinkButton href={`/workspace/audits/${audit.id}`} size="sm" variant="secondary">
                    Open report
                  </LinkButton>
                )
              }
            />
            <CardBody className="space-y-4">
              {audit?.result ? (
                <>
                  <p className="text-ink-soft">{audit.result.headline}</p>
                  <ReportSummary result={audit.result} />
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {audit.result.opportunities.slice(0, 5).map((o) => (
                      <li key={o.title}>{o.title}</li>
                    ))}
                  </ol>
                  <a
                    href={`/visibility-report/${audit.publicToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    Client-facing report link <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </>
              ) : auditRows[0] ? (
                <p className="text-muted text-sm">
                  Latest report: {statusLabel(auditRows[0].status)}
                  {auditRows[0].error ? `: ${auditRows[0].error}` : ""}
                </p>
              ) : (
                <EmptyState
                  title="No snapshot yet"
                  description={
                    lead.website
                      ? "Run a Visibility Report to see their biggest opportunities."
                      : "Add their website to run one."
                  }
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activity" />
            <CardBody className="space-y-4">
              {canWrite && (
                <ActionForm action={leadNoteAction} className="space-y-2" resetOnSuccess>
                  <input type="hidden" name="leadId" value={id} />
                  <TextArea name="summary" label="Log an activity" rows={2} />
                  <div className="flex items-end gap-2">
                    <SelectField
                      name="type"
                      label="Type"
                      options={["note", "call", "email", "meeting"].map((t) => ({
                        value: t,
                        label: humanize(t),
                      }))}
                    />
                    <SubmitButton size="sm" variant="secondary">
                      Log
                    </SubmitButton>
                  </div>
                </ActionForm>
              )}
              <ol className="space-y-3">
                {activity.map(({ a, actor }) => (
                  <li key={a.id} className="text-sm">
                    <p>{a.summary}</p>
                    <p className="text-muted text-xs">
                      {humanize(a.type)} · {actor ?? "System"} · {fmtDateTime(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {canWrite && (
            <Card>
              <CardHeader title="Stage" />
              <CardBody>
                <form action={updateLeadStageAction} className="space-y-3">
                  <input type="hidden" name="leadId" value={id} />
                  <label htmlFor="stage" className="sr-only">
                    Stage
                  </label>
                  <select
                    id="stage"
                    name="stage"
                    defaultValue={lead.stage}
                    className="border-border-strong bg-surface h-10 w-full rounded-lg border px-3 text-sm"
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                  <input
                    name="reason"
                    placeholder="Reason (if lost)"
                    className="border-border bg-surface h-9 w-full rounded-lg border px-3 text-sm"
                    aria-label="Reason if lost"
                  />
                  <SubmitButton size="sm" variant="secondary">
                    Update stage
                  </SubmitButton>
                </form>
                {!lead.clientOrganisationId && ctx.can("clients.write") && (
                  <form action={convertLeadAction} className="border-border mt-4 border-t pt-4">
                    <input type="hidden" name="leadId" value={id} />
                    <p className="text-muted mb-2 text-xs">
                      Signed outside the system? Create the client directly.
                    </p>
                    <SubmitButton size="sm" variant="ghost">
                      Convert to client
                    </SubmitButton>
                  </form>
                )}
                {lead.clientOrganisationId && (
                  <LinkButton
                    href={`/workspace/clients/${lead.clientOrganisationId}`}
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                  >
                    Open client
                  </LinkButton>
                )}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Meetings" />
            <CardBody className="space-y-2 text-sm">
              {meetingRows.length === 0 && <p className="text-muted">None yet.</p>}
              {meetingRows.map((m) => (
                <Link
                  key={m.id}
                  href={`/workspace/meetings/${m.id}`}
                  className="hover:bg-surface-2 block rounded-md p-2"
                >
                  <p className="font-medium">{m.title}</p>
                  <p className="text-muted text-xs">
                    {fmtDateTime(m.startsAt)} · {statusLabel(m.status)}
                  </p>
                </Link>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Proposals" />
            <CardBody className="space-y-2 text-sm">
              {proposalRows.length === 0 && <p className="text-muted">None yet.</p>}
              {proposalRows.map((p) => (
                <Link
                  key={p.id}
                  href={`/workspace/proposals/${p.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between rounded-md p-2"
                >
                  <span>{p.number}</span>
                  <StatusBadge kind="proposal" value={p.status} />
                </Link>
              ))}
            </CardBody>
          </Card>
          {canWrite && (
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <details>
                  <summary className="text-brand-700 cursor-pointer text-sm">Edit details</summary>
                  <ActionForm action={updateLeadAction} className="mt-3 space-y-3">
                    <input type="hidden" name="leadId" value={id} />
                    <input
                      type="hidden"
                      name="source"
                      value={
                        ["manual", "referral", "linkedin", "outreach", "import"].includes(
                          lead.source,
                        )
                          ? lead.source
                          : "manual"
                      }
                    />
                    <TextField
                      name="company"
                      label="Company"
                      defaultValue={lead.company}
                      required
                    />
                    <TextField name="website" label="Website" defaultValue={lead.website ?? ""} />
                    <TextField
                      name="contactName"
                      label="Contact"
                      defaultValue={lead.contactName ?? ""}
                    />
                    <TextField
                      name="contactRole"
                      label="Role"
                      defaultValue={lead.contactRole ?? ""}
                    />
                    <TextField name="email" label="Email" defaultValue={lead.email ?? ""} />
                    <TextField name="phone" label="Phone" defaultValue={lead.phone ?? ""} />
                    <TextField
                      name="linkedinUrl"
                      label="LinkedIn"
                      defaultValue={lead.linkedinUrl ?? ""}
                    />
                    <TextField
                      name="industry"
                      label="Industry"
                      defaultValue={lead.industry ?? ""}
                    />
                    <TextField
                      name="location"
                      label="Location"
                      defaultValue={lead.location ?? ""}
                    />
                    <TextField
                      name="employeeRange"
                      label="Size (e.g. 11-50)"
                      defaultValue={lead.employeeRange ?? ""}
                    />
                    <TextField
                      name="estimatedMonthly"
                      label="Est. monthly value (R)"
                      defaultValue={
                        lead.estimatedMonthlyMinor ? String(lead.estimatedMonthlyMinor / 100) : ""
                      }
                    />
                    <TextArea name="goal" label="Goal" defaultValue={lead.goal ?? ""} rows={2} />
                    <SubmitButton size="sm">Save</SubmitButton>
                  </ActionForm>
                </details>
                <DescriptionList
                  className="mt-4"
                  items={[
                    ["Email", lead.email],
                    ["Phone", lead.phone],
                    ["Website", lead.website],
                    [
                      "Estimated value",
                      lead.estimatedMonthlyMinor
                        ? `${fmtMoney(lead.estimatedMonthlyMinor)}/mo`
                        : null,
                    ],
                    ["Message", lead.message],
                  ]}
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
