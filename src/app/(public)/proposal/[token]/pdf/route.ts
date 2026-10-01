import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getProposalByToken } from "@/modules/proposals/service";
import { proposalPdf } from "@/modules/proposals/pdf";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/proposal/[token]/pdf">) {
  const { token } = await params;
  const db = await getDb();
  const data = await getProposalByToken(db, token);
  if (!data || data.proposal.status === "draft")
    return new NextResponse("Not found", { status: 404 });
  const pdf = await proposalPdf(db, data.proposal.id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(pdf.body), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdf.filename}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
