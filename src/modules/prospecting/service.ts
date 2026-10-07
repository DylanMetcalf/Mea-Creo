import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import {
  CLIENT_PROSPECT_STATUSES,
  clientProspects,
  clients,
  type ClientProspectStatus,
  type ProspectCriteria,
  prospectProgrammes,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { type Actor, logActivity } from "@/modules/activity/log";
import { notifyClient } from "@/modules/notifications/service";

/**
 * "Fresh prospects" (a paid client service): every week Mea Creo researches new companies
 * that match the client's criteria, reviews them, then releases the batch to the portal.
 *
 * - Off by default for every client, and never available to Mea Creo's own workspace.
 * - Every prospect records why it fits and where the information came from.
 * - No data provider is wired in: prospects are researched by the team and added or
 *   imported here, so nothing is presented as automated that isn't.
 */

const TZ = "Africa/Johannesburg";
export const QUOTA_MIN = 5;
export const QUOTA_MAX = 30;

/** Monday (YYYY-MM-DD) of the week containing `date`, in South African time. */
export function weekOf(date = new Date()): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const day = (local.getDay() + 6) % 7; // Monday = 0
  local.setDate(local.getDate() - day);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const list = (v: unknown) =>
  (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/\n|,/))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

export const programmeSchema = z.object({
  status: z.enum(["active", "paused"]),
  weeklyQuota: z.coerce
    .number()
    .int()
    .min(QUOTA_MIN, `At least ${QUOTA_MIN} a week.`)
    .max(QUOTA_MAX, `At most ${QUOTA_MAX} a week: quality over volume.`),
  industries: z.preprocess(list, z.array(z.string().max(80))),
  locations: z.preprocess(list, z.array(z.string().max(80))),
  roles: z.preprocess(list, z.array(z.string().max(80))),
  companySizes: z.preprocess(list, z.array(z.string().max(40))),
  notes: z.string().trim().max(2000).default(""),
});

async function assertEligible(db: DbOrTx, organisationId: string) {
  const [client] = await db
    .select({ isInternal: clients.isInternal })
    .from(clients)
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!client) throw new AppError("NOT_FOUND");
  if (client.isInternal)
    throw new AppError("VALIDATION", {
      userMessage: "Fresh prospects is a client service. Mea Creo's own pipeline lives in Leads.",
    });
}

export async function getProgramme(db: DbOrTx, organisationId: string) {
  const [row] = await db
    .select()
    .from(prospectProgrammes)
    .where(eq(prospectProgrammes.organisationId, organisationId))
    .limit(1);
  return row ?? null;
}

export async function saveProgramme(
  db: DbOrTx,
  organisationId: string,
  input: z.infer<typeof programmeSchema>,
  actor: Actor,
): Promise<void> {
  await assertEligible(db, organisationId);
  const criteria: ProspectCriteria = {
    industries: input.industries,
    locations: input.locations,
    roles: input.roles,
    companySizes: input.companySizes,
    notes: input.notes,
  };
  const existing = await getProgramme(db, organisationId);
  if (existing)
    await db
      .update(prospectProgrammes)
      .set({ status: input.status, weeklyQuota: input.weeklyQuota, criteria })
      .where(eq(prospectProgrammes.id, existing.id));
  else
    await db
      .insert(prospectProgrammes)
      .values({ organisationId, status: input.status, weeklyQuota: input.weeklyQuota, criteria });
  await logActivity(db, actor, {
    organisationId,
    action: existing ? "prospects.programme_updated" : "prospects.programme_started",
    summary: `Fresh prospects ${input.status === "active" ? "active" : "paused"}: ${input.weeklyQuota} a week`,
  });
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const prospectSchema = z.object({
  company: z.string().trim().min(2, "Add the company name.").max(160),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null)),
  industry: optional(120),
  location: optional(120),
  contactName: optional(120),
  contactRole: optional(120),
  email: z
    .union([z.email("That email doesn't look right."), z.literal("")])
    .optional()
    .transform((v) => v?.toLowerCase() || null),
  phone: optional(40),
  linkedinUrl: optional(300),
  reason: z.string().trim().min(10, "Say why this company fits (a sentence).").max(600),
  source: z.string().trim().min(3, "Say where the information came from.").max(300),
});
export type ProspectInput = z.infer<typeof prospectSchema>;

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.]/g, "");

/** Adds a prospect to this week's batch. Companies already delivered to the client are refused. */
export async function addProspect(
  db: DbOrTx,
  organisationId: string,
  input: ProspectInput,
  actor: Actor & { userId?: string },
  now = new Date(),
): Promise<{ id: string } | { duplicate: true }> {
  await assertEligible(db, organisationId);
  const existing = await db
    .select({ company: clientProspects.company, website: clientProspects.website })
    .from(clientProspects)
    .where(eq(clientProspects.organisationId, organisationId));
  const dupe = existing.some(
    (e) =>
      norm(e.company) === norm(input.company) ||
      (input.website && e.website && norm(e.website) === norm(input.website)),
  );
  if (dupe) return { duplicate: true };
  const [row] = await db
    .insert(clientProspects)
    .values({ organisationId, weekOf: weekOf(now), ...input, createdById: actor.userId })
    .returning({ id: clientProspects.id });
  return { id: row.id };
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof ProspectInput> = {
  company: "company",
  "company name": "company",
  website: "website",
  url: "website",
  industry: "industry",
  location: "location",
  city: "location",
  contact: "contactName",
  "contact name": "contactName",
  name: "contactName",
  role: "contactRole",
  title: "contactRole",
  "job title": "contactRole",
  email: "email",
  phone: "phone",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  reason: "reason",
  "why a fit": "reason",
  source: "source",
};

/** Imports a CSV batch. Rows that fail validation or duplicate earlier deliveries are reported. */
export async function importProspectsCsv(
  db: DbOrTx,
  organisationId: string,
  csv: string,
  actor: Actor & { userId?: string },
): Promise<{ added: number; skipped: { row: number; reason: string }[] }> {
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new AppError("VALIDATION", { userMessage: "The file is empty." });
  const keys = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!keys.includes("company") || !keys.includes("reason") || !keys.includes("source"))
    throw new AppError("VALIDATION", {
      userMessage: "The CSV needs at least company, reason and source columns.",
    });
  if (rows.length > 200)
    throw new AppError("VALIDATION", { userMessage: "Import up to 200 rows at a time." });
  let added = 0;
  const skipped: { row: number; reason: string }[] = [];
  for (const [index, cells] of rows.entries()) {
    const raw: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k) raw[k] = cells[i]?.trim() ?? "";
    });
    const parsed = prospectSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push({ row: index + 2, reason: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }
    const result = await addProspect(db, organisationId, parsed.data, actor);
    if ("duplicate" in result) skipped.push({ row: index + 2, reason: "Already delivered" });
    else added++;
  }
  return { added, skipped };
}

