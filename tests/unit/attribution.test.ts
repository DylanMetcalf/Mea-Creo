import { describe, expect, it } from "vitest";
import { channelFor, parseSourceCookie } from "@/modules/leads/attribution";

describe("parseSourceCookie", () => {
  it("keeps known keys only, trimmed and capped", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        ref: "www.google.com",
        landing: "/pricing",
        evil: "x",
        utm_source: "a".repeat(300),
      }),
    );
    const out = parseSourceCookie(raw);
    expect(out).toEqual({
      ref: "www.google.com",
      landing: "/pricing",
      utm_source: "a".repeat(200),
    });
  });

  it("ignores junk", () => {
    expect(parseSourceCookie("not json")).toEqual({});
    expect(parseSourceCookie(encodeURIComponent("[1,2]"))).toEqual({});
    expect(parseSourceCookie(undefined)).toEqual({});
  });
});

describe("channelFor", () => {
  it.each([
    [{ ref: "www.google.com" }, "Organic search"],
    [{ ref: "chatgpt.com" }, "AI assistant"],
    [{ ref: "www.perplexity.ai" }, "AI assistant"],
    [{ utm_medium: "cpc", ref: "www.google.com" }, "Paid"],
    [{ utm_medium: "email" }, "Email"],
    [{ ref: "www.linkedin.com" }, "Social"],
    [{ ref: "partner.co.za" }, "Referral"],
    [{ landing: "/" }, "Direct"],
    [{}, "Unknown"],
  ])("%j → %s", (input, expected) => {
    expect(channelFor(input)).toBe(expected);
  });
});
