import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { memberships, organisations, users } from "@/db/schema";
import { seedBase } from "@/db/seed/base";
import { safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { logActivity } from "@/modules/activity/log";
import { hashPassword, PASSWORD_MIN_LENGTH, validatePasswordStrength } from "./password";

/**
 * First-time setup without a terminal (/setup). It creates the founder account once:
 * - it only works while no founder exists, and is permanently closed afterwards;
 * - it needs SETUP_TOKEN, a code the owner sets on the host (never in code or chat);
 * - the password is chosen on the page and stored only as a scrypt hash.
 */

export const SETUP_TOKEN_MIN_LENGTH = 16;

export type SetupStatus = "open" | "not_configured" | "done";

export async function founderExists(db: Db): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
    .where(and(eq(organisations.kind, "platform"), eq(memberships.role, "founder")));
  return Number(row?.n ?? 0) > 0;
}

export async function setupStatus(db: Db, setupToken: string | undefined): Promise<SetupStatus> {
  if (await founderExists(db)) return "done";
  if (!setupToken || setupToken.length < SETUP_TOKEN_MIN_LENGTH) return "not_configured";
  return "open";
}

export const setupSchema = z
  .object({
    code: z.string().min(1, "Enter the setup code you added in your hosting settings."),
    name: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.email("Enter your email address.").transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The two passwords don't match.",
  });
export type SetupInput = z.infer<typeof setupSchema>;

/** Creates the founder. Throws if setup is closed, the code is wrong or the password is weak. */
export async function createFirstFounder(
  db: Db,
  input: SetupInput,
  setupToken: string | undefined,
): Promise<{ userId: string }> {
  if (!setupToken || setupToken.length < SETUP_TOKEN_MIN_LENGTH)
    throw new AppError("FORBIDDEN", { userMessage: "Setup isn't switched on." });
  if (!safeEqual(input.code.trim(), setupToken))
    throw new AppError("FORBIDDEN", { userMessage: "That setup code isn't right." });
  const weak = validatePasswordStrength(input.password);
  if (weak) throw new AppError("VALIDATION", { userMessage: weak });

  // Base business data (Mea Creo organisation, settings, catalogue). Idempotent.
  const { platformId } = await seedBase(db);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // One setup at a time: a second, simultaneous request waits, then finds the founder.
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);
    const [existing] = await tx
      .select({ n: count() })
      .from(memberships)
      .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
      .where(and(eq(organisations.kind, "platform"), eq(memberships.role, "founder")));
    if (Number(existing?.n ?? 0) > 0)
      throw new AppError("CONFLICT", { userMessage: "Setup has already been completed." });

    let [user] = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (user)
      await tx
        .update(users)
        .set({ name: input.name, passwordHash, emailVerifiedAt: new Date(), disabledAt: null })
        .where(eq(users.id, user.id));
    else
      [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
          emailVerifiedAt: new Date(),
        })
        .returning();
    await tx
      .insert(memberships)
      .values({ userId: user.id, organisationId: platformId, role: "founder" })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.organisationId],
        set: { role: "founder" },
      });
    await logActivity(
      tx,
      { type: "user", id: user.id, label: input.name },
      { action: "setup.founder_created", summary: `${input.name} completed first-time setup` },
    );
    return { userId: user.id };
  });
}
