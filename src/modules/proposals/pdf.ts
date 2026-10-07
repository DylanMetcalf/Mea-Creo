import type { DbOrTx } from "@/db";
import { fmtDate } from "@/lib/format";
import { generatePdf, type PdfBlock } from "@/lib/pdf";
import { clientLogoForPdf } from "@/modules/clients/logo";
import { getPlatformSetting } from "@/modules/settings/service";
import { formatProposalMoney, getProposal, proposalTotals } from "./service";

/** Renders a proposal as a branded PDF. */
export async function proposalPdf(
  db: DbOrTx,
  id: string,
): Promise<{ filename: string; body: Buffer } | null> {
  const data = await getProposal(db, id);
  if (!data) return null;
  const { proposal: p, items } = data;
  const [company, logo] = await Promise.all([
    getPlatformSetting(db, "company"),
    clientLogoForPdf(db, p.organisationId),
  ]);
  const m = (minor: number) => formatProposalMoney(minor, p.currency);
  const totals = proposalTotals(items, p.discountPercent);
  const blocks: PdfBlock[] = [
    { type: "title", text: p.title },
    {
      type: "subtitle",
      text: `${p.number} · Prepared for ${p.companyName}${p.validUntil ? ` · Valid until ${fmtDate(p.validUntil)}` : ""}`,
    },
    { type: "rule" },
  ];
  if (p.summary) blocks.push({ type: "h2", text: "Summary" }, { type: "p", text: p.summary });
  const section = (title: string, list: string[]) => {
    if (list.length) blocks.push({ type: "h2", text: title }, { type: "bullets", items: list });
  };
  section("What we found", p.problems);
  section("Goals", p.goals);
  section("What we will do", p.activities);
  section("How we will measure progress", p.kpis);
  blocks.push(
    { type: "h2", text: "Investment" },
    {
      type: "table",
      headers: ["Service", "Setup / once-off", "Monthly"],
      widths: [0.5, 0.25, 0.25],
      alignRight: [1, 2],
      rows: items.map((i) => [
        `${i.name}${i.optional ? " (optional)" : ""}`,
        i.setupMinor + i.oneOffMinor ? m(i.setupMinor + i.oneOffMinor) : "-",
        i.monthlyMinor ? m(i.monthlyMinor) : "-",
      ]),
    },
    {
      type: "highlight",
      rows: [
        ["Setup and once-off total", m(totals.setupMinor)],
        ...(totals.monthlyDiscountMinor
          ? ([["Monthly discount", `-${m(totals.monthlyDiscountMinor)}`]] as [string, string][])
          : []),
        ["Monthly total", m(totals.monthlyMinor)],
        ["Minimum term", `${p.contractMonths} months`],
      ],
    },
  );
  if (p.timeline) blocks.push({ type: "h2", text: "Timeline" }, { type: "p", text: p.timeline });
  if (p.assumptions)
    blocks.push({ type: "h2", text: "Assumptions" }, { type: "p", text: p.assumptions });
  blocks.push(
    { type: "h2", text: "Important" },
    {
      type: "p",
      muted: true,
      text: "We don't guarantee rankings, AI mentions, traffic or leads: these depend on factors outside anyone's control. We commit to the work, the reporting and honest advice.",
    },
  );
  if (p.terms) blocks.push({ type: "h2", text: "Terms" }, { type: "p", text: p.terms });
  if (p.acceptedAt)
    blocks.push(
      { type: "rule" },
      {
        type: "p",
        text: `Accepted by ${p.acceptedByName} (${p.acceptedByEmail}) on ${fmtDate(p.acceptedAt)}.`,
      },
    );
  const body = generatePdf({
    title: p.title,
    blocks,
    footer: `${company.legalName} · ${company.email}`,
    docType: "Proposal",
    docMeta: `${p.number}${p.validUntil ? ` · valid until ${fmtDate(p.validUntil)}` : ""}`,
    clientLogo: logo,
    clientName: p.companyName,
  });
  return { filename: `${p.number}.pdf`, body };
}
