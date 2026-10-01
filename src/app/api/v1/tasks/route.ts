import { asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { OPEN_TASK_STATUSES, tasks } from "@/db/schema";
import { requireApiKey } from "@/modules/api-keys/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "read:tasks");
  if ("error" in auth) return auth.error;
  const rows = await auth.db
    .select()
    .from(tasks)
    .where(inArray(tasks.status, OPEN_TASK_STATUSES))
    .orderBy(asc(tasks.dueAt))
    .limit(500);
  return NextResponse.json({
    tasks: rows.map((t) => ({
      id: t.id,
      organisationId: t.organisationId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      assigneeId: t.assigneeId,
      agent: t.agent,
    })),
  });
}
