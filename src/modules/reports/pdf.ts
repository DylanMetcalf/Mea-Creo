import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { organisations, reports } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { generatePdf, type PdfBlock } from "@/lib/pdf";
import { getPlatformSetting } from "@/modules/settings/service";

/** Renders a report as a PDF. Callers must check access first. */
export async function reportPdf(
  db: DbOrTx,
  id: string,
): Promise<{ filename: string; body: Buffer; organisationId: string; status: string } | null> {
  const [report] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  if (!report) return null;
  const [org] = await db
    .select({ name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, report.organisationId));
  const company = await getPlatformSetting(db, "company");
  const c = report.content;
  const blocks: PdfBlock[] = [
    { type: "title", text: report.title },
    {
      type: "subtitle",
      text: `${org?.name ?? ""}${report.periodStart && report.periodEnd ? ` · ${fmtDate(report.periodStart)} to ${fmtDate(report.periodEnd)}` : ""}`,
    },
    { type: "rule" },
    { type: "p", text: c.headline },
  ];
  const section = (title: string, items: string[]) => {
    if (items.length) blocks.push({ type: "h2", text: title }, { type: "bullets", items });
  };
  section("What we did", c.whatWeDid);
  if (c.activityMetrics.length)
    blocks.push({
      type: "table",
      headers: ["Activity", "Value"],
      widths: [0.7, 0.3],
      alignRight: [1],
      rows: c.activityMetrics.map((m) => [m.label, m.value]),
    });
  section("What changed", c.whatChanged);
  if (c.outcomeMetrics.length)
    blocks.push({
      type: "table",
      headers: ["Outcome", "Value", "Change", "Source"],
      widths: [0.4, 0.2, 0.15, 0.25],
      alignRight: [1, 2],
      rows: c.outcomeMetrics.map((m) => [m.label, m.value, m.change ?? "", m.source ?? ""]),
    });
  section("What we learned", c.whatWeLearned);
  section("Opportunities", c.opportunities);
  section("What happens next", c.whatHappensNext);
  section("What we need from you", c.needsFromYou);
  if (c.dataNotes.length)
    blocks.push(
      { type: "h2", text: "About the data" },
      ...c.dataNotes.map((n): PdfBlock => ({ type: "p", text: n, muted: true })),
    );
  const body = generatePdf({
    title: report.title,
    blocks,
    footer: `${company.tradingName} · ${company.email}`,
  });
  return {
    filename: `${report.title.replace(/[^\w -]+/g, "").slice(0, 80)}.pdf`,
    body,
    organisationId: report.organisationId,
    status: report.status,
  };
}
