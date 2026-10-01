import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getAuthContext, staffClientScope } from "@/modules/auth/context";
import { invoicePdf } from "@/modules/billing/pdf";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const ctx = await getAuthContext();
  if (!ctx) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const pdf = await invoicePdf(await getDb(), id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  if (ctx.kind === "client") {
    if (
      pdf.organisationId !== ctx.organisationId ||
      !ctx.can("portal.billing") ||
      pdf.status === "draft"
    )
      return new NextResponse("Not found", { status: 404 });
  } else {
    if (!ctx.can("billing.read")) return new NextResponse("Not found", { status: 404 });
    const scope = await staffClientScope(ctx);
    if (scope !== "all" && !scope.includes(pdf.organisationId))
      return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf.body), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdf.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
