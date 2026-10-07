import { asc, eq } from "drizzle-orm";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { ActionForm, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Callout, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { services } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import {
  formatProposalMoney,
  getProposal,
  proposalReadiness,
  proposalTotals,
} from "@/modules/proposals/service";
import {
  addItemAction,
  removeItemAction,
  saveProposalAction,
  sendProposalAction,
} from "../actions";

export const metadata: Metadata = { title: "Proposal" };

const major = (minor: number) => (minor ? String(minor / 100) : "");

export default async function ProposalPage({ params }: PageProps<"/workspace/proposals/[id]">) {
  const ctx = await requireStaff("leads.read");
  const { id } = await params;
  const db = await getDb();
  const data = await getProposal(db, id);
  if (!data) notFound();
  const { proposal: p, items } = data;
  const [issues, catalogue] = await Promise.all([
    proposalReadiness(db, id),
    db.select().from(services).where(eq(services.status, "active")).orderBy(asc(services.name)),
  ]);
  const totals = proposalTotals(items, p.discountPercent);
  const m = (minor: number) => formatProposalMoney(minor, p.currency);
  const locked = p.status === "accepted" || !ctx.can("proposals.write");
  const inputCls =
    "h-9 w-28 rounded-md border border-border-strong bg-surface px-2 text-right text-sm tabular-nums";

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/proposals" className="hover:text-ink">
          Proposals
        </Link>{" "}
        / {p.number}
      </div>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.companyName}</h1>
            <StatusBadge kind="proposal" value={p.status} />
          </div>
          <p className="text-muted mt-1 text-sm">
            {p.number} · {p.currency}
            {p.leadId && (
              <>
                {" · "}
                <Link
                  href={`/workspace/leads/${p.leadId}`}
                  className="text-brand-700 decoration-brand-300 underline underline-offset-[3px] hover:decoration-current"
                >
                  lead
                </Link>
              </>
            )}
            {p.organisationId && (
              <>
                {" · "}
                <Link
                  href={`/workspace/clients/${p.organisationId}`}
                  className="text-brand-700 decoration-brand-300 underline underline-offset-[3px] hover:decoration-current"
                >
                  client
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/proposals/${p.id}/pdf`} variant="secondary" target="_blank">
            <Download className="size-4" aria-hidden /> PDF
          </LinkButton>
          <LinkButton href={`/proposal/${p.publicToken}`} variant="secondary" target="_blank">
            {p.status === "draft" ? "Preview" : "Client view"}{" "}
            <ExternalLink className="size-3.5" aria-hidden />
          </LinkButton>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <ActionForm action={saveProposalAction} className="min-w-0 space-y-6" id="proposal-form">
          <input type="hidden" name="proposalId" value={p.id} />
          <Card>
            <CardHeader
              title="Investment"
              description="Prices are prefilled from the catalogue. Optional items are shown but not included in totals."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-left text-xs">
                  <tr className="border-border border-b">
                    <th className="px-4 py-2 font-medium">Service</th>
                    <th className="px-2 py-2 text-right font-medium">Setup</th>
                    <th className="px-2 py-2 text-right font-medium">Once-off</th>
                    <th className="px-2 py-2 text-right font-medium">Monthly</th>
                    <th className="px-2 py-2 font-medium">Optional</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-border border-b">
                      <td className="px-4 py-2 font-medium">{i.name}</td>
                      <td className="px-2 py-2 text-right">
                        <input
                          aria-label={`${i.name} setup`}
                          name={`item.${i.id}.setup`}
                          defaultValue={major(i.setupMinor)}
                          inputMode="decimal"
                          className={inputCls}
                          disabled={locked}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          aria-label={`${i.name} once-off`}
                          name={`item.${i.id}.oneoff`}
                          defaultValue={major(i.oneOffMinor)}
                          inputMode="decimal"
                          className={inputCls}
                          disabled={locked}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          aria-label={`${i.name} monthly`}
                          name={`item.${i.id}.monthly`}
                          defaultValue={major(i.monthlyMinor)}
                          inputMode="decimal"
                          className={inputCls}
                          disabled={locked}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`${i.name} optional`}
                          type="checkbox"
                          name={`item.${i.id}.optional`}
                          defaultChecked={i.optional}
                          disabled={locked}
                          className="accent-brand-700 size-4"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {!locked && (
                          <button
                            formAction={removeItemAction.bind(null, i.id)}
                            className="text-muted hover:bg-danger-100 hover:text-danger-700 rounded p-1.5"
                            aria-label={`Remove ${i.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="flex flex-wrap items-end justify-between gap-4">
              {!locked && (
                <div className="flex min-w-0 items-end gap-2">
                  <label className="min-w-0 flex-1 text-sm sm:flex-none">
                    <span className="text-muted mb-1 block text-xs">Add a service</span>
                    <select
                      name="serviceId"
                      className="border-border-strong bg-surface h-9 w-full rounded-md border px-2 text-sm sm:w-auto"
                    >
                      {catalogue.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    formAction={addItemAction}
                    className="border-border-strong hover:bg-surface-2 h-9 rounded-md border px-3 text-sm"
                  >
                    Add
                  </button>
                </div>
              )}
              <DescriptionList
                items={[
                  ["Setup & once-off", m(totals.setupMinor)],
                  [
                    "Monthly",
                    `${m(totals.monthlyMinor)}${totals.monthlyDiscountMinor ? ` (after ${m(totals.monthlyDiscountMinor)} discount)` : ""}`,
                  ],
                  ["Contract value", m(totals.setupMinor + totals.monthlyMinor * p.contractMonths)],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Content"
              description="One item per line. Keep claims factual: no guarantees of rankings, AI mentions or leads."
            />
            <CardBody className="space-y-4">
              <TextField
                name="title"
                label="Title"
                defaultValue={p.title}
                disabled={locked}
                required
              />
              <TextArea
                name="summary"
                label="Summary"
                defaultValue={p.summary}
                rows={4}
                disabled={locked}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextArea
                  name="problems"
                  label="What we found"
                  defaultValue={p.problems.join("\n")}
                  rows={5}
                  disabled={locked}
                />
                <TextArea
                  name="goals"
                  label="Goals"
                  defaultValue={p.goals.join("\n")}
                  rows={5}
                  disabled={locked}
                />
                <TextArea
                  name="activities"
                  label="What we'll do"
                  defaultValue={p.activities.join("\n")}
                  rows={6}
                  disabled={locked}
                />
                <TextArea
                  name="kpis"
                  label="How we'll measure progress"
                  defaultValue={p.kpis.join("\n")}
                  rows={6}
                  disabled={locked}
                />
              </div>
              <TextArea
                name="timeline"
                label="Timeline"
                defaultValue={p.timeline ?? ""}
                rows={3}
                disabled={locked}
              />
              <TextArea
                name="assumptions"
                label="Assumptions"
                defaultValue={p.assumptions ?? ""}
                rows={3}
                disabled={locked}
              />
              <TextArea
                name="terms"
                label="Terms"
                defaultValue={p.terms ?? ""}
                rows={5}
                disabled={locked}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  name="contactName"
                  label="Contact name"
                  defaultValue={p.contactName ?? ""}
                  disabled={locked}
                />
                <TextField
                  name="contactEmail"
                  type="email"
                  label="Contact email"
                  defaultValue={p.contactEmail ?? ""}
                  disabled={locked}
                />
                <TextField
                  name="contractMonths"
                  type="number"
                  label="Minimum term (months)"
                  defaultValue={String(p.contractMonths)}
                  disabled={locked}
                />
                <TextField
                  name="discountPercent"
                  type="number"
                  label="Monthly discount (%)"
                  defaultValue={String(p.discountPercent)}
                  disabled={locked}
                />
              </div>
              {!locked && <SubmitButton>Save proposal</SubmitButton>}
            </CardBody>
          </Card>
        </ActionForm>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Send" />
            <CardBody className="space-y-3">
              {issues.length > 0 ? (
                <Callout tone="warning" title="Before sending">
                  <ul className="list-disc space-y-1 pl-4">
                    {issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </Callout>
              ) : (
                p.status !== "accepted" && (
                  <p className="text-success-700 text-sm">Ready to send.</p>
                )
              )}
              {p.status !== "accepted" && ctx.can("proposals.send") && (
                <ActionForm action={sendProposalAction}>
                  <input type="hidden" name="proposalId" value={p.id} />
                  <SubmitButton variant={issues.length ? "secondary" : "primary"}>
                    {p.status === "draft" ? "Send to client" : "Resend"}
                  </SubmitButton>
                </ActionForm>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <DescriptionList
                items={[
                  ["Created", fmtDateTime(p.createdAt)],
                  ["Sent", p.sentAt ? fmtDateTime(p.sentAt) : null],
                  ["Viewed", p.viewedAt ? fmtDateTime(p.viewedAt) : null],
                  [
                    "Accepted",
                    p.acceptedAt
                      ? `${fmtDateTime(p.acceptedAt)} by ${p.acceptedByName} (${p.acceptedByEmail})`
                      : null,
                  ],
                  ["Declined", p.declinedAt ? fmtDateTime(p.declinedAt) : null],
                  ["Valid until", p.validUntil ? fmtDateTime(p.validUntil) : null],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
