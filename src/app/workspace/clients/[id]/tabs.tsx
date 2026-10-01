import { asc, eq } from "drizzle-orm";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Lightbulb,
  Lock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ReportSummary } from "@/components/audits/report-view";
import { buttonClass, LinkButton } from "@/components/ui/button";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  EmptyState,
  Progress,
} from "@/components/ui/primitives";
import { DueLabel, StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { FACT_CATEGORIES, services } from "@/db/schema";
import { formatMicroUsd } from "@/integrations/ai/pricing";
import { fmtDate, fmtDateTime, fmtMoney, fmtRelative, humanize } from "@/lib/format";
import { CLIENT_ROLES, ROLE_LABELS } from "@/modules/auth/permissions";
import type { ClientDetail } from "@/modules/clients/queries";
import { listDocuments } from "@/modules/documents/service";
import { MEETING_TYPE_LABELS } from "@/modules/meetings/service";
import { CATEGORY_LABELS } from "@/modules/services/catalogue";
import {
  addCompetitorAction,
  addContactAction,
  addFactAction,
  addGoalAction,
  addNoteAction,
  addTimelineAction,
  addClientServiceAction,
  archiveClientAction,
  archiveDocumentAction,
  automationPauseAction,
  checklistAction,
  clientServiceStateAction,
  factVerificationAction,
  inviteUserAction,
  opportunityAction,
  refreshHealthAction,
  removeCompetitorAction,
  sendMessageAction,
  updateClientAction,
  updateGoalAction,
  updateServiceFocusAction,
  uploadDocumentAction,
} from "../actions";

type Props = { data: ClientDetail };

function Hidden({ data }: Props) {
  return <input type="hidden" name="organisationId" value={data.client.organisationId} />;
}

// ---------------------------------------------------------------------------- Overview

export function OverviewTab({ data }: Props) {
  const { client } = data;
  const checklist = client.onboardingChecklist;
  const done = checklist.filter((c) => c.done).length;
  const openOpps = data.opportunities.filter((o) => o.status === "open");
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader
            title="Why this client is where they are"
            description={
              client.healthCheckedAt
                ? `Checked ${fmtRelative(client.healthCheckedAt)}`
                : "Not checked yet"
            }
            action={
              <form action={refreshHealthAction}>
                <Hidden data={data} />
                <SubmitButton variant="ghost" size="sm">
                  Recheck
                </SubmitButton>
              </form>
            }
          />
          <CardBody>
            {client.healthReasons.length === 0 ? (
              <p className="text-muted text-sm">No signals yet. Run Growth or recheck health.</p>
            ) : (
              <ul className="space-y-2">
                {client.healthReasons.map((r) => (
                  <li key={r.signal + r.detail} className="flex gap-3 text-sm">
                    {r.effect === "positive" ? (
                      <CheckCircle2
                        className="text-success-700 mt-0.5 size-4 shrink-0"
                        aria-label="Positive"
                      />
                    ) : r.effect === "negative" ? (
                      <AlertTriangle
                        className="text-danger-700 mt-0.5 size-4 shrink-0"
                        aria-label="Negative"
                      />
                    ) : (
                      <Circle className="text-subtle mt-0.5 size-4 shrink-0" aria-label="Neutral" />
                    )}
                    <span>
                      <span className="font-medium">{r.signal}:</span> {r.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Opportunities"
            description="Potential opportunity → reason → suggested service. Share only what's genuinely useful."
          />
          <CardBody className="p-0">
            {openOpps.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Lightbulb className="size-6" />}
                  title="No open opportunities"
                  description="Run Growth to analyse services, visibility and gaps."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {openOpps.map((o) => (
                  <li key={o.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{o.title}</p>
                        <p className="text-ink-soft mt-1 text-sm">{o.reason}</p>
                        {o.evidence.length > 0 && (
                          <p className="text-muted mt-1 text-xs">
                            Evidence: {o.evidence.slice(0, 3).join("; ")}
                          </p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <Badge
                            tone={
                              o.priority === "high"
                                ? "clay"
                                : o.priority === "medium"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {o.priority} priority
                          </Badge>
                          {o.clientVisible === "yes" && (
                            <Badge tone="info">Visible to client</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            "accept",
                            "dismiss",
                            o.clientVisible === "yes" ? "unshare" : "share",
                          ] as const
                        ).map((op) => (
                          <form key={op} action={opportunityAction}>
                            <Hidden data={data} />
                            <input type="hidden" name="opportunityId" value={o.id} />
                            <input type="hidden" name="op" value={op} />
                            <SubmitButton
                              variant={op === "accept" ? "secondary" : "ghost"}
                              size="sm"
                            >
                              {op === "accept"
                                ? "Accept"
                                : op === "dismiss"
                                  ? "Dismiss"
                                  : op === "share"
                                    ? "Share with client"
                                    : "Hide from client"}
                            </SubmitButton>
                          </form>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent runs"
            action={
              <Link
                href={`/workspace/runs?client=${client.organisationId}`}
                className="text-brand-700 text-sm hover:underline"
              >
                All runs
              </Link>
            }
          />
          <CardBody className="p-0">
            {data.runs.length === 0 ? (
              <p className="text-muted px-5 py-4 text-sm">No runs yet. Use Run Growth above.</p>
            ) : (
              <ul className="divide-border divide-y">
                {data.runs.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/workspace/runs/${r.id}`}
                      className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                    >
                      <StatusBadge kind="run" value={r.status} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.summary?.headline ?? humanize(r.kind)}
                      </span>
                      <span className="text-muted text-xs">{fmtRelative(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        {checklist.length > 0 && (
          <Card>
            <CardHeader
              title="Onboarding"
              description={`${done} of ${checklist.length} complete`}
            />
            <CardBody className="space-y-3">
              <Progress value={(done / checklist.length) * 100} />
              <ul className="space-y-1">
                {checklist.map((item) => (
                  <li key={item.key}>
                    <form action={checklistAction} className="flex items-center gap-2">
                      <Hidden data={data} />
                      <input type="hidden" name="key" value={item.key} />
                      <input type="hidden" name="done" value={String(!item.done)} />
                      <button
                        type="submit"
                        className="hover:bg-surface-2 flex flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm"
                        aria-pressed={item.done}
                      >
                        {item.done ? (
                          <CheckCircle2 className="text-success-700 size-4" aria-hidden />
                        ) : (
                          <Circle className="text-subtle size-4" aria-hidden />
                        )}
                        <span className={item.done ? "text-muted line-through" : ""}>
                          {item.label}
                        </span>
                        <span className="text-subtle ml-auto text-xs">
                          {item.owner === "client" ? "Client" : "Mea Creo"}
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader
            title="Goals"
            action={
              <Link href="?tab=strategy" className="text-brand-700 text-sm hover:underline">
                Manage
              </Link>
            }
          />
          <CardBody>
            {data.goals.length === 0 ? (
              <p className="text-muted text-sm">No goals yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.goals
                  .filter((g) => g.status === "active")
                  .map((g) => (
                    <li key={g.id} className="text-sm">
                      <p className="font-medium">{g.title}</p>
                      {(g.kpi || g.target) && (
                        <p className="text-muted text-xs">
                          {g.kpi}
                          {g.baseline ? ` · from ${g.baseline}` : ""}
                          {g.current ? ` · now ${g.current}` : ""}
                          {g.target ? ` · target ${g.target}` : ""}
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contacts" />
          <CardBody className="space-y-3">
            {data.contacts.map((c) => (
              <div key={c.id} className="text-sm">
                <p className="font-medium">
                  {c.name} {c.isDecisionMaker && <Badge tone="brand">Decision maker</Badge>}
                </p>
                <p className="text-muted text-xs">
                  {[c.role, c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
            <details>
              <summary className="text-brand-700 cursor-pointer text-sm">Add contact</summary>
              <ActionForm action={addContactAction} className="mt-3 space-y-3" resetOnSuccess>
                <Hidden data={data} />
                <TextField name="name" label="Name" required />
                <TextField name="email" type="email" label="Email" />
                <TextField name="role" label="Role" />
                <TextField name="phone" label="Phone" />
                <CheckboxField name="isDecisionMaker" label="Decision maker" />
                <SubmitButton size="sm">Add contact</SubmitButton>
              </ActionForm>
            </details>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="AI usage this month" />
          <CardBody>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMicroUsd(data.aiSpendMicroUsd)}
            </p>
            <p className="text-muted text-xs">
              Estimated provider cost for agents working on this client.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Strategy & Client Brain

export function StrategyTab({ data }: Props) {
  const grouped = FACT_CATEGORIES.map((category) => ({
    category,
    facts: data.facts.filter((f) => f.category === category),
  })).filter((g) => g.facts.length);
  const unverified = data.facts.filter((f) => f.verification === "unverified");
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader
            title="Client Brain"
            description="The source of truth agents use. Agent suggestions stay unverified until a person confirms them."
          />
          <CardBody className="space-y-5">
            {unverified.length > 0 && (
              <Callout
                tone="clay"
                title={`${unverified.length} suggestion${unverified.length > 1 ? "s" : ""} to review`}
              >
                Agents never treat these as facts until you verify them.
              </Callout>
            )}
            {grouped.length === 0 && (
              <p className="text-muted text-sm">
                Nothing recorded yet. Add company facts, services, audience, tone and claims below.
              </p>
            )}
            {grouped.map((g) => (
              <section key={g.category}>
                <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
                  {humanize(g.category)}
                </h3>
                <ul className="divide-border rounded-card border-border mt-2 divide-y border">
                  {g.facts.map((f) => (
                    <li
                      key={f.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">
                          {f.label}{" "}
                          {f.verification !== "verified" && (
                            <Badge tone={f.verification === "unverified" ? "clay" : "neutral"}>
                              {f.verification}
                            </Badge>
                          )}
                        </p>
                        <p className="text-ink-soft mt-0.5">{f.value}</p>
                        <p className="text-subtle mt-0.5 text-xs">
                          Source: {f.sourceType}
                          {f.sourceRef ? ` (${f.sourceRef})` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {(f.verification === "unverified"
                          ? ["verify", "reject", "delete"]
                          : ["delete"]
                        ).map((decision) => (
                          <form key={decision} action={factVerificationAction}>
                            <Hidden data={data} />
                            <input type="hidden" name="factId" value={f.id} />
                            <input type="hidden" name="decision" value={decision} />
                            <SubmitButton
                              variant={decision === "verify" ? "secondary" : "ghost"}
                              size="sm"
                            >
                              {humanize(decision)}
                            </SubmitButton>
                          </form>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <details className="rounded-card border-border-strong border border-dashed p-4">
              <summary className="text-brand-700 cursor-pointer text-sm font-medium">
                Add a fact
              </summary>
              <ActionForm action={addFactAction} className="mt-4 space-y-3" resetOnSuccess>
                <Hidden data={data} />
                <SelectField
                  name="category"
                  label="Category"
                  options={FACT_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))}
                />
                <TextField name="label" label="Label" placeholder="e.g. Response time" required />
                <TextArea name="value" label="Fact" rows={2} required />
                <SubmitButton size="sm">Add verified fact</SubmitButton>
              </ActionForm>
            </details>
          </CardBody>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Goals & KPIs" />
          <CardBody className="space-y-4">
            {data.goals.map((g) => (
              <div key={g.id} className="bg-surface-2 rounded-lg p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{g.title}</p>
                  <StatusBadge
                    kind="lifecycle"
                    value={
                      g.status === "achieved"
                        ? "active"
                        : g.status === "active"
                          ? "onboarding"
                          : "paused"
                    }
                  />
                </div>
                <p className="text-muted mt-1 text-xs">
                  {g.kpi ?? "No KPI"} · baseline {g.baseline ?? "-"} · current {g.current ?? "-"} ·
                  target {g.target ?? "-"}
                </p>
                <form action={updateGoalAction} className="mt-2 flex gap-2">
                  <Hidden data={data} />
                  <input type="hidden" name="goalId" value={g.id} />
                  <label className="sr-only" htmlFor={`cur-${g.id}`}>
                    Current value
                  </label>
                  <input
                    id={`cur-${g.id}`}
                    name="current"
                    placeholder="Update current"
                    className="border-border bg-surface h-8 flex-1 rounded-md border px-2 text-xs"
                  />
                  <select
                    name="status"
                    defaultValue=""
                    className="border-border bg-surface h-8 rounded-md border px-1 text-xs"
                    aria-label="Status"
                  >
                    <option value="">Status…</option>
                    <option value="active">Active</option>
                    <option value="achieved">Achieved</option>
                    <option value="paused">Paused</option>
                    <option value="dropped">Dropped</option>
                  </select>
                  <SubmitButton size="sm" variant="secondary">
                    Save
                  </SubmitButton>
                </form>
              </div>
            ))}
            <details>
              <summary className="text-brand-700 cursor-pointer text-sm">Add goal</summary>
              <ActionForm action={addGoalAction} className="mt-3 space-y-3" resetOnSuccess>
                <Hidden data={data} />
                <TextField name="title" label="Goal" required />
                <TextField name="kpi" label="KPI" placeholder="e.g. Organic enquiries per month" />
                <div className="grid grid-cols-3 gap-2">
                  <TextField name="baseline" label="Baseline" />
                  <TextField name="current" label="Current" />
                  <TextField name="target" label="Target" />
                </div>
                <SubmitButton size="sm">Add goal</SubmitButton>
              </ActionForm>
            </details>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Competitors" description="Used by competitor analysis runs." />
          <CardBody className="space-y-3">
            {data.competitors.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{c.name}</p>
                  {c.website && <p className="text-muted text-xs">{c.website}</p>}
                </div>
                <form action={removeCompetitorAction}>
                  <Hidden data={data} />
                  <input type="hidden" name="competitorId" value={c.id} />
                  <SubmitButton variant="ghost" size="sm">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            ))}
            <ActionForm action={addCompetitorAction} className="space-y-2" resetOnSuccess>
              <Hidden data={data} />
              <TextField name="name" label="Competitor" required />
              <TextField name="website" label="Website" />
              <SubmitButton size="sm" variant="secondary">
                Add competitor
              </SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <ActionForm action={updateClientAction} className="space-y-3">
              <Hidden data={data} />
              <input type="hidden" name="country" value={data.client.country} />
              <input type="hidden" name="currency" value={data.client.currency} />
              <TextField name="name" label="Name" defaultValue={data.client.name} required />
              <TextField name="website" label="Website" defaultValue={data.client.website ?? ""} />
              <TextField
                name="industry"
                label="Industry"
                defaultValue={data.client.industry ?? ""}
              />
              <TextField
                name="location"
                label="Location"
                defaultValue={data.client.location ?? ""}
              />
              <TextField
                name="employeeRange"
                label="Size"
                defaultValue={data.client.employeeRange ?? ""}
              />
              <TextField
                name="linkedinUrl"
                label="LinkedIn"
                defaultValue={data.client.linkedinUrl ?? ""}
              />
              <TextField
                name="email"
                label="Company email"
                defaultValue={data.client.email ?? ""}
              />
              <TextField name="phone" label="Phone" defaultValue={data.client.phone ?? ""} />
              <TextField
                name="renewalDate"
                type="date"
                label="Renewal date"
                defaultValue={data.client.renewalDate ?? ""}
              />
              <TextArea
                name="description"
                label="What they do"
                defaultValue={data.client.description ?? ""}
                rows={3}
              />
              <TextArea
                name="targetMarket"
                label="Target market"
                defaultValue={data.client.targetMarket ?? ""}
                rows={2}
              />
              <TextArea
                name="brandVoice"
                label="Brand voice"
                defaultValue={data.client.brandVoice ?? ""}
                rows={2}
              />
              <SubmitButton size="sm">Save profile</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Work

export function WorkTab({ data }: Props) {
  const open = data.tasks.filter((t) => !["complete", "cancelled"].includes(t.task.status));
  const done = data.tasks
    .filter((t) => t.task.status === "complete")
    .slice(-10)
    .reverse();
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Tasks"
          description={`${open.length} open`}
          action={
            <LinkButton
              href={`/workspace/tasks?client=${data.client.organisationId}&new=1`}
              size="sm"
              variant="secondary"
            >
              New task
            </LinkButton>
          }
        />
        <CardBody className="p-0">
          {open.length === 0 ? (
            <p className="text-muted px-5 py-4 text-sm">No open tasks.</p>
          ) : (
            <ul className="divide-border divide-y">
              {open.map(({ task, assignee }) => (
                <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/workspace/tasks?task=${task.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {task.title}
                    </Link>
                    <p className="text-muted text-xs">
                      {assignee ?? (task.agent ? `Agent: ${task.agent}` : "Unassigned")} ·{" "}
                      {task.visibility === "client" ? "Visible to client" : "Internal"} ·{" "}
                      {humanize(task.source)}
                    </p>
                  </div>
                  <DueLabel due={task.dueAt} />
                  <StatusBadge kind="task" value={task.status} />
                </li>
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <details className="border-border border-t px-5 py-3">
              <summary className="text-muted cursor-pointer text-sm">
                Recently completed ({done.length})
              </summary>
              <ul className="text-ink-soft mt-2 space-y-1 text-sm">
                {done.map(({ task }) => (
                  <li key={task.id}>✓ {task.title}</li>
                ))}
              </ul>
            </details>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Content pipeline"
          description="Idea → brief → draft → review → approval → published → learning"
        />
        <CardBody className="p-0">
          {data.content.length === 0 ? (
            <p className="text-muted px-5 py-4 text-sm">
              No content yet. Run a Content Opportunity Scan.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {data.content.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{c.title}</p>
                    <StatusBadge kind="content" value={c.stage} />
                  </div>
                  <p className="text-muted text-xs">
                    {humanize(c.channel)}
                    {c.targetKeyword ? ` · ${c.targetKeyword}` : ""}
                  </p>
                  {c.brief && (
                    <details className="mt-1">
                      <summary className="text-brand-700 cursor-pointer text-xs">Brief</summary>
                      <pre className="text-ink-soft mt-1 text-xs whitespace-pre-wrap">
                        {c.brief}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------- Services

export async function ServicesTab({ data, canManage }: Props & { canManage: boolean }) {
  const catalogue = await (
    await getDb()
  )
    .select()
    .from(services)
    .where(eq(services.status, "active"))
    .orderBy(asc(services.sortOrder));
  const owned = new Set(
    data.services.filter((s) => s.cs.status !== "cancelled").map((s) => s.service.id),
  );
  return (
    <div className="space-y-6">
      {data.services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add services below, or accept a proposal to set them up automatically."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.services.map(({ cs, service }) => (
            <Card key={cs.id} className={cs.status === "cancelled" ? "opacity-60" : ""}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-muted text-xs">
                      {CATEGORY_LABELS[service.category]} · since {fmtDate(cs.startedAt)}
                    </p>
                  </div>
                  <StatusBadge kind="service" value={cs.status} />
                </div>
                <p className="text-sm tabular-nums">
                  {cs.monthlyMinor
                    ? `${fmtMoney(cs.monthlyMinor, cs.currency)}/month`
                    : "No monthly fee"}
                  {cs.setupMinor ? ` · setup ${fmtMoney(cs.setupMinor, cs.currency)}` : ""}
                </p>
                {cs.pauseReason && (
                  <p className="text-warning-700 text-xs">
                    Paused:{" "}
                    {cs.pauseReason === "billing"
                      ? "overdue invoice (resumes automatically on payment)"
                      : cs.pauseReason}
                  </p>
                )}
                <form action={updateServiceFocusAction} className="flex gap-2">
                  <Hidden data={data} />
                  <input type="hidden" name="clientServiceId" value={cs.id} />
                  <label className="sr-only" htmlFor={`focus-${cs.id}`}>
                    Current focus (visible to client)
                  </label>
                  <input
                    id={`focus-${cs.id}`}
                    name="currentFocus"
                    defaultValue={cs.currentFocus ?? ""}
                    placeholder="Current focus (shown to the client)"
                    className="border-border bg-surface h-8 flex-1 rounded-md border px-2 text-xs"
                  />
                  <SubmitButton size="sm" variant="secondary">
                    Save
                  </SubmitButton>
                </form>
                {canManage && cs.status !== "cancelled" && (
                  <div className="flex flex-wrap gap-1.5">
                    {(cs.status === "pending"
                      ? ["activate", "cancel"]
                      : cs.status === "paused"
                        ? ["resume", "cancel"]
                        : ["pause", "cancel"]
                    ).map((op) => (
                      <form key={op} action={clientServiceStateAction}>
                        <Hidden data={data} />
                        <input type="hidden" name="clientServiceId" value={cs.id} />
                        <input type="hidden" name="op" value={op} />
                        <SubmitButton size="sm" variant={op === "cancel" ? "ghost" : "secondary"}>
                          {op === "cancel" ? "End service" : humanize(op)}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {canManage && (
        <Card>
          <CardHeader
            title="Add a service"
            description="Prices default from the catalogue in the client's currency; adjust for this client if agreed. Services start as pending until activated or paid."
          />
          <CardBody>
            <ActionForm
              action={addClientServiceAction}
              className="grid gap-4 md:grid-cols-4"
              resetOnSuccess
            >
              <Hidden data={data} />
              <SelectField
                className="md:col-span-2"
                name="serviceId"
                label="Service"
                options={catalogue
                  .filter((s) => !owned.has(s.id))
                  .map((s) => {
                    const p = s.prices[data.client.currency];
                    const price = p?.monthlyMinor
                      ? `${fmtMoney(p.monthlyMinor, data.client.currency)}/mo`
                      : p?.oneOffMinor
                        ? fmtMoney(p.oneOffMinor, data.client.currency)
                        : "no price set";
                    return {
                      value: s.id,
                      label: `${CATEGORY_LABELS[s.category]}: ${s.name} (${price})`,
                    };
                  })}
              />
              <TextField
                name="monthly"
                label="Monthly (major units)"
                placeholder="Catalogue price"
                inputMode="decimal"
              />
              <TextField
                name="setup"
                label="Setup / once-off"
                placeholder="Catalogue price"
                inputMode="decimal"
              />
              <CheckboxField
                className="md:col-span-3"
                name="activate"
                label="Activate now (creates setup tasks and subscription)"
              />
              <SubmitButton>Add service</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- Visibility

export function VisibilityTab({ data }: Props) {
  const latest = data.latestAudit;
  return (
    <div className="space-y-6">
      {latest?.result ? (
        <Card>
          <CardHeader
            title="Latest visibility snapshot"
            description={`${latest.url} · ${fmtDateTime(latest.completedAt)}`}
            action={
              <LinkButton href={`/workspace/audits/${latest.id}`} size="sm" variant="secondary">
                Full report
              </LinkButton>
            }
          />
          <CardBody className="space-y-5">
            <p className="text-ink-soft">{latest.result.headline}</p>
            <ReportSummary result={latest.result} />
            <div className="grid gap-3 md:grid-cols-2">
              {latest.result.categories.map((c) => (
                <div
                  key={c.key}
                  className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-muted text-xs">{c.summary}</p>
                  </div>
                  <Badge
                    tone={
                      c.status === "strong"
                        ? "success"
                        : c.status === "critical"
                          ? "danger"
                          : c.status === "needs_attention"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {statusLabel(c.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          title="No visibility snapshot yet"
          description={
            data.client.website
              ? "Use More runs → Run Visibility Audit."
              : "Add the client's website first (Strategy & Brain → Profile)."
          }
        />
      )}
      <Callout tone="info" title="Search Console & Analytics">
        Rankings, clicks and traffic come from Google Search Console and GA4 once connected. Until
        then, reports only show measured website signals, never estimates presented as data.{" "}
        <Link href="/workspace/settings/integrations" className="underline">
          Integrations
        </Link>
      </Callout>
      <Card>
        <CardHeader title="Audit history" />
        <CardBody className="p-0">
          <ul className="divide-border divide-y">
            {data.audits.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/workspace/audits/${a.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <StatusBadge kind="audit" value={a.status} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {a.result?.headline ?? a.error ?? a.url}
                  </span>
                  <span className="text-muted text-xs">{fmtRelative(a.createdAt)}</span>
                </Link>
              </li>
            ))}
            {data.audits.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">No audits yet.</li>
            )}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------- Meetings

export function MeetingsTab({ data }: Props) {
  return (
    <Card>
      <CardHeader
        title="Meetings"
        action={
          <LinkButton
            href={`/workspace/meetings?new=1&client=${data.client.organisationId}`}
            size="sm"
            variant="secondary"
          >
            Book meeting
          </LinkButton>
        }
      />
      <CardBody className="p-0">
        {data.meetings.length === 0 ? (
          <p className="text-muted px-5 py-4 text-sm">No meetings yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {data.meetings.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/workspace/meetings/${m.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <div className="w-40 shrink-0 text-sm tabular-nums">
                    {fmtDateTime(m.startsAt)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-muted text-xs">{MEETING_TYPE_LABELS[m.type]}</p>
                  </div>
                  <StatusBadge kind="meeting" value={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------- Documents

export async function DocumentsTab({ data }: Props) {
  const docs = await listDocuments(await getDb(), data.client.organisationId, {
    clientOnly: false,
  });
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Documents"
          description="Stored in object storage; downloads use short-lived signed links."
        />
        <CardBody className="p-0">
          {docs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<FileText className="size-6" />}
                title="No documents yet"
                description="Upload contracts, brand guidelines, logos, strategy documents and reports."
              />
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <FileText className="text-subtle size-4" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/documents/${d.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {d.name}
                    </a>
                    <p className="text-muted text-xs">
                      {humanize(d.category)} · v{d.version} · {(d.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                      {fmtRelative(d.createdAt)}
                      {d.uploadedByClient === "yes" ? " · uploaded by client" : ""}
                    </p>
                  </div>
                  {d.visibility === "internal" ? (
                    <Badge tone="neutral">
                      <Lock className="size-3" aria-hidden /> Internal
                    </Badge>
                  ) : (
                    <Badge tone="info">Shared with client</Badge>
                  )}
                  <form action={archiveDocumentAction}>
                    <Hidden data={data} />
                    <input type="hidden" name="documentId" value={d.id} />
                    <SubmitButton variant="ghost" size="sm">
                      Archive
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Upload"
          description="Up to 25 MB. PDF, Office, images, MP4/MOV, CSV, ZIP."
        />
        <CardBody>
          <ActionForm action={uploadDocumentAction} className="space-y-3" resetOnSuccess>
            <Hidden data={data} />
            <div className="space-y-1.5">
              <label htmlFor="file" className="block text-sm font-medium">
                File
              </label>
              <input
                id="file"
                name="file"
                type="file"
                required
                className="file:bg-brand-50 file:text-brand-800 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2"
              />
            </div>
            <SelectField
              name="category"
              label="Category"
              defaultValue="auto"
              options={[
                { value: "auto", label: "Detect automatically" },
                ...[
                  "contract",
                  "proposal",
                  "brand_guidelines",
                  "logo",
                  "strategy",
                  "report",
                  "meeting_notes",
                  "research",
                  "other",
                ].map((c) => ({ value: c, label: humanize(c) })),
              ]}
            />
            <SelectField
              name="visibility"
              label="Who can see it"
              options={[
                { value: "client", label: "Client and Mea Creo" },
                { value: "internal", label: "Mea Creo only (internal)" },
              ]}
            />
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------- Reports

export function ReportsTab({ data }: Props) {
  return (
    <Card>
      <CardHeader
        title="Reports"
        description="Drafted by the monthly review run, approved by Mea Creo, then published to the client."
      />
      <CardBody className="p-0">
        {data.reports.length === 0 ? (
          <p className="text-muted px-5 py-4 text-sm">
            No reports yet. Use More runs → Run Monthly Client Review.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {data.reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/workspace/reports/${r.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-muted truncate text-xs">{r.content.headline}</p>
                  </div>
                  <StatusBadge
                    kind="proposal"
                    value={
                      r.status === "published"
                        ? "accepted"
                        : r.status === "in_review"
                          ? "viewed"
                          : "draft"
                    }
                  />
                  <span className="text-muted text-xs">
                    {r.status === "published"
                      ? "Published"
                      : r.status === "in_review"
                        ? "In review"
                        : "Draft"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------- Billing

export function BillingTab({ data }: Props) {
  return (
    <div className="space-y-6">
      {data.client.billingState === "overdue" && (
        <Callout tone="danger" title="Account overdue">
          Automated services pause after the grace period. Portal access, reports and documents stay
          available, and services resume automatically when payment is confirmed.
        </Callout>
      )}
      <Card>
        <CardHeader
          title="Invoices"
          action={
            <LinkButton
              href={`/workspace/billing?client=${data.client.organisationId}&new=1`}
              size="sm"
              variant="secondary"
            >
              New invoice
            </LinkButton>
          }
        />
        <CardBody className="p-0">
          {data.invoices.length === 0 ? (
            <p className="text-muted px-5 py-4 text-sm">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-border divide-y">
                {data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/workspace/billing/${i.id}`} className="hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="text-muted px-3 py-3">{i.description}</td>
                    <td className="text-muted px-3 py-3">Due {fmtDate(i.dueAt)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtMoney(i.totalMinor, i.currency)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge kind="invoice" value={i.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Subscription" />
        <CardBody>
          {data.subscriptions.length === 0 ? (
            <p className="text-muted text-sm">
              No recurring billing set up. It&apos;s created when a monthly service is activated.
            </p>
          ) : (
            data.subscriptions.map((s) => (
              <DescriptionList
                key={s.id}
                items={[
                  ["Status", humanize(s.status)],
                  ["Amount", `${fmtMoney(s.amountMinor, s.currency)} ${s.frequency}`],
                  ["Provider", s.provider === "mock" ? "Test payments (demo)" : s.provider],
                  ["Next invoice", fmtDate(s.nextBillingDate)],
                ]}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------- Messages

export function MessagesTab({ data }: Props) {
  return (
    <Card className="max-w-3xl">
      <CardHeader
        title="Messages"
        description="Conversation with the client. They see this in their portal."
      />
      <CardBody className="space-y-4">
        {data.messages.length === 0 && <p className="text-muted text-sm">No messages yet.</p>}
        <ul className="space-y-3">
          {data.messages.map(({ message, author }) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${message.fromClient ? "bg-surface-2" : "bg-brand-50 ml-auto"}`}
            >
              <p className="text-muted text-xs">
                {author ?? (message.fromClient ? "Client" : "Mea Creo")} ·{" "}
                {fmtRelative(message.createdAt)}
                {message.kind === "support" ? " · Support request" : ""}
              </p>
              {message.subject && <p className="mt-1 font-medium">{message.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            </li>
          ))}
        </ul>
        <ActionForm action={sendMessageAction} className="space-y-2" resetOnSuccess>
          <Hidden data={data} />
          <TextArea name="body" label="Reply" rows={3} />
          <SubmitButton size="sm">Send</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------- Activity

export function ActivityTab({ data }: Props) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Growth timeline"
          description="Client-visible history of work and progress."
        />
        <CardBody className="space-y-4">
          <ol className="border-border relative space-y-4 border-l pl-5">
            {data.timeline.map((t) => (
              <li key={t.id}>
                <span
                  className="bg-brand-600 absolute -left-[5px] mt-1.5 size-2.5 rounded-full"
                  aria-hidden
                />
                <p className="text-muted text-xs">
                  {fmtDate(t.occurredAt)} · {humanize(t.kind)}
                  {t.visibility === "internal" ? " · internal" : ""}
                </p>
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="text-ink-soft text-sm">{t.description}</p>}
              </li>
            ))}
          </ol>
          <details>
            <summary className="text-brand-700 cursor-pointer text-sm">Add timeline entry</summary>
            <ActionForm action={addTimelineAction} className="mt-3 space-y-3" resetOnSuccess>
              <Hidden data={data} />
              <TextField name="title" label="Title" required />
              <TextArea name="description" label="Description" rows={2} />
              <SelectField
                name="kind"
                label="Type"
                options={["work", "milestone", "result", "opportunity"].map((k) => ({
                  value: k,
                  label: humanize(k),
                }))}
              />
              <SubmitButton size="sm">Add</SubmitButton>
            </ActionForm>
          </details>
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Internal notes" description="Never visible to the client." />
          <CardBody className="space-y-3">
            <ActionForm action={addNoteAction} className="space-y-2" resetOnSuccess>
              <Hidden data={data} />
              <TextArea name="body" label="New note" rows={2} />
              <SubmitButton size="sm" variant="secondary">
                Add note
              </SubmitButton>
            </ActionForm>
            <ul className="space-y-3">
              {data.notes.map(({ note, author }) => (
                <li key={note.id} className="bg-surface-2 rounded-lg p-3 text-sm">
                  <p className="text-muted text-xs">
                    {author} · {fmtRelative(note.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Audit log" description="Who changed what, when, and why." />
          <CardBody className="p-0">
            <ul className="divide-border divide-y">
              {data.activity.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-sm">
                  <p>{a.summary}</p>
                  <p className="text-muted text-xs">
                    {a.actorLabel} ({a.actorType}) · {fmtDateTime(a.createdAt)}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </li>
              ))}
              {data.activity.length === 0 && (
                <li className="text-muted px-5 py-4 text-sm">No activity yet.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Settings

export function SettingsTab({ data, canDelete }: Props & { canDelete: boolean }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Portal users"
          description="People at the client who can sign in to their portal."
        />
        <CardBody className="space-y-4">
          <ul className="divide-border divide-y">
            {data.portalUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-muted text-xs">
                    {u.email} · {ROLE_LABELS[u.role]} ·{" "}
                    {u.hasPassword
                      ? u.lastLoginAt
                        ? `last sign-in ${fmtRelative(u.lastLoginAt)}`
                        : "never signed in"
                      : "invitation pending"}
                  </p>
                </div>
              </li>
            ))}
            {data.portalUsers.length === 0 && (
              <li className="text-muted py-2 text-sm">No portal users yet.</li>
            )}
          </ul>
          <ActionForm action={inviteUserAction} className="space-y-3" resetOnSuccess>
            <Hidden data={data} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="name" label="Name" required />
              <TextField name="email" type="email" label="Email" required />
            </div>
            <SelectField
              name="role"
              label="Role"
              options={CLIENT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
            <SubmitButton size="sm">Send invitation</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Team assignments" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {data.assignments.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-muted">{humanize(a.responsibility)}</span>
                </li>
              ))}
              {data.assignments.length === 0 && <li className="text-muted">Nobody assigned.</li>}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Automation" description="Emergency control for this client only." />
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm">
              {data.client.automationPaused
                ? "No runs or agents will act for this client."
                : "Runs and agents may act within their approval levels."}
            </p>
            <form action={automationPauseAction}>
              <Hidden data={data} />
              <input type="hidden" name="paused" value={String(!data.client.automationPaused)} />
              <SubmitButton
                variant={data.client.automationPaused ? "secondary" : "danger"}
                size="sm"
              >
                {data.client.automationPaused ? "Resume automation" : "Pause automation"}
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Data" />
          <CardBody className="space-y-3 text-sm">
            <a
              href={`/api/export/client/${data.client.organisationId}`}
              className={buttonClass("secondary", "sm")}
            >
              <ExternalLink className="size-4" aria-hidden /> Export client data (JSON)
            </a>
            {canDelete && !data.client.isInternal && (
              <form action={archiveClientAction} className="border-border border-t pt-3">
                <Hidden data={data} />
                <p className="text-muted mb-2">
                  Archiving ends services and hides the client. Records are preserved for accounting
                  and audit purposes.
                </p>
                <SubmitButton variant="danger" size="sm">
                  Archive client
                </SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-muted flex items-start gap-3 text-sm">
            <Sparkles className="text-brand-600 mt-0.5 size-4" aria-hidden />
            The client sees a simplified view: their services, work, approvals, reports, files,
            invoices and timeline. Internal notes, documents marked internal, margins and agent logs
            are never shown.
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
