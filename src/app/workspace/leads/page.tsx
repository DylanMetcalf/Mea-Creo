import { desc, eq } from "drizzle-orm";
import { Plus, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { type LeadStage, leads, users } from "@/db/schema";
import { fmtMoney, fmtRelative } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Leads & pipeline" };

const COLUMNS: { title: string; stages: LeadStage[]; hint: string }[] = [
  { title: "New", stages: ["new", "audit_generated"], hint: "Respond within a day" },
  { title: "Qualified & contacted", stages: ["qualified", "contacted"], hint: "Book a call" },
  { title: "Calls", stages: ["call_booked", "call_completed"], hint: "Prepare, then propose" },
  {
    title: "Proposals",
    stages: ["proposal_draft", "proposal_sent", "negotiation"],
    hint: "Follow up",
  },
  {
    title: "Won",
    stages: ["accepted", "payment_pending", "onboarding", "active_client"],
    hint: "Onboard",
  },
  { title: "Nurture & lost", stages: ["nurture", "lost"], hint: "Keep warm or learn" },
];

export default async function LeadsPage({ searchParams }: PageProps<"/workspace/leads">) {
  await requireStaff("leads.read");
  const params = await searchParams;
  const stage = typeof params.stage === "string" ? params.stage : undefined;
  const db = await getDb();
  const rows = await db
    .select({ lead: leads, owner: users.name })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .orderBy(desc(leads.createdAt));
  const visible = rows.filter(
    (r) => r.lead.stage !== "archived" && (!stage || r.lead.stage === stage),
  );

  return (
    <>
      <PageHeader
        title="Leads & pipeline"
        description="Every prospect, from Visibility Report to client. Qualification is explained, never a single opaque score."
        actions={
          <LinkButton href="/workspace/leads/new">
            <Plus className="size-4" aria-hidden /> Add lead
          </LinkButton>
        }
      >
        {stage && (
          <p className="mt-2 text-sm">
            Filtered: {statusLabel(stage)} ·{" "}
            <Link href="/workspace/leads" className="text-brand-700 underline">
              clear
            </Link>
          </p>
        )}
      </PageHeader>
      {visible.length === 0 ? (
        <EmptyState
          icon={<Target className="size-6" />}
          title="No leads yet"
          description="Visibility Report requests, call bookings and contact forms create leads automatically. You can also add or import them."
          action={<LinkButton href="/workspace/leads/new">Add a lead</LinkButton>}
        />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {COLUMNS.map((col) => {
              const items = visible.filter((r) => col.stages.includes(r.lead.stage));
              const value = items.reduce((s, r) => s + (r.lead.estimatedMonthlyMinor ?? 0), 0);
              return (
                <section
                  key={col.title}
                  aria-label={col.title}
                  className="rounded-card bg-surface-2 flex flex-col p-2"
                >
                  <header className="px-2 py-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">{col.title}</h2>
                      <span className="text-muted text-xs tabular-nums">{items.length}</span>
                    </div>
                    <p className="text-muted text-xs">
                      {value ? `${fmtMoney(value)}/mo est.` : col.hint}
                    </p>
                  </header>
                  <ul className="space-y-2">
                    {items.map(({ lead, owner }) => (
                      <li key={lead.id}>
                        <Link
                          href={`/workspace/leads/${lead.id}`}
                          className="border-border bg-surface shadow-card hover:border-brand-300 block rounded-lg border p-3"
                        >
                          <p className="text-sm leading-snug font-medium">{lead.company}</p>
                          <p className="text-muted mt-0.5 text-xs">
                            {lead.contactName ?? "No contact"}
                            {lead.industry ? ` · ${lead.industry}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge tone="neutral">{statusLabel(lead.stage)}</Badge>
                            {lead.score && (
                              <Badge
                                tone={
                                  lead.score.fit.level === "high"
                                    ? "success"
                                    : lead.score.fit.level === "low"
                                      ? "neutral"
                                      : "warning"
                                }
                              >
                                Fit: {lead.score.fit.level}
                              </Badge>
                            )}
                          </div>
                          <p className="text-subtle mt-2 text-[0.7rem]">
                            {statusLabel(lead.source)} ·{" "}
                            {fmtRelative(lead.lastActivityAt ?? lead.createdAt)}
                            {owner ? ` · ${owner.split(" ")[0]}` : " · unassigned"}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
