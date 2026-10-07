"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { APPROVAL_LEVELS, DELIVERABLE_KINDS, memberships, users } from "@/db/schema";
import { type ActionState, checkbox, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { fromMajor } from "@/lib/money";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, userActor } from "@/modules/activity/log";
import { API_SCOPES, type ApiScope, createApiKey, revokeApiKey } from "@/modules/api-keys/service";
import { bankDetailsSchema, maskAccountNumber, setBankDetails } from "@/modules/banking/service";
import { requireStaff } from "@/modules/auth/context";
import { STAFF_ROLES } from "@/modules/auth/permissions";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { disconnectGoogle } from "@/modules/integrations/google";
import { inviteClientUser } from "@/modules/onboarding/service";
import {
  getPlatformOrganisation,
  getPlatformSetting,
  setSetting,
} from "@/modules/settings/service";
import type { Settings, SettingsKey } from "@/modules/settings/schema";

async function save<K extends SettingsKey>(
  key: K,
  value: Settings<K>,
  permission: "settings.manage" | "emergency.controls" | "billing.manage" = "settings.manage",
) {
  const ctx = await requireStaff(permission);
  const db = await getDb();
  const platform = await getPlatformOrganisation(db);
  const before = await getPlatformSetting(db, key);
  await setSetting(db, platform.id, key, value, ctx.user.id);
  await logActivity(db, userActor(ctx.user), {
    action: `settings.${key}`,
    summary: `Updated ${key} settings`,
    before: before as Record<string, unknown>,
    after: value as Record<string, unknown>,
  });
  refresh();
}

const minorOrNull = (v?: string) =>
  v ? fromMajor(v.replace(/[^\d.]/g, "") || "0").amountMinor : null;

export async function saveCompanyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(
      z.object({
        legalName: z.string().trim().min(2).max(160),
        tradingName: z.string().trim().min(2).max(120),
        email: z.email(),
        phone: z.string().trim().max(40),
        streetAddress: optionalText(160),
        locality: z.string().trim().max(80),
        postalCode: optionalText(12),
        region: z.string().trim().max(80),
        country: z.string().trim().max(80),
        registrationNumber: optionalText(40),
        vatNumber: optionalText(40),
        linkedinUrl: optionalText(300),
        instagramUrl: optionalText(300),
        facebookUrl: optionalText(300),
        detailsVerified: checkbox,
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    await save("company", parsed.data);
    return { ok: true, message: "Company details saved." };
  }, fd);
}

export async function saveBillingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const db = await getDb();
    const current = await getPlatformSetting(db, "billing");
    const parsed = parseForm(
      z.object({
        defaultCurrency: z.string().length(3),
        vatRegistered: checkbox,
        taxRatePercent: z.coerce.number().min(0).max(50),
        paymentTermsDays: z.coerce.number().int().min(0).max(90),
        pauseAfterOverdueDays: z.coerce.number().int().min(0).max(120),
        reminderDaysAfterDue: z.string().max(40),
        invoicePrefix: z.string().trim().min(1).max(8),
        proposalPrefix: z.string().trim().min(1).max(8),
        standardTermMonths: z.coerce.number().int().min(1).max(36),
        annualDiscountPercent: z.coerce.number().int().min(0).max(30),
        showPricesPublicly: checkbox,
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.vatRegistered && d.taxRatePercent === 0)
      return {
        ok: false,
        fieldErrors: { taxRatePercent: ["Enter the VAT rate (15% in South Africa)."] },
      };
    await save(
      "billing",
      {
        ...current,
        ...d,
        taxRatePercent: d.vatRegistered ? d.taxRatePercent : 0,
        reminderDaysAfterDue: d.reminderDaysAfterDue
          .split(/[,\s]+/)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0)
          .slice(0, 5),
      },
      "billing.manage",
    );
    return { ok: true, message: "Billing settings saved. They apply to new invoices." };
  }, fd);
}

export async function saveBookingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const db = await getDb();
    const current = await getPlatformSetting(db, "booking");
    const n = (k: string) => Number(fd.get(k));
    const next = {
      ...current,
      workingDays: fd.getAll("workingDays").map(Number),
      discoveryDays: fd.getAll("discoveryDays").map(Number),
      minNoticeBusinessDays: Math.max(0, Math.min(20, n("minNoticeBusinessDays") || 0)),
      maxBookingsPerDay: Math.max(0, Math.min(20, n("maxBookingsPerDay") || 0)),
      startHour: n("startHour"),
      endHour: n("endHour"),
      bufferMinutes: n("bufferMinutes"),
      minNoticeHours: n("minNoticeHours"),
      horizonDays: n("horizonDays"),
      durations: {
        ...current.durations,
        discovery: n("duration.discovery") || current.durations.discovery,
        client: n("duration.client") || current.durations.client,
      },
    };
    if (next.endHour <= next.startHour)
      return { ok: false, message: "The day must end after it starts." };
    if (!next.discoveryDays.length)
      return { ok: false, message: "Choose at least one day for discovery calls." };
    await save("booking", next);
    return { ok: true, message: "Availability saved." };
  }, fd);
}

