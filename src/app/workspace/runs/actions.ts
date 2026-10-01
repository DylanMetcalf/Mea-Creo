"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { kickJobs } from "@/jobs/kick";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
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
