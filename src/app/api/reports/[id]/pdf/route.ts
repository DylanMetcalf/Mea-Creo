import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getAuthContext, staffClientScope } from "@/modules/auth/context";
import { reportPdf } from "@/modules/reports/pdf";

export const dynamic = "force-dynamic";

/** Staff: any report they can access. Clients: only their own published reports. */
export async function GET(_request: Request, { params }: RouteContext<"/api/reports/[id]/pdf">) {
  const ctx = await getAuthContext();
  if (!ctx) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const pdf = await reportPdf(await getDb(), id);
  if (!pdf) return new NextResponse("Not found", { status: 404 });
  if (ctx.kind === "client") {
    if (pdf.organisationId !== ctx.organisationId || pdf.status !== "published")
      return new NextResponse("Not found", { status: 404 });
  } else {
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
