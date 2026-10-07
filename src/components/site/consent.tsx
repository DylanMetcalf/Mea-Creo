"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/**
 * Cookie choice (see the Cookie notice). Nothing optional is stored and Google Analytics
 * isn't loaded until the visitor chooses "Accept analytics". The choice lives in
 * `mc_consent` for 12 months; "Cookie settings" in the footer reopens the banner.
 */

type Choice = "analytics" | "essential" | null;
const EVENT = "mc:consent";
const YEAR = 365 * 24 * 3600;
const SOURCE_DAYS = 90;
let reopened = false;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function snapshot(): string {
  const c = readCookie("mc_consent");
  return `${c === "analytics" || c === "essential" ? c : ""}|${reopened ? 1 : 0}`;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** First touch: where the visitor came from, recorded only with consent. */
function rememberSource() {
  if (readCookie("mc_source")) return;
  const params = new URLSearchParams(location.search);
  const source: Record<string, string> = {
    landing: location.pathname,
    at: new Date().toISOString().slice(0, 10),
  };
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    if (ref && ref !== location.hostname) source.ref = ref;
  } catch {
    // Ignore malformed referrers.
  }
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(key);
    if (v) source[key] = v.slice(0, 200);
  }
  writeCookie("mc_source", encodeURIComponent(JSON.stringify(source)), SOURCE_DAYS * 24 * 3600);
}

function forgetAnalytics() {
  const host = location.hostname.replace(/^www\./, "");
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (name === "mc_source" || name === "_ga" || name.startsWith("_ga_")) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
      document.cookie = `${name}=; Path=/; Max-Age=0; Domain=.${host}`;
    }
  }
}

function choose(choice: Exclude<Choice, null>) {
  writeCookie("mc_consent", choice, YEAR);
  if (choice === "analytics") rememberSource();
  else forgetAnalytics();
  reopened = false;
  window.dispatchEvent(new Event(EVENT));
}

function loadGa(id: string) {
  if (document.getElementById("ga4")) return;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  w.gtag("js", new Date());
  w.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement("script");
  s.id = "ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function ConsentBanner({ gaId }: { gaId?: string }) {
  const state = useSyncExternalStore(subscribe, snapshot, () => "server");
  const [choice, open] = state.split("|");
  useEffect(() => {
    if (choice === "analytics" && gaId) loadGa(gaId);
  }, [choice, gaId]);

  if (state === "server" || (choice && open !== "1")) return null;
  return (
    <section
      aria-label="Cookie choice"
      className="border-border bg-surface/95 shadow-lifted fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border p-5 backdrop-blur-xl motion-safe:animate-[rise_.3s_var(--ease-out)] sm:inset-x-auto sm:bottom-5 sm:left-5"
    >
      <div className="flex gap-3">
        <span className="bg-signal/15 text-brand-700 flex size-9 shrink-0 items-center justify-center rounded-full">
          <Cookie className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-ink font-semibold">Your cookie choice</h2>
          <p className="text-muted mt-1 text-sm">
            We use essential cookies to run the site. With your permission we&apos;d also use Google
            Analytics and remember how you found us, so we know what&apos;s useful. No advertising
            cookies.{" "}
            <Link href="/legal/cookies" className="text-brand-700 underline underline-offset-2">
              Cookie notice
            </Link>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => choose("analytics")}>
              Accept analytics
            </Button>
            <Button size="sm" variant="secondary" onClick={() => choose("essential")}>
              Essential only
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        reopened = true;
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      Cookie settings
    </button>
  );
}
