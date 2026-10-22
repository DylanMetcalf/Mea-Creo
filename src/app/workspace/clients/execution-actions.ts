"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { FIX_STATUSES } from "@/db/schema";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import type { Permission } from "@/modules/auth/permissions";
import {
  editDeliverable,
  FIX_STATUS_LABELS,
  generateFixes,
  getFix,
  transitionFix,
  verifyFix,
} from "@/modules/execution/service";

async function staffFor(organisationId: string, permission: Permission) {
  const ctx = await requireStaff(permission);
  await assertStaffClientAccess(ctx, organisationId);
  return ctx;
}

export async function generateFixesAction(
  organisationId: string,
  _prev: ActionState,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await staffFor(organisationId, "audits.run");
    const r = await generateFixes(await getDb(), organisationId, {
      ...userActor(ctx.user),
      userId: ctx.user.id,
    });
    refresh();
    const parts = [
      `Read ${r.pagesRead} page(s): ${r.created} new fix(es), ${r.refreshed} draft(s) refreshed, ${r.unchanged} already in progress left as they are.`,
    ];
    if (r.unreachable.length) parts.push(`${r.unreachable.length} page(s) couldn't be read.`);
    if (r.needsInfo.length) parts.push(`Needs information: ${r.needsInfo.join(" ")}`);
    return { ok: true, message: parts.join(" ") };
  });
}

const transitionSchema = z.object({
  organisationId: z.uuid(),
  fixId: z.uuid(),
  to: z.enum(FIX_STATUSES),
  note: optionalText(1000),
});

export async function transitionFixAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = parseForm(transitionSchema, formData);
    if (!parsed.success) return parsed.state;
    const { organisationId, fixId, to, note } = parsed.data;
    // Approval is a decision; everything else is delivery work.
    const ctx = await staffFor(
      organisationId,
      to === "approved" ? "approvals.decide" : "content.write",
    );
    await transitionFix(
      await getDb(),
      organisationId,
      fixId,
      to,
      { ...userActor(ctx.user), userId: ctx.user.id },
      note,
    );
    refresh();
    return { ok: true, message: `Moved to ${FIX_STATUS_LABELS[to].toLowerCase()}.` };
  }, formData);
}

export async function editFixAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = String(formData.get("organisationId") ?? "");
    const fixId = String(formData.get("fixId") ?? "");
    const ctx = await staffFor(organisationId, "content.write");
    const db = await getDb();
    const fix = await getFix(db, organisationId, fixId);
    const values = fix.deliverable.parts.map((_, i) => String(formData.get(`part${i}`) ?? ""));
    await editDeliverable(db, organisationId, fixId, values, userActor(ctx.user));
    refresh();
    return { ok: true, message: "Saved." };
  }, formData);
}

export async function verifyFixAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = String(formData.get("organisationId") ?? "");
    const fixId = String(formData.get("fixId") ?? "");
    const ctx = await staffFor(organisationId, "content.write");
    const r = await verifyFix(await getDb(), organisationId, fixId, userActor(ctx.user));
    refresh();
    return r.passed
      ? { ok: true, message: `Verified on the live site. ${r.observed}` }
      : { ok: false, message: `Not live yet. ${r.observed}` };
  }, formData);
}
