import "server-only";
import { and, eq } from "drizzle-orm";
import { getEnv } from "@/config/env";
import { type DbOrTx, getDb } from "@/db";
import { integrations } from "@/db/schema";
import {
  exchangeCode,
  type GoogleClient,
  googleAuthUrl,
  revokeToken,
} from "@/integrations/google/oauth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/urls";
import { type Actor, logActivity } from "@/modules/activity/log";
import { getPlatformOrganisation } from "@/modules/settings/service";

/**
 * Mea Creo's Google Calendar connection (OAuth). The calendar lives on meacreo@gmail.com;
 * business email stays dylan@meacreo.co.za. Only the refresh token is kept, encrypted
 * (AES-256-GCM, ENCRYPTION_KEY) in the `integrations` table. No passwords, ever.
 */

export const GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";
/** The account the calendar lives on (suggested on Google's sign-in screen). */
export const CALENDAR_ACCOUNT_HINT = "meacreo@gmail.com";

export function googleClient(): GoogleClient | null {
  const env = getEnv();
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : null;
}

/** Why the connection can't be made yet, or null when it can. */
export function googleSetupProblem(): string | null {
  const env = getEnv();
  if (env.CALENDAR_PROVIDER !== "google") return "Set CALENDAR_PROVIDER=google.";
  if (!googleClient()) return "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
  if (!env.ENCRYPTION_KEY) return "Add ENCRYPTION_KEY.";
  return null;
}

export function googleConnectUrl(state: string): string {
  const client = googleClient();
  if (!client) throw new AppError("INTEGRATION_NOT_CONNECTED");
  return googleAuthUrl(client, {
    redirectUri: absoluteUrl(GOOGLE_CALLBACK_PATH),
    state,
    loginHint: CALENDAR_ACCOUNT_HINT,
  });
}

async function connectionRow(db: DbOrTx) {
  const platform = await getPlatformOrganisation(db);
  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organisationId, platform.id),
        eq(integrations.kind, "calendar"),
        eq(integrations.provider, "google"),
      ),
    )
    .limit(1);
  return { platform, row: row ?? null };
}

export async function googleConnection(db: DbOrTx) {
  const { row } = await connectionRow(db);
  return row
    ? {
        status: row.status,
        email: row.metadata.email ?? null,
        connectedAt: row.createdAt,
        lastError: row.lastError,
      }
    : null;
}

export async function completeGoogleConnection(
  db: DbOrTx,
  code: string,
  actor: Actor & { userId: string },
): Promise<{ email?: string }> {
  const client = googleClient();
  if (!client) throw new AppError("INTEGRATION_NOT_CONNECTED");
  const tokens = await exchangeCode(client, code, absoluteUrl(GOOGLE_CALLBACK_PATH));
  if (!tokens.refreshToken)
    throw new AppError("VALIDATION", {
      userMessage:
        "Google didn't return offline access. Remove Mea Creo from your Google account's third-party access and connect again.",
    });
  const { platform, row } = await connectionRow(db);
  const values = {
    status: "CONNECTED" as const,
    credentialsEncrypted: encryptSecret(JSON.stringify({ refreshToken: tokens.refreshToken })),
    metadata: { email: tokens.email ?? "", calendarId: "primary", scope: tokens.scope ?? "" },
    connectedById: actor.userId,
    lastError: null,
  };
  if (row) await db.update(integrations).set(values).where(eq(integrations.id, row.id));
  else
    await db
      .insert(integrations)
      .values({ organisationId: platform.id, kind: "calendar", provider: "google", ...values });
  await logActivity(db, actor, {
    action: "integration.connected",
    summary: `Connected Google Calendar${tokens.email ? ` (${tokens.email})` : ""}`,
  });
  return { email: tokens.email };
}

export async function disconnectGoogle(db: DbOrTx, actor: Actor): Promise<void> {
  const { row } = await connectionRow(db);
  if (!row) return;
  if (row.credentialsEncrypted) {
    try {
      const { refreshToken } = JSON.parse(decryptSecret(row.credentialsEncrypted));
      await revokeToken(refreshToken);
    } catch {
      // Revocation is best-effort; the stored token is deleted either way.
    }
  }
  await db.delete(integrations).where(eq(integrations.id, row.id));
  await logActivity(db, actor, {
    action: "integration.disconnected",
    summary: "Disconnected Google Calendar",
  });
}

/** Used by the Calendar adapter (via the registry). */
export async function loadGoogleRefreshToken(): Promise<string | null> {
  const { row } = await connectionRow(await getDb());
  if (!row?.credentialsEncrypted || row.status !== "CONNECTED") return null;
  try {
    return JSON.parse(decryptSecret(row.credentialsEncrypted)).refreshToken ?? null;
  } catch {
    return null;
  }
}
