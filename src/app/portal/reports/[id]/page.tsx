import { and, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportBody } from "@/components/reports/report-body";
import { LinkButton } from "@/components/ui/button";
import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Report" };

export default async function PortalReport({ params }: PageProps<"/portal/reports/[id]">) {
  const ctx = await requireClient();
  const { id } = await params;
  const [r] = await (
    await getDb()
  )
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.id, id),
        eq(reports.organisationId, ctx.organisationId),
        eq(reports.status, "published"),
      ),
    )
    .limit(1);
  if (!r) notFound();
  return (
    <div className="space-y-6">
      <div className="text-muted text-sm">
        <Link href="/portal/reports" className="hover:text-ink">
          Reports
        </Link>
      </div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-ink text-2xl sm:text-3xl">{r.title}</h1>
          <p className="text-muted mt-1 text-sm">
            {r.periodStart ? `${fmtDate(r.periodStart)} to ${fmtDate(r.periodEnd)} · ` : ""}
            published {fmtDate(r.publishedAt)}
          </p>
        </div>
        <LinkButton href={`/api/reports/${r.id}/pdf`} variant="secondary" target="_blank">
          <Download className="size-4" aria-hidden /> PDF
        </LinkButton>
      </header>
      <ReportBody content={r.content} />
      <p className="text-muted text-sm">
        Questions about this report?{" "}
        <Link href="/portal/messages" className="text-brand-700 underline">
          Message us
        </Link>{" "}
        or{" "}
        <Link href="/portal/ask" className="text-brand-700 underline">
          ask Mea Creo
        </Link>
        .
      </p>
    </div>
  );
}
