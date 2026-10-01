import { and, desc, eq, ne } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { DueLabel, StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Approvals" };

export default async function PortalApprovals() {
  const ctx = await requireClient();
  const db = await getDb();
  const [pending, decided] = await Promise.all([
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, ctx.organisationId),
          eq(approvals.level, "client"),
          eq(approvals.status, "pending"),
        ),
      )
      .orderBy(desc(approvals.createdAt)),
    db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, ctx.organisationId),
          eq(approvals.level, "client"),
          ne(approvals.status, "pending"),
        ),
      )
      .orderBy(desc(approvals.decidedAt))
      .limit(30),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Approvals</h1>
        <p className="text-muted mt-1">Nothing goes live on your behalf until you approve it.</p>
      </header>
      {pending.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title="Nothing waiting for you"
          description="We'll notify you when something needs your sign-off."
        />
      ) : (
        <Card>
          <CardHeader title={`Waiting for you (${pending.length})`} />
          <ul className="divide-border divide-y">
            {pending.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/approvals/${a.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{a.title}</span>
                    {a.description && (
                      <span className="text-muted block text-sm">{a.description}</span>
                    )}
                  </span>
                  {a.dueAt ? (
                    <DueLabel due={a.dueAt} />
                  ) : (
                    <span className="text-brand-700 text-sm">Review</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {decided.length > 0 && (
        <Card>
          <CardHeader title="Decided" />
          <ul className="divide-border divide-y">
            {decided.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/approvals/${a.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span>
                    {a.title}
                    <span className="text-muted block text-xs">{fmtDate(a.decidedAt)}</span>
                  </span>
                  <StatusBadge kind="approval" value={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
