import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireStaff } from "@/modules/auth/context";
import { googleConnectUrl, googleSetupProblem } from "@/modules/integrations/google";

export const dynamic = "force-dynamic";

/** Starts the Google OAuth flow (founder/manager with settings access only). */
export async function GET() {
  await requireStaff("settings.manage");
  const problem = googleSetupProblem();
  if (problem)
    return NextResponse.json(
      { error: `Google Calendar isn't configured: ${problem}` },
      { status: 409 },
    );
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("mc_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleConnectUrl(state));
}
