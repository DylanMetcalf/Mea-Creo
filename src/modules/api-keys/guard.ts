import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { hitRateLimit } from "@/modules/auth/rate-limit";
import { type ApiScope, verifyApiKey } from "./service";

/** Authenticates `Authorization: Bearer mc_…` for a scope; returns an error response or the key. */
export async function requireApiKey(request: Request, scope: ApiScope) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const db = await getDb();
  const key = await verifyApiKey(db, raw, scope);
  if (!key)
    return {
      error: NextResponse.json(
        { error: "Invalid API key or missing permission." },
        { status: 401 },
      ),
    } as const;
  const limit = await hitRateLimit(db, `api:${key.id}`, 120, 60);
  if (limit.limited)
    return {
      error: NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 }),
    } as const;
  return { key, db } as const;
}
