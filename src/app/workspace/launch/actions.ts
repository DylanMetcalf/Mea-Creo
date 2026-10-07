"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { AppError } from "@/lib/errors";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { isUnlocked, launchChecklist, MANUAL_ITEMS } from "@/modules/launch/checklist";
import {
  getPlatformOrganisation,
  getPlatformSetting,
  setSetting,
} from "@/modules/settings/service";

export async function toggleLaunchItemAction(key: string, done: boolean): Promise<void> {
  const ctx = await requireStaff("settings.manage");
  const item = MANUAL_ITEMS[key];
  if (!item) throw new AppError("NOT_FOUND");
  const db = await getDb();
  if (done) {
    const groups = await launchChecklist(db);
    const group = groups.find((g) => g.key === item.group);
    if (group && !isUnlocked(group, groups))
      throw new AppError("CONFLICT", {
        userMessage: "Finish everything above first: the current website stays live until then.",
      });
  }
  const launch = await getPlatformSetting(db, "launch");
  const next = { ...launch.done };
  if (done) next[key] = { by: ctx.user.name, at: new Date().toISOString() };
  else delete next[key];
  const platform = await getPlatformOrganisation(db);
  await setSetting(db, platform.id, "launch", { done: next }, ctx.user.id);
  await logActivity(db, userActor(ctx.user), {
    action: "launch.item",
    summary: `${done ? "Ticked" : "Unticked"} launch item: ${item.label}`,
  });
  refresh();
}
