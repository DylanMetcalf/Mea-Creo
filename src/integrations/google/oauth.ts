/**
 * Google OAuth 2.0 (web server flow) over plain HTTPS: no SDK. Used by the Calendar
 * adapter and the connect/callback routes. Passwords are never stored: only a refresh
 * token, encrypted at rest by the caller.
 */

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

export function googleAuthUrl(
  client: GoogleClient,
  input: { redirectUri: string; state: string; scopes?: string[]; loginHint?: string },
): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: (input.scopes ?? GOOGLE_CALENDAR_SCOPES).join(" "),
    access_type: "offline",
    // Always show consent so Google returns a refresh token on reconnect.
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `${AUTH_URL}?${params}`;
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  email?: string;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    const reason = typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new GoogleAuthError(reason);
  }
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    email: typeof json.id_token === "string" ? emailFromIdToken(json.id_token) : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  };
}

export class GoogleAuthError extends Error {
  constructor(readonly reason: string) {
    super(`Google OAuth error: ${reason}`);
  }
  /** The refresh token was revoked or expired: the user must reconnect. */
  get needsReconnect() {
    return this.reason === "invalid_grant";
  }
}

/** The id_token comes straight from Google's token endpoint over TLS, so it's read, not verified. */
function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return undefined;
  }
}

export function exchangeCode(client: GoogleClient, code: string, redirectUri: string) {
  return tokenRequest({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(client: GoogleClient, refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(
    () => undefined,
  );
}
