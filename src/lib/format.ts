import { formatMoney, isCurrency, money } from "./money";

const TZ = "Africa/Johannesburg";

export function fmtMoney(minor: number | null | undefined, currency = "ZAR"): string {
  return formatMoney(money(Math.round(minor ?? 0), isCurrency(currency) ? currency : "ZAR"));
}

/** Compact money for tiles: R 12.3k. */
export function fmtMoneyShort(minor: number, currency = "ZAR"): string {
  const major = minor / 100;
  const symbol =
    currency === "ZAR"
      ? "R"
      : currency === "USD"
        ? "$"
        : currency === "GBP"
          ? "£"
          : currency === "EUR"
            ? "€"
            : `${currency} `;
  if (Math.abs(major) >= 1_000_000) return `${symbol}${(major / 1_000_000).toFixed(1)}m`;
  if (Math.abs(major) >= 10_000) return `${symbol}${Math.round(major / 1000)}k`;
  return fmtMoney(minor, currency);
}

export function fmtDate(
  value: Date | string | null | undefined,
  style: "short" | "medium" | "long" = "medium",
): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-ZA", { timeZone: TZ, dateStyle: style });
}

export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-ZA", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function fmtTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-ZA", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function fmtRelative(value: Date | string | null | undefined, now = new Date()): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86400_000) return rtf.format(Math.round(diff / 3600_000), "hour");
  if (abs < 30 * 86400_000) return rtf.format(Math.round(diff / 86400_000), "day");
  return fmtDate(d);
}

export function humanize(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function startOfDayTz(now = new Date()): Date {
  const local = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const offset = now.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + offset);
}
