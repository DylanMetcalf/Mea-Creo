import { desc } from "drizzle-orm";
import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { proposalItems, proposals } from "@/db/schema";
import { fmtDate, fmtRelative } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { formatProposalMoney, proposalTotals } from "@/modules/proposals/service";

export const metadata: Metadata = { title: "Proposals" };

export default async function ProposalsPage() {
  await requireStaff("leads.read");
  const db = await getDb();
  const [rows, items] = await Promise.all([
    db.select().from(proposals).orderBy(desc(proposals.createdAt)),
    db.select().from(proposalItems),
  ]);
  return (
    <>
      <PageHeader
        title="Proposals"
        description="Drafted from what we know about the lead. Prices come from your catalogue; nothing is sent until you send it."
        actions={
          <LinkButton href="/workspace/leads" variant="secondary">
            Draft from a lead
          </LinkButton>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No proposals yet"
          description="Open a lead and choose Draft proposal."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-left text-xs">
                <tr className="border-border border-b">
                  <th className="px-4 py-3 font-medium">Proposal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Setup</th>
                  <th className="px-4 py-3 text-right font-medium">Monthly</th>
                  <th className="px-4 py-3 font-medium">Valid until</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const t = proposalTotals(
                    items.filter((i) => i.proposalId === p.id),
                    p.discountPercent,
                  );
                  return (
                    <tr
                      key={p.id}
                      className="border-border hover:bg-surface-2 border-b last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/workspace/proposals/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.companyName}
                        </Link>
                        <p className="text-muted text-xs">{p.number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="proposal" value={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatProposalMoney(t.setupMinor, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatProposalMoney(t.monthlyMinor, p.currency)}
                      </td>
                      <td className="text-muted px-4 py-3">
                        {p.validUntil ? fmtDate(p.validUntil) : "-"}
                      </td>
                      <td className="text-muted px-4 py-3">{fmtRelative(p.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
