"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { createPortfolioLink, revokePortfolioLink } from "@/modules/portfolio/service";

const schema = z.object({
  label: z.string().trim().min(2, "Who is this link for?").max(120),
  message: z.string().trim().max(600).optional(),
  expires: z.enum(["7", "30", "90", "never"]),
});

export async function createPortfolioLinkAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(schema, fd);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const link = await createPortfolioLink(db, {
      label: parsed.data.label,
      message: parsed.data.message,
      categories: fd.getAll("categories").map(String),
      expiresInDays: parsed.data.expires === "never" ? null : Number(parsed.data.expires),
      userId: ctx.user.id,
    });
    await logActivity(db, userActor(ctx.user), {
      action: "portfolio.link_created",
      summary: `Created a portfolio link for ${link.label}`,
    });
    refresh();
    return { ok: true, message: `Link ready: ${absoluteUrl(`/portfolio/${link.token}`)}` };
  }, fd);
}

export async function revokePortfolioLinkAction(id: string): Promise<void> {
  const ctx = await requireStaff("leads.write");
  const db = await getDb();
  await revokePortfolioLink(db, id);
  await logActivity(db, userActor(ctx.user), {
    action: "portfolio.link_revoked",
    summary: "Revoked a portfolio link",
  });
  refresh();
}
