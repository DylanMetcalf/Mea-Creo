import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { memberships, users } from "@/db/schema";
import { ROLE_LABELS, type Role } from "@/modules/auth/permissions";

/** Active staff of the platform organisation (for assignment pickers). */
export async function listStaff(db: DbOrTx, platformOrganisationId: string) {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organisationId, platformOrganisationId), isNull(users.disabledAt)))
    .orderBy(asc(users.name));
  return rows.map((r) => ({ ...r, roleLabel: ROLE_LABELS[r.role as Role] }));
}
