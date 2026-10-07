"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { QA_STAGES } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import {
  createDeliverable,
  deliverableSchema,
  getDeliverable,
  moveDeliverable,
  setCheck,
} from "@/modules/quality/service";

async function staffForDeliverable(id: string) {
  const ctx = await requireStaff("tasks.write");
  const d = await getDeliverable(await getDb(), id);
  if (!d) throw new AppError("NOT_FOUND");
  await assertStaffClientAccess(ctx, d.organisationId);
  return ctx;
}

export async function createDeliverableAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("tasks.write");
    const parsed = parseForm(deliverableSchema, fd);
    if (!parsed.success) return parsed.state;
    await assertStaffClientAccess(ctx, parsed.data.organisationId);
    id = await createDeliverable(await getDb(), parsed.data, {
      ...userActor(ctx.user),
      userId: ctx.user.id,
    });
    return { ok: true };
  }, fd);
  if (id) redirect(`/workspace/quality/${id}`);
  return state;
}

export async function toggleCheckAction(id: string, key: string, done: boolean): Promise<void> {
  const ctx = await staffForDeliverable(id);
  await setCheck(await getDb(), id, key, done, userActor(ctx.user));
  refresh();
}

export async function moveDeliverableAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = z
      .object({
        id: z.uuid(),
        to: z.enum(QA_STAGES),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(Object.fromEntries(fd));
    const ctx = await staffForDeliverable(input.id);
    await moveDeliverable(
      await getDb(),
      input.id,
      input.to,
      { ...userActor(ctx.user), userId: ctx.user.id },
      input.note,
    );
    refresh();
    return { ok: true, message: "Stage updated." };
  }, fd);
}