export async function saveAiAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(
      z.object({
        monthlyBudgetUsd: z.coerce.number().min(0).max(100_000),
        perClientMonthlyBudgetUsd: z.coerce.number().min(0).max(10_000),
        maxStepsPerRun: z.coerce.number().int().min(1).max(50),
        approvalThresholdUsd: z.coerce.number().min(0).max(1000),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    await save("ai", parsed.data);
    return { ok: true, message: "AI limits saved." };
  }, fd);
}

/** Approval matrix: overrides per action type. Hard-locked actions are enforced in the engine regardless. */
export async function saveAutomationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const db = await getDb();
    const current = await getPlatformSetting(db, "automation");
    const overrides: Record<string, (typeof APPROVAL_LEVELS)[number]> = {};
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("level.") || typeof v !== "string" || v === "default") continue;
      overrides[k.slice(6)] = z.enum(APPROVAL_LEVELS).parse(v);
    }
    await save("automation", {
      ...current,
      approvalOverrides: overrides,
      monthlyCycleDay: Math.min(28, Math.max(1, Number(fd.get("monthlyCycleDay")) || 1)),
      autoGenerateBriefings: fd.get("autoGenerateBriefings") === "on",
    });
    return { ok: true, message: "Approval rules saved." };
  }, fd);
}

export async function saveEmergencyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const db = await getDb();
    const current = await getPlatformSetting(db, "emergency");
    await save(
      "emergency",
      {
        ...current,
        pauseAllAutomation: fd.get("pauseAllAutomation") === "on",
        pauseOutboundEmail: fd.get("pauseOutboundEmail") === "on",
        pausePayments: fd.get("pausePayments") === "on",
      },
      "emergency.controls",
    );
    return { ok: true, message: "Emergency controls updated." };
  }, fd);
}

export async function saveTargetsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const s = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
    await save("targets", {
      targetMonthlyRevenueMinor: minorOrNull(s("targetMonthlyRevenue")),
      targetMrrMinor: minorOrNull(s("targetMrr")),
      monthlyOperatingCostsMinor: minorOrNull(s("monthlyOperatingCosts")),
      desiredMarginPercent: s("desiredMarginPercent") ? Number(s("desiredMarginPercent")) : null,
      minimumMonthlyValueMinor: minorOrNull(s("minimumMonthlyValue")),
      targetAverageClientValueMinor: minorOrNull(s("targetAverageClientValue")),
      targetNewClientsPerMonth: s("targetNewClientsPerMonth")
        ? Math.round(Number(s("targetNewClientsPerMonth")))
        : null,
      clientCapacity: s("clientCapacity") ? Math.round(Number(s("clientCapacity"))) : null,
    });
    return { ok: true, message: "Targets saved." };
  }, fd);
}

export async function inviteStaffAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("users.manage");
    const parsed = parseForm(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.email(),
        role: z.enum(STAFF_ROLES),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    if (parsed.data.role === "founder" && ctx.role !== "founder")
      throw new AppError("FORBIDDEN", { userMessage: "Only a founder can add another founder." });
    const db = await getDb();
    const { setupUrl } = await inviteClientUser(db, {
      organisationId: ctx.platformOrganisationId,
      ...parsed.data,
      invitedById: ctx.user.id,
    });
    await sendEmail(db, {
      to: { email: parsed.data.email, name: parsed.data.name },
      template: "invitation",
      category: "transactional",
      email: emailTemplates.invitation({
        name: parsed.data.name,
        inviter: ctx.user.name,
        organisation: "Mea Creo",
        url: setupUrl ?? absoluteUrl("/login"),
      }),
    });
    await logActivity(db, userActor(ctx.user), {
      action: "user.invited",
      summary: `Invited ${parsed.data.email} as ${parsed.data.role}`,
    });
    refresh();
    return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
  }, fd);
}

export async function updateStaffAction(userId: string, fd: FormData): Promise<void> {
  const ctx = await requireStaff("users.manage");
  if (userId === ctx.user.id)
    throw new AppError("VALIDATION", { userMessage: "You can't change your own access." });
  const db = await getDb();
  const op = String(fd.get("op"));
  if (op === "disable" || op === "enable") {
    await db
      .update(users)
      .set({ disabledAt: op === "disable" ? new Date() : null })
      .where(eq(users.id, userId));
  } else {
    const role = z.enum(STAFF_ROLES).parse(fd.get("role"));
    if (role === "founder" && ctx.role !== "founder") throw new AppError("FORBIDDEN");
    await db
      .update(memberships)
      .set({ role })
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organisationId, ctx.platformOrganisationId),
        ),
      );
  }
  await logActivity(db, userActor(ctx.user), {
    action: `user.${op}`,
    summary: `${op} for user ${userId}`,
    entityType: "user",
    entityId: userId,
  });
  refresh();
}

