import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "@/lib/errors";

export const AUDIT_USER_AGENT =
  "MeaCreoVisibilityBot/1.0 (+https://www.meacreo.co.za/visibility-report)";

/** Normalises user input like "example.co.za" into a URL, or throws a validation error. */
export function normaliseWebsiteUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500)
    throw new AppError("VALIDATION", { userMessage: "Please enter your website address." });
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new AppError("VALIDATION", { userMessage: "That doesn't look like a website address." });
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new AppError("VALIDATION", {
      userMessage: "Please enter a normal website address (http or https).",
    });
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new AppError("VALIDATION", {
      userMessage: "Please enter a website on the standard web ports.",
    });
  }
  if (
    !url.hostname.includes(".") ||
    /\.(local|internal|localhost|lan|test)$/i.test(url.hostname) ||
    url.hostname === "localhost"
  ) {
    throw new AppError("VALIDATION", { userMessage: "Please enter a public website address." });
  }
  url.hash = "";
  return url;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
];

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const value = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host))
      throw new AppError("VALIDATION", { userMessage: "Please enter a public website address." });
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new AppError("VALIDATION", {
      userMessage: "We couldn't find that website. Please check the address.",
    });
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new AppError("VALIDATION", { userMessage: "Please enter a public website address." });
  }
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  responseTimeMs: number;
  redirects: number;
}

/**
 * Fetches a public URL for analysis. Every redirect hop is re-validated against
 * private/internal address ranges (SSRF protection), with a time and size limit.
 */
export async function safeFetch(
  input: string | URL,
  options: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 3_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  let current = new URL(input);
  const started = Date.now();

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (!/^https?:$/.test(current.protocol))
      throw new AppError("VALIDATION", {
        userMessage: "The website redirected somewhere we can't follow.",
      });
    await assertPublicHost(current.hostname);

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": AUDIT_USER_AGENT,
        accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5",
      },
    });

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = new URL(response.headers.get("location")!, current);
      await response.body?.cancel();
      continue;
    }

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    return {
      url: String(input),
      finalUrl: current.href,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
      bytes,
      responseTimeMs: Date.now() - started,
      redirects,
    };
  }
  throw new AppError("VALIDATION", { userMessage: "The website redirected too many times." });
}
