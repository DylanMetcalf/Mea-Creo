/**
 * Creates (or re-invites) a founder account on the live database and prints a one-time
 * link to set the password. No password ever passes through the shell or logs.
 *
 *   pnpm admin:create --email dylan@meacreo.co.za --name "Dylan Metcalf"
 */
import { and, eq } from "drizzle-orm";
import { createDb, runMigrations, schema } from "@/db";
import { seedBase } from "@/db/seed/base";
import { absoluteUrl } from "@/lib/urls";
import { createAuthToken } from "@/modules/auth/tokens";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const email = arg("email")?.toLowerCase();
const name = arg("name");
if (!email || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: pnpm admin:create --email you@example.com --name "Your Name"');
  process.exit(1);
}

const { memberships, users } = schema;
const handle = createDb();
await runMigrations(handle);
const db = handle.db;
const { platformId } = await seedBase(db);
let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!user) [user] = await db.insert(users).values({ email, name }).returning();
const [existing] = await db
  .select()
  .from(memberships)
  .where(and(eq(memberships.userId, user.id), eq(memberships.organisationId, platformId)));
if (!existing)
  await db
    .insert(memberships)
    .values({ userId: user.id, organisationId: platformId, role: "founder" });
else if (existing.role !== "founder")
  await db.update(memberships).set({ role: "founder" }).where(eq(memberships.id, existing.id));
const token = await createAuthToken(db, {
  purpose: "password_reset",
  email,
  userId: user.id,
  ttlHours: 24,
});
console.log(`Founder account ready for ${email}.`);
console.log(`Set the password within 24 hours: ${absoluteUrl(`/reset-password/${token}`)}`);
await handle.close();
