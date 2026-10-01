import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkQuality } from "@/agents/quality";
import { DEMO_FIXTURES, fixtureFetcher } from "@/db/seed/fixtures";
import { payfastEncode, payfastSignature } from "@/integrations/payments/payfast";
import { analyse } from "@/modules/audits/analyse";
import { collectSignals } from "@/modules/audits/collect";
import { isPrivateAddress } from "@/modules/audits/fetcher";
import { assessHealth, type HealthSignals } from "@/modules/clients/health";
import { qualifyLead } from "@/modules/leads/qualify";
import { computeSlots } from "@/modules/meetings/availability";
import { proposalTotals } from "@/modules/proposals/service";
import { settingsDefaults } from "@/modules/settings/schema";

describe("Visibility audit engine", () => {
  it("produces explained findings, 3 to 7 opportunities and no overall score", async () => {
    for (const site of Object.keys(DEMO_FIXTURES)) {
      const signals = await collectSignals(new URL(site), fixtureFetcher);
      const result = analyse({ url: site, signals, durationMs: 1 });
      expect(result.opportunities.length).toBeGreaterThanOrEqual(3);
      expect(result.opportunities.length).toBeLessThanOrEqual(7);
      expect(result).not.toHaveProperty("score");
      for (const f of result.categories.flatMap((c) => c.findings)) {
        expect(f.whatIsHappening, f.title).toBeTruthy();
        if (f.status === "fail" || f.status === "warn") expect(f.whatToDo, f.title).toBeTruthy();
      }
    }
  });

  it("blocks private and loopback addresses (SSRF)", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.1",
      "172.16.5.4",
      "169.254.169.254",
      "::1",
      "fc00::1",
      "0.0.0.0",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "41.0.0.1", "2a00:1450::1"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("Lead qualification", () => {
  it("explains every dimension and is honest about missing data", () => {
    const empty = qualifyLead({});
    expect(empty.score.confidence.level).not.toBe("high");
    const good = qualifyLead({
      industry: "Engineering",
      employeeRange: "11-50",
      goal: "More enquiries",
    });
    for (const dim of [good.score.fit, good.score.commercialFit, good.score.confidence])
      expect(dim.reasons.length).toBeGreaterThan(0);
    expect(good.score.fit.level).toBe("high");
    expect(good.recommendedPackage.ongoing).toBe("package-growth");
  });

  it("treats mining as a target sector and flags poor-fit signals", () => {
    expect(qualifyLead({ industry: "Mining services" }).score.commercialFit.level).toBe("high");
    const cheap = qualifyLead({ industry: "Mining", message: "Looking for the lowest price" });
    expect(cheap.score.commercialFit.level).toBe("low");
    expect(cheap.score.fit.level).toBe("low");
  });

  it("compares estimated value with the internal floor", () => {
    const low = qualifyLead({ estimatedMonthlyMinor: 300_000 });
    expect(low.score.recurringValue.level).toBe("low");
    const high = qualifyLead({ estimatedMonthlyMinor: 1_250_000 });
    expect(high.score.recurringValue.level).toBe("high");
  });
});

describe("Client health", () => {
  const base: HealthSignals = {
    billingState: "active",
    lifecycle: "active",
    automationPaused: false,
    activeServices: 3,
    pausedServices: 0,
    overdueTasks: 0,
    completedTasksLast30: 6,
    clientApprovalsWaitingOver5Days: 0,
    criticalFindings: 0,
    lastClientMessageDays: 3,
  };
  it("is healthy with no negative signals", () => expect(assessHealth(base).state).toBe("healthy"));
  it("takes the worst condition and lists each reason", () => {
    const r = assessHealth({ ...base, billingState: "overdue", overdueTasks: 4 });
    expect(r.state).toBe("at_risk");
    expect(r.reasons.map((x) => x.signal)).toContain("Payment");
    expect(assessHealth({ ...base, billingState: "suspended" }).state).toBe("paused");
  });
});

describe("Booking availability", () => {
  const settings = settingsDefaults.booking;
  // Monday 2026-10-05 06:00 UTC = 08:00 SAST
  const now = new Date("2026-10-05T06:00:00Z");
  it("respects working days, hours, notice and existing meetings", () => {
    const busy = [
      { start: new Date("2026-10-06T08:00:00Z"), end: new Date("2026-10-06T08:30:00Z") },
    ];
    const days = computeSlots({ settings, durationMinutes: 30, busy, now });
    const all = days.flatMap((d) => d.slots);
    expect(all.length).toBeGreaterThan(0);
    for (const s of all) {
      expect(s.getTime()).toBeGreaterThanOrEqual(
        now.getTime() + settings.minNoticeHours * 3600_000,
      );
      const local = new Date(s.getTime() + 2 * 3600_000);
      expect([0, 6]).not.toContain(local.getUTCDay());
      expect(local.getUTCHours()).toBeGreaterThanOrEqual(settings.startHour);
      expect(local.getUTCHours() * 60 + local.getUTCMinutes() + 30).toBeLessThanOrEqual(
        settings.endHour * 60,
      );
      // Never overlaps the busy meeting plus buffer.
      const clash =
        s.getTime() < busy[0].end.getTime() + settings.bufferMinutes * 60_000 &&
        s.getTime() + 30 * 60_000 > busy[0].start.getTime() - settings.bufferMinutes * 60_000;
      expect(clash).toBe(false);
    }
  });
});

describe("Booking rules", () => {
  const settings = settingsDefaults.booking;
  it("offers discovery calls only on the configured days, at least one business day ahead, within the daily maximum", () => {
    // Friday 2026-10-09 10:00 SAST: next business day is Monday.
    const now = new Date("2026-10-09T08:00:00Z");
    const days = computeSlots({
      settings,
      durationMinutes: 30,
      busy: [],
      now,
      workingDays: settings.discoveryDays,
    });
    expect(days[0].date).toBe("2026-10-12");
    for (const d of days) expect([1, 2, 3]).toContain(new Date(`${d.date}T12:00:00Z`).getUTCDay());
    const full = computeSlots({
      settings,
      durationMinutes: 30,
      busy: [],
      now,
      workingDays: settings.discoveryDays,
      bookedPerDay: new Map([["2026-10-12", settings.maxBookingsPerDay]]),
    });
    expect(full[0].date).toBe("2026-10-13");
  });
});

describe("Payfast signature", () => {
  it("encodes like PHP urlencode and skips empty fields", () => {
    expect(payfastEncode("Test Item & co")).toBe("Test+Item+%26+co");
    const fields: [string, string][] = [
      ["merchant_id", "10000100"],
      ["merchant_key", "46f0cd694581a"],
      ["name_first", ""],
      ["amount", "100.00"],
      ["item_name", "Test Item"],
    ];
    const expected = createHash("md5")
      .update(
        "merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test+Item&passphrase=jt7NOE43FZPn",
      )
      .digest("hex");
    expect(payfastSignature(fields, "jt7NOE43FZPn")).toBe(expected);
  });
});

describe("Proposal totals", () => {
  it("excludes optional items and applies the monthly discount only", () => {
    const t = proposalTotals(
      [
        { setupMinor: 500_000, monthlyMinor: 850_000, oneOffMinor: 0, optional: false },
        { setupMinor: 0, monthlyMinor: 450_000, oneOffMinor: 0, optional: true },
        { setupMinor: 0, monthlyMinor: 0, oneOffMinor: 200_000, optional: false },
      ],
      10,
    );
    expect(t).toEqual({
      setupMinor: 700_000,
      monthlyMinor: 765_000,
      monthlyDiscountMinor: 85_000,
      optionalMonthlyMinor: 450_000,
    });
  });
});

describe("Quality control", () => {
  it("blocks guarantees of results", () => {
    expect(checkQuality("We guarantee first page rankings on Google.").passed).toBe(false);
    expect(checkQuality("We'll improve your service pages and report what changed.").passed).toBe(
      true,
    );
  });
});
