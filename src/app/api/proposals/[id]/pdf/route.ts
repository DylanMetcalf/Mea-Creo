import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getAuthContext } from "@/modules/auth/context";
import { proposalPdf } from "@/modules/proposals/pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: RouteContext<"/api/proposals/[id]/pdf">) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.kind !== "staff" || !ctx.can("leads.read"))
    return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const pdf = await proposalPdf(await getDb(), id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(pdf.body), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdf.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
