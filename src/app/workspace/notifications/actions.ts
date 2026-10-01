"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { getAuthContext } from "@/modules/auth/context";
import { AppError } from "@/lib/errors";

/** Marks the signed-in user's notifications as read (staff or client). */
export async function markAllReadAction(): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED");
  await (
    await getDb()
  )
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
  refresh();
}
