import "server-only";
import { eq, or } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { clientAssignments, clients } from "@/db/schema";
import { AppError } from "@/lib/errors";
import {
  type ClientRole,
  isStaffRole,
  type Permission,
  permissionsFor,
  type StaffRole,
} from "./permissions";
import { SESSION_COOKIE, type ValidatedSession, validateSession } from "./sessions";

export interface StaffContext {
  kind: "staff";
  session: ValidatedSession;
  user: ValidatedSession["user"];
  role: StaffRole;
  platformOrganisationId: string;
  permissions: ReadonlySet<Permission>;
  can: (permission: Permission) => boolean;
}

export interface ClientContext {
  kind: "client";
  session: ValidatedSession;
  user: ValidatedSession["user"];
  role: ClientRole;
  organisationId: string;
  organisationName: string;
  /** All client organisations this user can switch between. */
  organisations: { id: string; name: string }[];
  permissions: ReadonlySet<Permission>;
  can: (permission: Permission) => boolean;
}

export type AuthContext = StaffContext | ClientContext;

export async function requestMeta(): Promise<{ ipAddress?: string; userAgent?: string }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/** The current session, validated once per request. */
export const getSession = cache(async (): Promise<ValidatedSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(await getDb(), token);
});

/** Resolves the signed-in user's context. Staff membership wins over client membership. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const staff = session.memberships.find(
    (m) => m.organisationKind === "platform" && isStaffRole(m.role),
  );
  if (staff) {
    const permissions = permissionsFor(staff.role);
    return {
      kind: "staff",
      session,
      user: session.user,
      role: staff.role as StaffRole,
      platformOrganisationId: staff.organisationId,
      permissions,
      can: (p) => permissions.has(p),
    };
  }

  const clientMemberships = session.memberships.filter(
    (m) => m.organisationKind === "client" && !isStaffRole(m.role),
  );
  if (clientMemberships.length === 0) return null;
  const active =
    clientMemberships.find((m) => m.organisationId === session.activeOrganisationId) ??
    clientMemberships[0];
  const permissions = permissionsFor(active.role);
  return {
    kind: "client",
    session,
    user: session.user,
    role: active.role as ClientRole,
    organisationId: active.organisationId,
    organisationName: active.organisationName,
    organisations: clientMemberships.map((m) => ({
      id: m.organisationId,
      name: m.organisationName,
    })),
    permissions,
    can: (p) => permissions.has(p),
  };
});

/** For pages and actions in /workspace. Redirects anonymous users; clients go to their portal. */
export async function requireStaff(permission?: Permission): Promise<StaffContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.kind !== "staff") redirect("/portal");
  if (permission && !ctx.can(permission)) forbidden();
  return ctx;
}

/** For pages and actions in /portal. The organisation always comes from the session, never the URL. */
export async function requireClient(permission?: Permission): Promise<ClientContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.kind !== "client") redirect("/workspace");
  if (permission && !ctx.can(permission)) forbidden();
  return ctx;
}

/**
 * Client organisations a staff member may see: every client with `clients.read.all`,
 * otherwise only clients they are assigned to (any responsibility) or account-manage.
 */
export const staffClientScope = cache(async (ctx: StaffContext): Promise<"all" | string[]> => {
  if (ctx.can("clients.read.all")) return "all";
  if (!ctx.can("clients.read.assigned")) return [];
  const db = await getDb();
  const [assigned, managed] = await Promise.all([
    db
      .select({ id: clientAssignments.organisationId })
      .from(clientAssignments)
      .where(eq(clientAssignments.userId, ctx.user.id)),
    db
      .select({ id: clients.organisationId })
      .from(clients)
      .where(or(eq(clients.accountManagerId, ctx.user.id))),
  ]);
  return [...new Set([...assigned, ...managed].map((r) => r.id))];
});

export async function assertStaffClientAccess(
  ctx: StaffContext,
  organisationId: string,
): Promise<void> {
  const scope = await staffClientScope(ctx);
  if (scope !== "all" && !scope.includes(organisationId)) {
    throw new AppError("FORBIDDEN", {
      message: `staff ${ctx.user.id} has no access to org ${organisationId}`,
    });
  }
}
