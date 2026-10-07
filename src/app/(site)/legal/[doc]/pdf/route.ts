import { getLegalDoc } from "@/content/legal";
import { getDb } from "@/db";
import { generatePdf } from "@/lib/pdf";
import { markdownToPdfBlocks } from "@/lib/pdf-markdown";
import { getPlatformSetting } from "@/modules/settings/service";

export const dynamic = "force-dynamic";

/** Branded PDF of a public legal document (POPIA statement, privacy, terms, cookies). */
export async function GET(_req: Request, ctx: RouteContext<"/legal/[doc]/pdf">) {
  const doc = getLegalDoc((await ctx.params).doc);
  if (!doc) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [company, legal] = await Promise.all([
    getPlatformSetting(db, "company"),
    getPlatformSetting(db, "legal").catch(() => null),
  ]);
  const reviewed = legal?.reviewed[doc.slug] ?? doc.reviewed;
  const updated = new Date(doc.updated).toLocaleDateString("en-ZA", { dateStyle: "long" });
  const body = generatePdf({
    title: doc.title,
    docType: reviewed ? "Policy" : "Policy · draft",
    docMeta: `Last updated ${updated}`,
    footer: `${company.legalName} · ${company.email}`,
    blocks: [
      { type: "title", text: doc.title },
      { type: "subtitle", text: `${company.legalName} · last updated ${updated}` },
      ...(reviewed
        ? []
        : [
            {
              type: "p" as const,
              muted: true,
              text: "Draft: this version is awaiting final review.",
            },
          ]),
      { type: "rule" },
      ...markdownToPdfBlocks(doc.body),
    ],
  });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="mea-creo-${doc.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
