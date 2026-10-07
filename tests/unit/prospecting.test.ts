import { describe, expect, it } from "vitest";
import { parseCsv, programmeSchema, prospectSchema, weekOf } from "@/modules/prospecting/service";

describe("weekOf", () => {
  it("returns the Monday of the South African week", () => {
    expect(weekOf(new Date("2026-10-07T10:00:00+02:00"))).toBe("2026-10-05"); // Wednesday
    expect(weekOf(new Date("2026-10-05T00:30:00+02:00"))).toBe("2026-10-05"); // Monday
    expect(weekOf(new Date("2026-10-11T23:30:00+02:00"))).toBe("2026-10-05"); // Sunday
    // 23:30 UTC on Sunday is already Monday in South Africa.
    expect(weekOf(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
  });
});

describe("parseCsv", () => {
  it("handles quotes, embedded commas, escaped quotes and CRLF", () => {
    expect(parseCsv('company,reason\r\n"Acme, Inc","They said ""hi"""\r\n\r\nBeta,x\n')).toEqual([
      ["company", "reason"],
      ["Acme, Inc", 'They said "hi"'],
      ["Beta", "x"],
    ]);
  });
});

describe("prospectSchema", () => {
  it("requires a reason and a source, and normalises website and email", () => {
    const ok = prospectSchema.parse({
      company: "Acme Engineering",
      website: "acme.co.za",
      email: "Info@Acme.co.za",
      reason: "Mid-sized engineering firm in Gauteng hiring sales staff.",
      source: "acme.co.za/contact",
    });
    expect(ok.website).toBe("https://acme.co.za");
    expect(ok.email).toBe("info@acme.co.za");
    expect(ok.contactName).toBeNull();
    expect(prospectSchema.safeParse({ company: "Acme", reason: "short", source: "" }).success).toBe(
      false,
    );
  });
});

describe("programmeSchema", () => {
  it("keeps the weekly quota within limits and splits criteria lists", () => {
    const p = programmeSchema.parse({
      status: "active",
      weeklyQuota: "15",
      industries: "Mining\nEngineering, Logistics",
      locations: "",
      roles: "Owner",
      companySizes: "",
    });
    expect(p.weeklyQuota).toBe(15);
    expect(p.industries).toEqual(["Mining", "Engineering", "Logistics"]);
    expect(programmeSchema.safeParse({ status: "active", weeklyQuota: 100 }).success).toBe(false);
  });
});
