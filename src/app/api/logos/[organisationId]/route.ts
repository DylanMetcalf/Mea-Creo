import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getAuthContext, staffClientScope } from "@/modules/auth/context";
import { getClientLogo } from "@/modules/clients/logo";

/** A client's logo, for signed-in staff who can see the client and the client's own users. */
export async function GET(_req: Request, ctx: RouteContext<"/api/logos/[organisationId]">) {
  const { organisationId } = await ctx.params;
  const auth = await getAuthContext();
  if (!auth) return new NextResponse(null, { status: 401 });
  const allowed =
    auth.kind === "staff"
      ? ((s) => s === "all" || s.includes(organisationId))(await staffClientScope(auth))
      : auth.organisations.some((o) => o.id === organisationId);
  if (!allowed) return new NextResponse(null, { status: 404 });
  const logo = await getClientLogo(await getDb(), organisationId);
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(logo.body), {
    headers: {
      "content-type": logo.contentType,
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff",
    },
  });
}
