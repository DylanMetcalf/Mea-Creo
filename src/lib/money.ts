/**
 * Money is stored as integer minor units (cents) plus an ISO-4217 code.
 * Never use floating point for amounts. Prices are never hard-coded in
 * the application: they come from the configurable pricing engine (Phase 10).
 */

export const SUPPORTED_CURRENCIES = ["ZAR", "USD", "GBP", "EUR", "CAD", "AUD"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = "ZAR";

export interface Money {
  /** Integer amount in the currency's minor unit, e.g. cents. */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function isCurrency(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function money(amountMinor: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(
      `Money amount must be an integer number of minor units, got ${amountMinor}`,
    );
  }
  return { amountMinor, currency };
}

/** Parses a major-unit decimal string such as "1500.50" without float rounding errors. */
export function fromMajor(value: string, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Invalid money amount: "${value}"`);
  const [, sign, whole, fraction = ""] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return money(sign ? -minor : minor, currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function multiply(a: Money, factor: number): Money {
  return money(Math.round(a.amountMinor * factor), a.currency);
}

export function formatMoney(value: Money, locale = "en-ZA"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: value.currency }).format(
    value.amountMinor / 100,
  );
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new RangeError(`Cannot combine ${a.currency} and ${b.currency} without an exchange rate`);
  }
}
