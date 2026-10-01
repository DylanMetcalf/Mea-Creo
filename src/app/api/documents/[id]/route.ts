import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { getAuthContext, staffClientScope } from "@/modules/auth/context";
import { documentDownloadUrl } from "@/modules/documents/service";

export const dynamic = "force-dynamic";

/** Authorised download: checks the user's access, then redirects to a 5-minute signed URL. */
export async function GET(request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  const db = await getDb();
  const [doc] = await db
    .select({ organisationId: documents.organisationId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  try {
    if (ctx.kind === "client") {
      if (doc.organisationId !== ctx.organisationId)
        return new NextResponse("Not found", { status: 404 });
      const url = await documentDownloadUrl(db, id, ctx.organisationId, { clientOnly: true });
      return NextResponse.redirect(new URL(url, request.url));
    }
    const scope = await staffClientScope(ctx);
    if (
      scope !== "all" &&
      !scope.includes(doc.organisationId) &&
      doc.organisationId !== ctx.platformOrganisationId
    )
      return new NextResponse("Not found", { status: 404 });
    const url = await documentDownloadUrl(db, id, doc.organisationId, { clientOnly: false });
    return NextResponse.redirect(new URL(url, request.url));
  } catch (error) {
    return new NextResponse(error instanceof AppError ? error.userMessage : "Download failed", {
      status: error instanceof AppError ? error.status : 500,
    });
  }
}
