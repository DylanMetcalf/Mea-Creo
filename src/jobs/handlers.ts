import type { JobHandler } from "./queue";

/**
 * Job type → handler. Handlers import their modules lazily so the web process only
 * loads what a job actually needs.
 */
export const JOB_HANDLERS: Record<string, JobHandler> = {
  "audit.run": async (payload, db) => {
    const { processAudit } = await import("@/modules/audits/service");
    await processAudit(db, String(payload.auditId));
  },
  "run.execute": async (payload, db) => {
    const { executeRun } = await import("@/modules/runs/engine");
    await executeRun(db, String(payload.runId));
  },
  "events.process": async (_payload, db) => {
    const { processDomainEvents } = await import("@/modules/workflows/engine");
    await processDomainEvents(db);
  },
  "billing.daily": async (_payload, db) => {
    const { runDailyBilling } = await import("@/modules/billing/service");
    await runDailyBilling(db);
  },
  "daily.cycle": async (_payload, db) => {
    const { runDailyCycle } = await import("@/modules/scheduler/daily");
    await runDailyCycle(db);
  },
  "lead.research": async (payload, db) => {
    const { researchLead } = await import("@/modules/prospects/research");
    await researchLead(db, String(payload.leadId));
  },
  "meeting.briefing": async (payload, db) => {
    const { generateMeetingBriefing } = await import("@/modules/meetings/briefing");
    await generateMeetingBriefing(db, String(payload.meetingId));
  },
};