export async function createApiKeyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("integrations.manage");
    const name = String(fd.get("name") ?? "").trim();
    if (name.length < 2)
      return { ok: false, fieldErrors: { name: ["Name the key after what will use it."] } };
    const scopes = fd
      .getAll("scopes")
      .map(String)
      .filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
    if (!scopes.length) return { ok: false, message: "Choose at least one permission." };
    const db = await getDb();
    const { key } = await createApiKey(db, { name, scopes, createdById: ctx.user.id });
    await logActivity(db, userActor(ctx.user), {
      action: "api_key.created",
      summary: `Created API key "${name}" (${scopes.join(", ")})`,
    });
    refresh();
    return { ok: true, message: `Copy this key now. It won't be shown again: ${key}` };
  }, fd);
}

export async function revokeApiKeyAction(id: string): Promise<void> {
  const ctx = await requireStaff("integrations.manage");
  const db = await getDb();
  await revokeApiKey(db, id);
  await logActivity(db, userActor(ctx.user), {
    action: "api_key.revoked",
    summary: `Revoked API key ${id}`,
  });
  refresh();
}

/** Bank details: founder only, stored encrypted, never logged. */
export async function saveBankDetailsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("billing.manage");
    if (ctx.role !== "founder")
      throw new AppError("FORBIDDEN", {
        userMessage: "Only a founder can change banking details.",
      });
    const parsed = parseForm(bankDetailsSchema, fd);
    if (!parsed.success)
      return { ...parsed.state, values: { ...parsed.state?.values, accountNumber: "" } };
    const db = await getDb();
    await setBankDetails(db, parsed.data, ctx.user.id);
    // The audit trail records that details changed, never the details themselves.
    await logActivity(db, userActor(ctx.user), {
      action: "banking.updated",
      summary: `${ctx.user.name} updated the banking details (account ${maskAccountNumber(parsed.data.accountNumber)})`,
    });
    refresh();
    return { ok: true, message: "Banking details saved (encrypted)." };
  }, fd);
}

/** Founder confirms which legal pages were reviewed. Never set on someone's behalf. */
export async function saveLegalReviewAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("settings.manage");
    if (ctx.role !== "founder")
      throw new AppError("FORBIDDEN", {
        userMessage: "Only the founder can confirm legal review.",
      });
    await save("legal", {
      reviewed: {
        popia: fd.get("popia") === "on",
        privacy: fd.get("privacy") === "on",
        terms: fd.get("terms") === "on",
        cookies: fd.get("cookies") === "on",
      },
    });
    return { ok: true, message: "Saved. Pages you ticked no longer show the draft notice." };
  }, fd);
}

const lines = (v: FormDataEntryValue | null) =>
  [
    ...new Set(
      String(v ?? "")
        .split(/\n|,/)
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 80);

/** Ideal-client rules used to qualify prospects (Settings → Prospecting). */
export async function saveQualificationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const value = {
      targetIndustries: lines(fd.get("targetIndustries")),
      poorFitSignals: lines(fd.get("poorFitSignals")),
      idealEmployeeRanges: lines(fd.get("idealEmployeeRanges")),
      decisionMakerRoles: lines(fd.get("decisionMakerRoles")),
    };
    if (!value.targetIndustries.length)
      throw new AppError("VALIDATION", { userMessage: "Add at least one target industry." });
    await save("qualification", value);
    return { ok: true, message: "Qualification rules saved. New scores use them straight away." };
  }, fd);
}

/** Outreach safety limits (Settings → Prospecting). */
export async function saveOutreachAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(
      z.object({
        maxPerDay: z.coerce
          .number()
          .int()
          .min(1, "At least 1.")
          .max(50, "Keep it to 50 or fewer a day: outreach must stay personal."),
        senderName: z.string().trim().min(2, "Add the sender's name.").max(120),
        senderTitle: z.string().trim().max(120),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    await save("outreach", parsed.data);
    return { ok: true, message: "Outreach limits saved." };
  }, fd);
}

/**
 * QA checklist (Settings → Quality). One check per line; an optional "[content, website]"
 * suffix limits it to those deliverable types.
 */
export async function saveQaChecklistAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const kinds = new Set<string>(DELIVERABLE_KINDS);
    const checks = String(fd.get("checks") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 40)
      .map((line) => {
        const m = line.match(/^(.*?)\s*\[([^\]]*)\]\s*$/);
        const label = (m ? m[1] : line).trim().slice(0, 160);
        const listed = m
          ? m[2]
              .split(",")
              .map((k) => k.trim().toLowerCase())
              .filter(Boolean)
          : [];
        const unknown = listed.filter((k) => !kinds.has(k));
        if (unknown.length)
          throw new AppError("VALIDATION", {
            userMessage: `Unknown type "${unknown[0]}". Use: ${DELIVERABLE_KINDS.join(", ")}.`,
          });
        return {
          key: label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40),
          label,
          kinds: listed as (typeof DELIVERABLE_KINDS)[number][],
        };
      });
    if (!checks.length)
      throw new AppError("VALIDATION", { userMessage: "Keep at least one check." });
    await save("qa", { checks });
    return { ok: true, message: "Checklist saved. New deliverables use it." };
  }, fd);
}

export async function disconnectGoogleAction(): Promise<void> {
  const ctx = await requireStaff("settings.manage");
  await disconnectGoogle(await getDb(), userActor(ctx.user));
  refresh();
}
