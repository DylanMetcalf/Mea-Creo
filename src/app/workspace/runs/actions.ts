"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { kickJobs } from "@/jobs/kick";
import { logActivity, userActor } from "@/modules/activity/log";
import { eq } from "drizzle-orm";
import { runs } from "@/db/schema";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { cancelRun } from "@/modules/runs/engine";
import {
  getPlatformSetting,
  setSetting,
  getPlatformOrganisation,
} from "@/modules/settings/service";

/** Pauses or resumes a single agent (emergency control). */
export async function toggleAgentAction(agentId: string): Promise<void> {
  const ctx = await requireStaff("emergency.controls");
  const id = z.string().min(2).max(40).parse(agentId);
  const db = await getDb();
  const emergency = await getPlatformSetting(db, "emergency");
  const paused = emergency.pausedAgents.includes(id);
  const next = {
    ...emergency,
    pausedAgents: paused
      ? emergency.pausedAgents.filter((a) => a !== id)
      : [...emergency.pausedAgents, id],
  };
  const platform = await getPlatformOrganisation(db);
  await setSetting(db, platform.id, "emergency", next, ctx.user.id);
  await logActivity(db, userActor(ctx.user), {
    action: paused ? "agent.resumed" : "agent.paused",
    summary: `${paused ? "Resumed" : "Paused"} the ${id} agent`,
  });
  refresh();
}

export async function processQueueAction(): Promise<void> {
  await requireStaff("runs.execute");
  kickJobs();
  refresh();
}

/** Stops a queued or running run. Work already finished stays recorded. */
export async function cancelRunAction(runId: string): Promise<void> {
  const ctx = await requireStaff("runs.execute");
  const db = await getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) return;
  await assertStaffClientAccess(ctx, run.organisationId);
  if (await cancelRun(db, runId, run.organisationId))
    await logActivity(db, userActor(ctx.user), {
      organisationId: run.organisationId,
      action: "run.cancelled",
      summary: "Cancelled a run",
      entityType: "run",
      entityId: runId,
    });
  refresh();
}
