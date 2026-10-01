import { and, eq, inArray } from "drizzle-orm";
import { CheckCircle2, Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayButton } from "@/components/billing/pay-button";
import { ActionForm, CheckboxField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { getAuthContext } from "@/modules/auth/context";
import {
  formatProposalMoney,
  getProposalByToken,
  markProposalViewed,
  proposalTotals,
} from "@/modules/proposals/service";
import { acceptProposalAction, declineProposalAction, payProposalInvoiceAction } from "./actions";

export const metadata: Metadata = { title: "Proposal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-ink text-2xl">{title}</h2>
      <ul className="text-ink-soft mt-3 list-disc space-y-1.5 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function PublicProposalPage({
  params,
  searchParams,
}: PageProps<"/proposal/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const data = await getProposalByToken(db, token);
  const ctx = await getAuthContext();
  const isStaff = ctx?.kind === "staff";
  if (!data || (data.proposal.status === "draft" && !isStaff)) notFound();
  const { proposal: p, items } = data;
  if (!isStaff && p.status === "sent") await markProposalViewed(db, p.id);
  const m = (minor: number) => formatProposalMoney(minor, p.currency);
  const totals = proposalTotals(items, p.discountPercent);
  const expired =
    p.status === "expired" ||
    (p.validUntil && p.validUntil < new Date() && p.status !== "accepted");
  const [openInvoice] =
    p.status === "accepted" && p.organisationId
      ? await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.organisationId, p.organisationId),
              inArray(invoices.status, ["open", "overdue"]),
            ),
          )
          .limit(1)
      : [];
  const payment = typeof sp.payment === "string" ? sp.payment : undefined;

  return (
    <article>
      {p.status === "draft" && (
        <Callout tone="warning" title="Draft preview">
          Only Mea Creo staff can see this until it&apos;s sent.
        </Callout>
      )}
      <p className="text-muted mt-4 text-sm">
        Proposal {p.number}
        {p.validUntil && ` · valid until ${fmtDate(p.validUntil)}`}
      </p>
      <h1 className="font-display text-ink mt-2 text-3xl sm:text-4xl">{p.title}</h1>
      <p className="text-muted mt-2">
        Prepared for {p.companyName}
        {p.contactName ? `, attention ${p.contactName}` : ""}
      </p>
      <a
        href={`/proposal/${token}/pdf`}
        className="text-brand-700 mt-3 inline-flex items-center gap-1.5 text-sm hover:underline"
      >
        <Download className="size-4" aria-hidden /> Download PDF
      </a>

      {p.summary && <p className="text-ink-soft mt-8 text-lg leading-relaxed">{p.summary}</p>}
      <List title="What we found" items={p.problems} />
      <List title="Goals" items={p.goals} />
      <List title="What we'll do" items={p.activities} />
      <List title="How we'll measure progress" items={p.kpis} />

      <section className="mt-10">
        <h2 className="font-display text-ink text-2xl">Investment</h2>
        <Card className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 text-right font-medium">Setup / once-off</th>
                  <th className="px-4 py-3 text-right font-medium">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-border border-b">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {i.name}
                        {i.optional && (
                          <span className="text-muted ml-2 text-xs font-normal">
                            optional, not included in totals
                          </span>
                        )}
                      </p>
                      {i.description && <p className="text-muted text-xs">{i.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {i.setupMinor + i.oneOffMinor ? m(i.setupMinor + i.oneOffMinor) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {i.monthlyMinor ? m(i.monthlyMinor) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr>
                  <td className="text-muted px-4 pt-3">Setup and once-off</td>
                  <td className="px-4 pt-3 text-right font-medium tabular-nums">
                    {m(totals.setupMinor)}
                  </td>
                  <td />
                </tr>
                {totals.monthlyDiscountMinor > 0 && (
                  <tr>
                    <td className="text-muted px-4 pt-2">
                      Monthly discount ({p.discountPercent}%)
                    </td>
                    <td />
                    <td className="px-4 pt-2 text-right tabular-nums">
                      -{m(totals.monthlyDiscountMinor)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-muted px-4 py-3">
                    Monthly, minimum {p.contractMonths} months
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">
                    {m(totals.monthlyMinor)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      {p.timeline && (
        <section className="mt-8">
          <h2 className="font-display text-ink text-2xl">Timeline</h2>
          <p className="text-ink-soft mt-3 whitespace-pre-line">{p.timeline}</p>
        </section>
      )}
      {p.assumptions && (
        <section className="mt-8">
          <h2 className="font-display text-ink text-2xl">Assumptions</h2>
          <p className="text-ink-soft mt-3 whitespace-pre-line">{p.assumptions}</p>
        </section>
      )}
      <div className="mt-8">
        <Callout tone="neutral" title="What we don't promise">
          We don&apos;t guarantee rankings, AI mentions, traffic or leads: they depend on factors
          outside anyone&apos;s control. We commit to the work, transparent reporting and honest
          advice.
        </Callout>
      </div>
      {p.terms && (
        <details className="rounded-card border-border bg-surface mt-6 border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Terms</summary>
          <p className="text-ink-soft mt-3 whitespace-pre-line">{p.terms}</p>
        </details>
      )}

      <div className="mt-10">
        {p.status === "accepted" ? (
          <Card>
            <CardBody className="space-y-4">
              <p className="flex items-center gap-2 text-lg font-medium">
                <CheckCircle2 className="text-success-700 size-5" aria-hidden /> Accepted by{" "}
                {p.acceptedByName} on {p.acceptedAt ? fmtDate(p.acceptedAt) : ""}
              </p>
              {payment === "return" && (
                <Callout tone="success" title="Thank you">
                  Your payment is being confirmed. You&apos;ll receive a receipt by email.
                </Callout>
              )}
              {payment === "failed" && (
                <Callout tone="danger" title="The payment didn't go through">
                  No money was taken. You can try again below.
                </Callout>
              )}
              {payment === "cancelled" && (
                <Callout tone="neutral">
                  Payment cancelled. You can pay whenever you&apos;re ready.
                </Callout>
              )}
              {openInvoice ? (
                <>
                  <p className="text-ink-soft">
                    Your first invoice ({openInvoice.number}) for{" "}
                    {formatProposalMoney(
                      openInvoice.totalMinor - openInvoice.amountPaidMinor,
                      openInvoice.currency,
                    )}{" "}
                    is ready. Work starts once it&apos;s paid. You can also pay by EFT using the
                    details on the invoice.
                  </p>
                  <PayButton action={payProposalInvoiceAction}>
                    <input type="hidden" name="token" value={token} />
                  </PayButton>
                </>
              ) : (
                <p className="text-ink-soft">
                  We&apos;ve emailed you an invitation to your Mea Creo client portal, where you can
                  follow progress, approve work and see reports.
                </p>
              )}
            </CardBody>
          </Card>
        ) : p.status === "declined" ? (
          <Callout tone="neutral" title="This proposal was declined">
            If anything changes, we&apos;d be glad to talk.
          </Callout>
        ) : expired ? (
          <Callout tone="warning" title="This proposal has expired">
            Please contact us for an updated proposal.
          </Callout>
        ) : p.status !== "draft" ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader
                title="Accept this proposal"
                description="Accepting is a binding agreement on the terms above. We record your name, email, the time and your IP address."
              />
              <CardBody>
                <ActionForm action={acceptProposalAction} className="space-y-4">
                  <input type="hidden" name="token" value={token} />
                  <TextField name="name" label="Full name" autoComplete="name" required />
                  <TextField
                    name="email"
                    type="email"
                    label="Email"
                    autoComplete="email"
                    defaultValue={p.contactEmail ?? ""}
                    required
                  />
                  <TextField
                    name="role"
                    label="Role (optional)"
                    autoComplete="organization-title"
                  />
                  <CheckboxField
                    name="agree"
                    label={`I accept this proposal and its terms on behalf of ${p.companyName}.`}
                  />
                  <SubmitButton>Accept proposal</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
            <Card className="h-fit">
              <CardHeader title="Not right for you?" />
              <CardBody>
                <ActionForm action={declineProposalAction} className="space-y-3">
                  <input type="hidden" name="token" value={token} />
                  <TextArea name="reason" label="What would make it work? (optional)" rows={3} />
                  <SubmitButton variant="secondary" size="sm">
                    Decline
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          </div>
        ) : null}
      </div>
    </article>
  );
}
