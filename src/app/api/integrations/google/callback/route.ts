import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { safeEqual } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { absoluteUrl } from "@/lib/urls";
import { userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { completeGoogleConnection } from "@/modules/integrations/google";

export const dynamic = "force-dynamic";

const back = (result: string) =>
  NextResponse.redirect(absoluteUrl(`/workspace/settings?tab=integrations&google=${result}`));

/** Google redirects here after consent. The state cookie guards against CSRF. */
export async function GET(request: Request) {
  const ctx = await requireStaff("settings.manage");
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get("mc_google_state")?.value ?? "";
  jar.delete({ name: "mc_google_state", path: "/api/integrations/google" });
  const state = url.searchParams.get("state") ?? "";
  if (!expected || !safeEqual(state, expected)) return back("invalid_state");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("denied");
  try {
    await completeGoogleConnection(await getDb(), code, {
      ...userActor(ctx.user),
      userId: ctx.user.id,
    });
    return back("connected");
  } catch (error) {
    logger.warn({ err: String(error) }, "google connect failed");
    return back("failed");
  }
}
