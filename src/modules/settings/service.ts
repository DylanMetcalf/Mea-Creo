import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { organisations, settings } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { type Settings, type SettingsKey, settingsDefaults, settingsSchemas } from "./schema";

/** Reads a setting, merged over defaults so new fields never break old rows. */
export async function getSetting<K extends SettingsKey>(
  db: DbOrTx,
  organisationId: string,
  key: K,
): Promise<Settings<K>> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.organisationId, organisationId), eq(settings.key, key)))
    .limit(1);
  const merged = { ...settingsDefaults[key], ...((row?.value as object | undefined) ?? {}) };
  const parsed = settingsSchemas[key].safeParse(merged);
  return (parsed.success ? parsed.data : settingsDefaults[key]) as Settings<K>;
}

export async function setSetting<K extends SettingsKey>(
  db: DbOrTx,
  organisationId: string,
  key: K,
  value: Settings<K>,
  updatedById?: string,
): Promise<Settings<K>> {
  const parsed = settingsSchemas[key].safeParse(value);
  if (!parsed.success) {
    throw new AppError("VALIDATION", {
      message: `Invalid ${key} settings: ${parsed.error.message}`,
    });
  }
  await db
    .insert(settings)
    .values({ organisationId, key, value: parsed.data, updatedById })
    .onConflictDoUpdate({
      target: [settings.organisationId, settings.key],
      set: { value: parsed.data, updatedById, updatedAt: new Date() },
    });
  return parsed.data as Settings<K>;
}

/** The Mea Creo organisation. There is exactly one. */
export async function getPlatformOrganisation(db: DbOrTx): Promise<{ id: string; name: string }> {
  const [org] = await db
    .select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .where(eq(organisations.kind, "platform"))
    .limit(1);
  if (!org)
    throw new AppError("INTERNAL", { message: "Platform organisation missing: run the seed." });
  return org;
}

export async function getPlatformSetting<K extends SettingsKey>(
  db: DbOrTx,
  key: K,
): Promise<Settings<K>> {
  const org = await getPlatformOrganisation(db);
  return getSetting(db, org.id, key);
}
