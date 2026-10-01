import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { caseStudies, INSIGHT_CATEGORY_LABELS, insights } from "@/db/schema";
import { fmtDate, humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Website content" };

const tone = (s: string) =>
  s === "published" ? "success" : s === "review" ? "warning" : "neutral";

export default async function InsightsAdminPage() {
  const ctx = await requireStaff();
  const db = await getDb();
  const [articles, work] = await Promise.all([
    db.select().from(insights).orderBy(desc(insights.updatedAt)),
    db.select().from(caseStudies).orderBy(desc(caseStudies.updatedAt)),
  ]);
  const canWrite = ctx.can("content.write");
  return (
    <>
      <PageHeader
        title="Website content"
        description="Insights articles and case studies for the public website. Nothing is published without a person choosing to publish it."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Insights"
            action={
              canWrite && (
                <LinkButton href="/workspace/insights/new" size="sm" variant="secondary">
                  <Plus className="size-4" aria-hidden /> New article
                </LinkButton>
              )
            }
          />
          <ul className="divide-border divide-y">
            {articles.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">No articles yet.</li>
            )}
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/workspace/insights/${a.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="text-muted block text-xs">
                      {INSIGHT_CATEGORY_LABELS[a.category]} · {a.authorName} ·{" "}
                      {a.publishedAt
                        ? `published ${fmtDate(a.publishedAt)}`
                        : `updated ${fmtDate(a.updatedAt)}`}
                    </span>
                  </span>
                  <Badge tone={tone(a.status)}>{humanize(a.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Case studies & work"
            description="Only published with the client's permission; only verified outcomes are shown."
            action={
              canWrite && (
                <LinkButton href="/workspace/insights/work/new" size="sm" variant="secondary">
                  <Plus className="size-4" aria-hidden /> New case study
                </LinkButton>
              )
            }
          />
          <ul className="divide-border divide-y">
            {work.length === 0 && (
              <li className="text-muted px-5 py-4 text-sm">
                No case studies yet. Add real work once a client agrees to be featured.
              </li>
            )}
            {work.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/workspace/insights/work/${w.id}`}
                  className="hover:bg-surface-2 flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{w.title}</span>
                    <span className="text-muted block text-xs">
                      {w.clientName} · {humanize(w.type)} ·{" "}
                      {w.clientPermission ? "permission confirmed" : "no permission recorded"}
                    </span>
                  </span>
                  <Badge tone={tone(w.status)}>{humanize(w.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
