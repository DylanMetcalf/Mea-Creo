import { and, desc, eq } from "drizzle-orm";
import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Reports" };

export default async function PortalReports() {
  const ctx = await requireClient();
  const rows = await (
    await getDb()
  )
    .select()
    .from(reports)
    .where(and(eq(reports.organisationId, ctx.organisationId), eq(reports.status, "published")))
    .orderBy(desc(reports.publishedAt));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Reports</h1>
        <p className="text-muted mt-1">
          What we did, what changed, what we learned and what&apos;s next.
        </p>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-6" />}
          title="No reports yet"
          description="Your first monthly report will appear here."
        />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/portal/reports/${r.id}`}
                  className="hover:bg-surface-2 block px-5 py-4"
                >
                  <span className="block font-medium">{r.title}</span>
                  <span className="text-ink-soft mt-1 block text-sm">{r.content.headline}</span>
                  <span className="text-muted mt-1 block text-xs">
                    Published {fmtDate(r.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
