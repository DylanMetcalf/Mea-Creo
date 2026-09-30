import { describe, expect, it } from "vitest";
import { add, formatMoney, fromMajor, money, multiply } from "./money";

describe("money", () => {
  it("parses major-unit strings without float errors", () => {
    expect(fromMajor("0.1").amountMinor + fromMajor("0.2").amountMinor).toBe(30);
    expect(fromMajor("15000.5")).toEqual({ amountMinor: 1_500_050, currency: "ZAR" });
    expect(fromMajor("-3", "USD")).toEqual({ amountMinor: -300, currency: "USD" });
  });

  it("rejects malformed amounts", () => {
    expect(() => fromMajor("12.345")).toThrow(RangeError);
    expect(() => fromMajor("R100")).toThrow(RangeError);
    expect(() => money(1.5)).toThrow(RangeError);
  });

  it("refuses to add different currencies", () => {
    expect(add(money(100), money(250))).toEqual(money(350));
    expect(() => add(money(100, "ZAR"), money(100, "USD"))).toThrow(/exchange rate/);
  });

  it("rounds multiplication to whole minor units", () => {
    expect(multiply(money(999), 0.15)).toEqual(money(150));
  });

  it("formats with the currency", () => {
    expect(formatMoney(money(500_000, "USD"), "en-US")).toBe("$5,000.00");
    expect(formatMoney(money(500_000, "ZAR"))).toMatch(/^R\s?5\s?000,00$/);
  });
});
