"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { memberships, users } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { absoluteUrl } from "@/lib/urls";
import { logActivity } from "@/modules/activity/log";
import { getSession, requestMeta } from "@/modules/auth/context";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/modules/auth/password";
import { clearRateLimit, hitRateLimit } from "@/modules/auth/rate-limit";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  SESSION_COOKIE,
  setActiveOrganisation,
} from "@/modules/auth/sessions";
import { consumeAuthToken, createAuthToken, findAuthToken } from "@/modules/auth/tokens";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";

async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

function safeNext(next: unknown): string | null {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null;
}

const loginSchema = z.object({
  email: z.email("Enter your email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string | null = null;
  const state = await runAction(async () => {
    const parsed = parseForm(loginSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const meta = await requestMeta();
    const email = parsed.data.email.toLowerCase();
    const limitKey = `login:${meta.ipAddress ?? "?"}:${email}`;
    const limit = await hitRateLimit(db, limitKey, 8, 15 * 60);
    if (limit.limited)
      return {
        ok: false,
        message: "Too many sign-in attempts. Please wait 15 minutes or reset your password.",
      };

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = user?.passwordHash
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;
    if (!user || !valid || user.disabledAt) {
      return {
        ok: false,
        message: "That email and password don't match. Check them and try again.",
        values: { email },
      };
    }
    await clearRateLimit(db, limitKey);
    const { token, expiresAt } = await createSession(db, user.id, meta);
    await setSessionCookie(token, expiresAt);
    await logActivity(
      db,
      { type: "user", id: user.id, label: user.name },
      { action: "auth.login", summary: `${user.name} signed in`, ipAddress: meta.ipAddress },
    );
    const [membership] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);
    const home = membership && !membership.role.startsWith("client_") ? "/workspace" : "/portal";
    destination = safeNext(parsed.data.next) ?? home;
  }, formData);
  if (destination) redirect(destination);
  return state;
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(z.object({ email: z.email("Enter your email address.") }), formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const meta = await requestMeta();
    const email = parsed.data.email.toLowerCase();
    const limit = await hitRateLimit(db, `reset:${meta.ipAddress ?? "?"}`, 5, 60 * 60);
    const generic: ActionState = {
      ok: true,
      message:
        "If an account exists for that email, we've sent a reset link. It expires in one hour.",
    };
    if (limit.limited) return generic;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user && !user.disabledAt) {
      const token = await createAuthToken(db, {
        purpose: "password_reset",
        email,
        userId: user.id,
        ttlHours: 1,
      });
      await sendEmail(db, {
        to: { email, name: user.name },
        template: "passwordReset",
        category: "transactional",
        email: emailTemplates.passwordReset({
          name: user.name,
          url: absoluteUrl(`/reset-password/${token}`),
        }),
      });
    }
    return generic;
  }, formData);
}

const newPasswordSchema = z
  .object({
    token: z.string().min(10),
    name: z.string().trim().max(120).optional(),
    password: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const weakness = validatePasswordStrength(v.password);
    if (weakness) ctx.addIssue({ code: "custom", path: ["password"], message: weakness });
    if (v.password !== v.confirm)
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "The passwords don't match." });
  });

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;
  const state = await runAction(async () => {
    const parsed = parseForm(newPasswordSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const row = await findAuthToken(db, parsed.data.token, "password_reset");
    if (!row?.userId)
      return {
        ok: false,
        message: "This reset link has expired or was already used. Request a new one.",
      };
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.password) })
      .where(eq(users.id, row.userId));
    await consumeAuthToken(db, row.id);
    await deleteUserSessions(db, row.userId);
    const { token, expiresAt } = await createSession(db, row.userId, await requestMeta());
    await setSessionCookie(token, expiresAt);
    destination = "/workspace";
  }, formData);
  if (destination) redirect(destination);
  return state;
}

export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;
  const state = await runAction(async () => {
    const parsed = parseForm(newPasswordSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const row = await findAuthToken(db, parsed.data.token, "invitation");
    if (!row)
      return {
        ok: false,
        message: "This invitation has expired or was already used. Ask for a new invitation.",
      };

    let [user] = await db.select().from(users).where(eq(users.email, row.email)).limit(1);
    if (!user)
      [user] = await db
        .insert(users)
        .values({ email: row.email, name: parsed.data.name || row.email })
        .returning();
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(parsed.data.password),
        emailVerifiedAt: new Date(),
        name: parsed.data.name || user.name,
      })
      .where(eq(users.id, user.id));
    if (row.organisationId && row.role) {
      const [existing] = await db
        .select()
        .from(memberships)
        .where(
          and(eq(memberships.userId, user.id), eq(memberships.organisationId, row.organisationId)),
        )
        .limit(1);
      if (!existing)
        await db
          .insert(memberships)
          .values({ userId: user.id, organisationId: row.organisationId, role: row.role });
    }
    await consumeAuthToken(db, row.id);
    const { token, expiresAt } = await createSession(db, user.id, await requestMeta());
    await setSessionCookie(token, expiresAt);
    await logActivity(
      db,
      { type: "user", id: user.id, label: user.name },
      {
        organisationId: row.organisationId,
        action: "auth.invite_accepted",
        summary: `${user.name} accepted an invitation`,
      },
    );
    destination = row.role?.startsWith("client_") ? "/portal" : "/workspace";
  }, formData);
  if (destination) redirect(destination);
  return state;
}

/** Client users with several organisations switch the active one. */
export async function switchOrganisationAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const target = String(formData.get("organisationId") ?? "");
  if (session && session.memberships.some((m) => m.organisationId === target)) {
    await setActiveOrganisation(await getDb(), session.sessionId, target);
  }
  redirect("/portal");
}
