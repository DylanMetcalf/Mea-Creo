"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  APPROVAL_LEVELS,
  AUTOMATION_LEVELS,
  BILLING_TYPES,
  packageItems,
  packages,
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  type ServicePrices,
  services,
} from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { fromMajor, SUPPORTED_CURRENCIES } from "@/lib/money";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import {
  getPlatformOrganisation,
  getPlatformSetting,
  setSetting,
} from "@/modules/settings/service";

const lines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(4000),
  category: z.enum(SERVICE_CATEGORIES),
  billingType: z.enum(BILLING_TYPES),
  automationLevel: z.enum(AUTOMATION_LEVELS),
  defaultApprovalLevel: z.enum(APPROVAL_LEVELS),
  status: z.enum(SERVICE_STATUSES),
  humanInvolvement: z.string().trim().max(500),
  includedActivities: z.string().max(4000),
  deliverables: z.string().max(4000),
  limits: z.string().max(2000),
  kpis: z.string().max(2000),
  requiredInputs: z.string().max(2000),
  showOnWebsite: z.string().optional(),
  selfService: z.string().optional(),
  requiresStrategy: z.string().optional(),
});

const PRICE_FIELDS = ["setupMinor", "monthlyMinor", "oneOffMinor", "unitMinor"] as const;

export async function saveServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("services.manage");
    const parsed = parseForm(serviceSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const db = await getDb();
    const id = String(formData.get("serviceId"));
    const [before] = await db.select().from(services).where(eq(services.id, id));
    if (!before) throw new AppError("NOT_FOUND");
    const prices: ServicePrices = {};
    for (const c of SUPPORTED_CURRENCIES) {
      const entry: Record<string, number> = {};
      for (const f of PRICE_FIELDS) {
        const raw = String(formData.get(`price.${c}.${f}`) ?? "").replace(/[^\d.]/g, "");
        if (raw) entry[f] = fromMajor(raw, c).amountMinor;
      }
      if (Object.keys(entry).length) prices[c] = entry;
    }
    await db
      .update(services)
      .set({
        name: d.name,
        summary: d.summary,
        description: d.description,
        category: d.category,
        billingType: d.billingType,
        automationLevel: d.automationLevel,
        defaultApprovalLevel: d.defaultApprovalLevel,
        status: d.status,
        humanInvolvement: d.humanInvolvement,
        includedActivities: lines(d.includedActivities),
        deliverables: lines(d.deliverables),
        limits: lines(d.limits),
        kpis: lines(d.kpis),
        requiredInputs: lines(d.requiredInputs),
        showOnWebsite: d.showOnWebsite === "on",
        selfService: d.selfService === "on",
        requiresStrategy: d.requiresStrategy === "on",
        prices,
      })
      .where(eq(services.id, id));
    await logActivity(db, userActor(ctx.user), {
      action: "service.updated",
      summary: `Updated service ${d.name}`,
      entityType: "service",
      entityId: id,
      before: { prices: before.prices },
      after: { prices },
    });
    refresh();
    return { ok: true, message: "Saved. Existing client plans keep their agreed prices." };
  }, formData);
}

/** The owner confirms the catalogue now holds real prices (removes demo warnings). */
export async function confirmPricesAction(): Promise<void> {
  const ctx = await requireStaff("services.manage");
  const db = await getDb();
  const billing = await getPlatformSetting(db, "billing");
  const platform = await getPlatformOrganisation(db);
  await setSetting(db, platform.id, "billing", { ...billing, pricesAreDemo: false }, ctx.user.id);
  await logActivity(db, userActor(ctx.user), {
    action: "pricing.confirmed",
    summary: "Confirmed catalogue prices are real",
  });
  refresh();
}

const packageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  contractMonths: z.coerce.number().int().min(1).max(36),
  discountPercent: z.coerce.number().int().min(0).max(50),
  terms: z.string().trim().max(4000).optional(),
  status: z.enum(SERVICE_STATUSES),
});

export async function savePackageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("services.manage");
    const parsed = parseForm(packageSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const id = String(formData.get("packageId"));
    const serviceIds = formData.getAll("serviceIds").map(String);
    await db.transaction(async (tx) => {
      await tx
        .update(packages)
        .set({ ...parsed.data, terms: parsed.data.terms || null })
        .where(eq(packages.id, id));
      await tx.delete(packageItems).where(eq(packageItems.packageId, id));
      if (serviceIds.length)
        await tx
          .insert(packageItems)
          .values(serviceIds.map((serviceId) => ({ packageId: id, serviceId })));
    });
    await logActivity(db, userActor(ctx.user), {
      action: "package.updated",
      summary: `Updated package ${parsed.data.name}`,
    });
    refresh();
    return { ok: true, message: "Package saved." };
  }, formData);
}
