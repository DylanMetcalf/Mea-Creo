import { and, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { domainEvents, meetings } from "@/db/schema";
import { logger } from "@/lib/logger";
import { runDailyBilling } from "@/modules/billing/service";
import { generateMeetingBriefing } from "@/modules/meetings/briefing";
import { emitEvent } from "@/modules/notifications/service";
import { upgradeOutdatedScores } from "@/modules/leads/scoring";
import { ensureProspectTasks } from "@/modules/prospecting/service";
import { getPlatformSetting } from "@/modules/settings/service";

/**
 * Once-a-day housekeeping, triggered by the worker. Every step is idempotent, so running
 * it twice (two workers, a restart) does no harm.
 */
export async function runDailyCycle(
  db: Db,
  now = new Date(),
): Promise<{
  billing: Awaited<ReturnType<typeof runDailyBilling>>;
  briefings: number;
  monthlyCycle: boolean;
}> {
  const billing = await runDailyBilling(db, now);

  // Briefings for calls in the next 36 hours that don't have one yet.
  const automation = await getPlatformSetting(db, "automation");
  let briefings = 0;
  if (automation.autoGenerateBriefings) {
    const upcoming = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(
        and(
          inArray(meetings.status, ["scheduled", "requested"]),
          gte(meetings.startsAt, now),
          lte(meetings.startsAt, new Date(now.getTime() + 36 * 3600_000)),
          isNull(meetings.briefing),
          or(isNotNull(meetings.leadId), isNotNull(meetings.organisationId)),
        ),
      );
    for (const m of upcoming) {
      try {
        if (await generateMeetingBriefing(db, m.id)) briefings++;
      } catch (error) {
        logger.warn({ err: String(error), meetingId: m.id }, "briefing failed");
      }
    }
  }

  // Fresh-prospects research tasks for this week (paid client service).
  await ensureProspectTasks(db, now);

  // Leads scored before the current qualification model.
  await upgradeOutdatedScores(db);

  // Monthly client cycle on the configured day (South African date), once per month.
  const saDay = Number(
    now.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric" }),
  );
  let monthlyCycle = false;
  if (saDay === automation.monthlyCycleDay) {
    const month = now.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }).slice(0, 7);
    const [already] = await db
      .select({ id: domainEvents.id })
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.type, "monthly_cycle.started"),
          sql`${domainEvents.payload}->>'month' = ${month}`,
        ),
      )
      .limit(1);
    if (!already) {
      await emitEvent(db, "monthly_cycle.started", null, { month });
      monthlyCycle = true;
    }
  }
  return { billing, briefings, monthlyCycle };
}
