"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { TASK_PRIORITIES, TASK_STATUSES, tasks } from "@/db/schema";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { logActivity, userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { emitEvent } from "@/modules/notifications/service";

const taskSchema = z.object({
  organisationId: z.uuid("Choose a client."),
  title: z.string().trim().min(3, "Give the task a title.").max(200),
  description: optionalText(4000),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  status: z.enum(TASK_STATUSES).default("ready"),
  assigneeId: z.union([z.uuid(), z.literal("")]).optional(),
  dueAt: optionalText(20),
  visibility: z.enum(["internal", "client"]).default("internal"),
});

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("tasks.write");
    const parsed = parseForm(taskSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    await assertStaffClientAccess(ctx, d.organisationId);
    const db = await getDb();
    const [task] = await db
      .insert(tasks)
      .values({
        organisationId: d.organisationId,
        title: d.title,
        description: d.description,
        priority: d.priority,
        status: d.status,
        assigneeId: d.assigneeId || null,
        dueAt: d.dueAt ? new Date(`${d.dueAt}T17:00:00+02:00`) : null,
        visibility: d.visibility,
        createdById: ctx.user.id,
      })
      .returning({ id: tasks.id });
    await emitEvent(db, "task.created", d.organisationId, { taskId: task.id });
    refresh();
    return { ok: true, message: "Task added." };
  }, formData);
}

export async function setTaskStatusAction(taskId: string, formData: FormData): Promise<void> {
  const ctx = await requireStaff("tasks.write");
  const status = z.enum(TASK_STATUSES).parse(formData.get("status"));
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new AppError("NOT_FOUND");
  await assertStaffClientAccess(ctx, task.organisationId);
  const done = status === "complete";
  await db
    .update(tasks)
    .set({
      status,
      completedAt: done ? new Date() : null,
      completedById: done ? ctx.user.id : null,
    })
    .where(eq(tasks.id, taskId));
  if (done) {
    await emitEvent(db, "task.completed", task.organisationId, { taskId });
    await logActivity(db, userActor(ctx.user), {
      organisationId: task.organisationId,
      action: "task.completed",
      summary: `Completed "${task.title}"`,
      entityType: "task",
      entityId: taskId,
    });
  }
  refresh();
}

export async function completeTaskAction(taskId: string): Promise<void> {
  const fd = new FormData();
  fd.set("status", "complete");
  await setTaskStatusAction(taskId, fd);
}
