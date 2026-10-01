import { hmacSha256, safeEqual } from "@/lib/crypto";

/** Normalised identifiers so an opt-out matches however the address was typed. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalisePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
}

export function linkedinPath(url: string): string | null {
  const m = url.match(/linkedin\.com\/(in|company)\/([^/?#]+)/i);
  return m ? `${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
}

const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|icloud|me|mweb|telkomsa|vodamail|webmail|aol|proton|protonmail)\./;

/** The organisation's email domain, or null for free-mail addresses (never suppress gmail.com). */
export function businessDomain(email: string): string | null {
  const domain = normaliseEmail(email).split("@")[1];
  return domain && !FREE_MAIL.test(domain) ? domain : null;
}

function signingSecret(): string {
  return process.env.AUTH_SECRET ?? "mea-creo-development-only-signing-secret";
}

/** Opt-out link token for a lead: not guessable, never expires (opt-outs must always work). */
export function unsubscribeToken(leadId: string): string {
  return `${leadId}.${hmacSha256(signingSecret(), `unsubscribe:${leadId}`).slice(0, 32)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig || !/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  const expected = hmacSha256(signingSecret(), `unsubscribe:${leadId}`).slice(0, 32);
  return safeEqual(sig, expected) ? leadId : null;
}