export async function removeProspect(db: DbOrTx, organisationId: string, id: string) {
  await db
    .delete(clientProspects)
    .where(
      and(
        eq(clientProspects.id, id),
        eq(clientProspects.organisationId, organisationId),
        isNull(clientProspects.releasedAt),
      ),
    );
}

/** Releases every reviewed-but-unreleased prospect to the client's portal. */
export async function releaseProspects(
  db: DbOrTx,
  organisationId: string,
  actor: Actor,
): Promise<number> {
  const released = await db
    .update(clientProspects)
    .set({ releasedAt: new Date() })
    .where(
      and(eq(clientProspects.organisationId, organisationId), isNull(clientProspects.releasedAt)),
    )
    .returning({ id: clientProspects.id });
  if (!released.length) return 0;
  const n = released.length;
  await db.insert(timelineEntries).values({
    organisationId,
    kind: "opportunity",
    title: `${n} fresh prospect${n === 1 ? "" : "s"} delivered`,
    description: "Researched against your criteria. See Prospects in your portal.",
    visibility: "client",
  });
  await notifyClient(db, organisationId, {
    kind: "prospects.delivered",
    title: `${n} fresh prospect${n === 1 ? "" : "s"} ready`,
    body: "This week's prospects are in your portal, each with why they fit.",
    link: "/portal/prospects",
  });
  await logActivity(db, actor, {
    organisationId,
    action: "prospects.released",
    summary: `Released ${n} prospect${n === 1 ? "" : "s"} to the client`,
  });
  return n;
}

export async function listProspects(
  db: DbOrTx,
  organisationId: string,
  opts: { releasedOnly?: boolean } = {},
) {
  return db
    .select()
    .from(clientProspects)
    .where(
      and(
        eq(clientProspects.organisationId, organisationId),
        opts.releasedOnly ? sql`${clientProspects.releasedAt} is not null` : undefined,
      ),
    )
    .orderBy(desc(clientProspects.weekOf), asc(clientProspects.company));
}

export const prospectStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(CLIENT_PROSPECT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

/** The client updates a released prospect's status (scoped to their organisation). */
export async function setProspectStatus(
  db: DbOrTx,
  organisationId: string,
  id: string,
  status: ClientProspectStatus,
  note?: string,
) {
  const updated = await db
    .update(clientProspects)
    .set({ status, ...(note !== undefined ? { clientNote: note || null } : {}) })
    .where(
      and(
        eq(clientProspects.id, id),
        eq(clientProspects.organisationId, organisationId),
        sql`${clientProspects.releasedAt} is not null`,
      ),
    )
    .returning({ id: clientProspects.id });
  if (!updated.length) throw new AppError("NOT_FOUND");
}

/** This week's progress against the quota. */
export async function weekProgress(db: DbOrTx, organisationId: string, now = new Date()) {
  const week = weekOf(now);
  const rows = await db
    .select({ releasedAt: clientProspects.releasedAt })
    .from(clientProspects)
    .where(
      and(eq(clientProspects.organisationId, organisationId), eq(clientProspects.weekOf, week)),
    );
  return {
    weekOf: week,
    added: rows.length,
    released: rows.filter((r) => r.releasedAt).length,
  };
}

/**
 * Daily: for every active programme, make sure this week has a research task for the team.
 * Idempotent per client and week.
 */
export async function ensureProspectTasks(db: DbOrTx, now = new Date()): Promise<number> {
  const week = weekOf(now);
  const programmes = await db
    .select({
      organisationId: prospectProgrammes.organisationId,
      quota: prospectProgrammes.weeklyQuota,
      name: clients.name,
      managerId: clients.accountManagerId,
    })
    .from(prospectProgrammes)
    .innerJoin(clients, eq(clients.organisationId, prospectProgrammes.organisationId))
    .where(and(eq(prospectProgrammes.status, "active"), eq(clients.isInternal, false)));
  let created = 0;
  for (const p of programmes) {
    const ref = `prospects:${week}`;
    const [exists] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.organisationId, p.organisationId), eq(tasks.sourceRef, ref)))
      .limit(1);
    if (exists) continue;
    const friday = new Date(`${week}T15:00:00+02:00`);
    friday.setDate(friday.getDate() + 4);
    await db.insert(tasks).values({
      organisationId: p.organisationId,
      title: `Research and release ${p.quota} fresh prospects for ${p.name}`,
      status: "ready",
      source: "recurring",
      sourceRef: ref,
      visibility: "internal",
      assigneeId: p.managerId,
      dueAt: friday,
    });
    created++;
  }
  return created;
}
