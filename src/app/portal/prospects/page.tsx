import { Download, ExternalLink, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { CLIENT_PROSPECT_STATUSES } from "@/db/schema";
import { fmtDate, humanize } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";
import { getProgramme, listProspects } from "@/modules/prospecting/service";
import { portalProspectStatusAction } from "../actions";

export const metadata: Metadata = { title: "Prospects" };

const STATUS_OPTIONS = CLIENT_PROSPECT_STATUSES.map((s) => ({ value: s, label: humanize(s) }));

export default async function PortalProspects() {
  const ctx = await requireClient();
  const db = await getDb();
  const programme = await getProgramme(db, ctx.organisationId);
  if (!programme) notFound();
  const prospects = await listProspects(db, ctx.organisationId, { releasedOnly: true });
  const weeks = [...new Set(prospects.map((p) => p.weekOf))];
  const progressed = prospects.filter((p) =>
    ["in_conversation", "meeting_booked", "won"].includes(p.status),
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-ink text-3xl">Prospects</h1>
          <p className="text-muted mt-1">
            {programme.status === "active"
              ? `Up to ${programme.weeklyQuota} fresh, researched prospects every week, each with why they fit.`
              : "Your fresh-prospects service is paused. Everything delivered so far is below."}
          </p>
        </div>
        {prospects.length > 0 && (
          <a
            href="/portal/prospects/export"
            className="border-border-strong bg-surface hover:bg-surface-2 inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
          >
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        )}
      </header>

      {prospects.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="label-mono text-muted">Delivered</p>
              <p className="font-display text-ink mt-1 text-3xl tabular-nums">{prospects.length}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="label-mono text-muted">In progress</p>
              <p className="font-display text-ink mt-1 text-3xl tabular-nums">{progressed}</p>
            </CardBody>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardBody>
              <p className="label-mono text-muted">Not contacted yet</p>
              <p className="font-display text-ink mt-1 text-3xl tabular-nums">
                {prospects.filter((p) => p.status === "new").length}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <Callout tone="neutral" title="Before you reach out">
        These are business contacts from public, professional sources (each shows where we found
        it). Under POPIA, a first message should be relevant to their role, say who you are, and let
        them opt out; don&apos;t add them to bulk mailing lists without consent.
      </Callout>

      {weeks.length === 0 ? (
        <EmptyState
          icon={<Target className="size-5" />}
          title="Your first prospects are on the way"
          description="We research companies that match your ideal customer and release them here each week after review."
        />
      ) : (
        weeks.map((week) => (
          <section key={week} className="space-y-3">
            <h2 className="label-mono text-muted">Week of {fmtDate(week)}</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {prospects
                .filter((p) => p.weekOf === week)
                .map((p) => (
                  <Card key={p.id}>
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-ink font-semibold">{p.company}</h3>
                          <p className="text-muted text-sm">
                            {[p.industry, p.location].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Badge tone={p.status === "new" ? "brand" : "neutral"}>
                          {humanize(p.status)}
                        </Badge>
                      </div>
                      <p className="text-ink-soft text-sm">{p.reason}</p>
                      <dl className="text-sm">
                        {p.contactName && (
                          <div className="flex gap-2">
                            <dt className="text-muted w-16 shrink-0">Contact</dt>
                            <dd>
                              {p.contactName}
                              {p.contactRole ? `, ${p.contactRole}` : ""}
                            </dd>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex gap-2">
                            <dt className="text-muted w-16 shrink-0">Email</dt>
                            <dd className="break-all">
                              <a
                                href={`mailto:${p.email}`}
                                className="text-brand-700 underline decoration-current/30"
                              >
                                {p.email}
                              </a>
                            </dd>
                          </div>
                        )}
                        {p.phone && (
                          <div className="flex gap-2">
                            <dt className="text-muted w-16 shrink-0">Phone</dt>
                            <dd>{p.phone}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {p.website && (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 inline-flex items-center gap-1 underline decoration-current/30"
                          >
                            Website <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        )}
                        {p.linkedinUrl && (
                          <a
                            href={p.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 inline-flex items-center gap-1 underline decoration-current/30"
                          >
                            LinkedIn <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        )}
                      </div>
                      <p className="text-subtle text-xs">Source: {p.source}</p>
                      <ActionForm
                        action={portalProspectStatusAction}
                        className="border-border/70 grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <SelectField
                          name="status"
                          label="Status"
                          defaultValue={p.status}
                          options={STATUS_OPTIONS}
                        />
                        <TextField
                          name="note"
                          label="Note"
                          defaultValue={p.clientNote ?? ""}
                          placeholder="Optional"
                        />
                        <SubmitButton size="sm" variant="secondary">
                          Save
                        </SubmitButton>
                      </ActionForm>
                    </CardBody>
                  </Card>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
