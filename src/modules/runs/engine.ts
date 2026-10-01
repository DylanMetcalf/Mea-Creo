import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import {
  audits,
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  competitors,
  contentItems,
  leadActivities,
  leads,
  type ReportContent,
  reports,
  type RunItem,
  type RunOutcome,
  runs,
  services,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { checkQuality } from "@/agents/quality";
import { runAgent } from "@/agents/runtime";
import { resolveIntegration } from "@/integrations/registry";
import { enqueue } from "@/jobs/queue";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { logActivity, SYSTEM } from "@/modules/activity/log";
import type { Fetcher } from "@/modules/audits/collect";
import { processAudit } from "@/modules/audits/service";
import type { AuditFinding, AuditResult } from "@/modules/audits/types";
import { requestApproval } from "@/modules/approvals/service";
import { recomputeHealth } from "@/modules/clients/health";
import { refreshClientOpportunities } from "@/modules/growth/opportunities";
import { qualifyLead } from "@/modules/leads/qualify";
import { emitEvent } from "@/modules/notifications/service";
import { isRunKind, RUN_KINDS, type RunKind } from "./kinds";

interface RunContext {
  db: Db;
  runId: string;
  organisationId: string;
  client: typeof clients.$inferSelect;
  activeServices: string[];
  items: RunItem[];
  fetcher?: Fetcher;
  triggeredById: string | null;
}

/** Creates a queued run and schedules it. */
export async function createRun(
  db: DbOrTx,
  input: {
    organisationId: string;
    kind: string;
    triggeredById?: string;
    trigger?: "manual" | "schedule" | "workflow";
  },
): Promise<string> {
  if (!isRunKind(input.kind))
    throw new AppError("VALIDATION", { userMessage: "Unknown run type." });
  const [run] = await db
    .insert(runs)
    .values({
      organisationId: input.organisationId,
      kind: input.kind,
      triggeredById: input.triggeredById,
      trigger: input.trigger ?? "manual",
    })
    .returning({ id: runs.id });
  await enqueue(db, "run.execute", { runId: run.id }, { maxAttempts: 1 });
  return run.id;
}

const add = (
  ctx: RunContext,
  outcome: RunOutcome,
  title: string,
  detail?: string,
  extra: Partial<RunItem> = {},
) => {
  ctx.items.push({ outcome, title, detail, ...extra });
};

async function latestAudit(
  ctx: RunContext,
  maxAgeDays: number,
  withCompetitors = false,
): Promise<AuditResult | null> {
  if (!ctx.client.website) {
    add(ctx, "blocked", "No website on file", "Add the client's website to analyse visibility.");
    return null;
  }
  const since = new Date(Date.now() - maxAgeDays * 86400_000);
  if (!withCompetitors && maxAgeDays > 0) {
    const [recent] = await ctx.db
      .select()
      .from(audits)
      .where(
        and(
          eq(audits.organisationId, ctx.organisationId),
          eq(audits.status, "complete"),
          gte(audits.completedAt, since),
        ),
      )
      .orderBy(desc(audits.completedAt))
      .limit(1);
    if (recent?.result) return recent.result;
  }
  const [audit] = await ctx.db
    .insert(audits)
    .values({
      organisationId: ctx.organisationId,
      kind: ctx.client.isInternal ? "self" : "visibility",
      url: ctx.client.website,
      companyName: ctx.client.name,
      publicToken: randomToken(18),
      requestedById: ctx.triggeredById,
    })
    .returning();
  const result = await processAudit(ctx.db, audit.id, ctx.fetcher);
  if (!result) {
    const [failed] = await ctx.db
      .select({ error: audits.error })
      .from(audits)
      .where(eq(audits.id, audit.id));
    add(ctx, "blocked", "Visibility audit couldn't complete", failed?.error ?? undefined, {
      agent: "visibility",
    });
    return null;
  }
  add(ctx, "completed", "Visibility audit completed", result.headline, {
    agent: "visibility",
    link: `/workspace/clients/${ctx.organisationId}?tab=seo`,
  });
  return result;
}

async function createTaskOnce(
  ctx: RunContext,
  finding: AuditFinding,
  visibility: "client" | "internal" = "client",
): Promise<boolean> {
  const [existing] = await ctx.db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organisationId, ctx.organisationId),
        eq(tasks.sourceRef, finding.id),
        inArray(tasks.status, [
          "backlog",
          "ready",
          "in_progress",
          "waiting",
          "waiting_client",
          "waiting_approval",
          "blocked",
        ]),
      ),
    )
    .limit(1);
  if (existing) return false;
  await ctx.db.insert(tasks).values({
    organisationId: ctx.organisationId,
    title: finding.whatToDo.split(/(?<=\.)\s/)[0].slice(0, 180),
    description: `${finding.whatIsHappening}\n\nWhy it matters: ${finding.whyItMatters}`,
    priority: finding.impact === "high" ? "high" : "normal",
    source: "run",
    sourceRef: finding.id,
    agent: "visibility",
    visibility,
    status: "ready",
    dueAt: new Date(Date.now() + (finding.impact === "high" ? 7 : 14) * 86400_000),
  });
  return true;
}

function findingsFor(result: AuditResult, keys: string[]): AuditFinding[] {
  return result.categories
    .filter((c) => keys.includes(c.key))
    .flatMap((c) => c.findings.filter((f) => f.status === "fail" || f.status === "warn"));
}

// ---------------------------------------------------------------------------- Steps

async function stepVisibilityAudit(ctx: RunContext) {
  const result = await latestAudit(ctx, 0);
  if (!result) return;
  for (const o of result.opportunities.slice(0, 5))
    add(ctx, "recommended", o.title, o.description, { agent: "visibility" });
  await ctx.db
    .insert(timelineEntries)
    .values({
      organisationId: ctx.organisationId,
      kind: "work",
      title: "Visibility audit completed",
      description: result.headline,
      visibility: "client",
    });
}

async function stepSeo(ctx: RunContext) {
  const result = await latestAudit(ctx, 7);
  if (!result) return;
  let created = 0;
  const metadata: AuditFinding[] = [];
  for (const f of findingsFor(result, ["search", "technical"])) {
    if (["search.title", "search.description", "search.h1"].includes(f.id)) metadata.push(f);
    else if (await createTaskOnce(ctx, f)) created++;
  }
  if (created)
    add(
      ctx,
      "completed",
      `${created} SEO task(s) created`,
      "Technical and on-page fixes added to the work queue.",
      { agent: "visibility", link: `/workspace/tasks?client=${ctx.organisationId}` },
    );
  if (metadata.length) {
    const preview = metadata
      .map(
        (f) => `• ${f.title}\n  Now: ${f.evidence ?? f.whatIsHappening}\n  Proposed: ${f.whatToDo}`,
      )
      .join("\n\n");
    const qc = checkQuality(preview);
    const approval = await requestApproval(ctx.db, {
      organisationId: ctx.organisationId,
      level: "client",
      type: "website_change",
      title: "Update page titles, descriptions and headings",
      description: "Search-facing text changes recommended by the SEO analysis. No design changes.",
      preview,
      requestedAction: "Approve changes",
      requestedByAgent: "visibility",
      runId: ctx.runId,
      action: {
        type: "website_change.implement",
        payload: { title: "Apply approved title/description/heading changes" },
      },
    });
    add(
      ctx,
      approval.pending ? "requires_approval" : "completed",
      "Page title and heading changes",
      qc.passed
        ? "Sent for client approval."
        : `Quality check flagged: ${qc.issues.map((i) => i.rule).join(", ")}`,
      { agent: "visibility" },
    );
  }
  const search = resolveIntegration("search");
  if (!search.available || search.adapter.isMock) {
    add(
      ctx,
      "blocked",
      "Search Console data not included",
      "Connect Google Search Console to add rankings, impressions and clicks to the analysis.",
      { agent: "visibility" },
    );
  }
  if (!created && !metadata.length)
    add(
      ctx,
      "no_action",
      "No new SEO issues",
      "Search and technical foundations are in good shape.",
    );
}

async function stepAiVisibility(ctx: RunContext) {
  const result = await latestAudit(ctx, 7);
  if (!result) return;
  let created = 0;
  for (const f of findingsFor(result, ["ai_discoverability", "answer_readiness"]))
    if (await createTaskOnce(ctx, f)) created++;
  if (created)
    add(ctx, "completed", `${created} AI visibility task(s) created`, undefined, {
      agent: "visibility",
    });

  const facts = await ctx.db
    .select()
    .from(clientBrainFacts)
    .where(
      and(
        eq(clientBrainFacts.organisationId, ctx.organisationId),
        eq(clientBrainFacts.verification, "verified"),
      ),
    );
  const servicesFact =
    facts.find((f) => f.category === "company" || f.category === "services")?.value ??
    ctx.client.description ??
    ctx.client.name;
  const location =
    facts.find((f) => f.category === "locations")?.value ?? ctx.client.location ?? "";
  const questions = [
    `What does ${ctx.client.name.replace(/\s*\(Demo\)/, "")} do?`,
    `How much does it cost to work with a company like ${ctx.client.name.replace(/\s*\(Demo\)/, "")}?`,
    `How long does a typical project take?`,
    location ? `Do you work in ${location.split(",")[0]}?` : "Which areas do you serve?",
    "What makes you different from other providers?",
  ];
  const outcome = await runAgent(ctx.db, {
    agent: "research",
    action: "write.brain_suggestions",
    organisationId: ctx.organisationId,
    runId: ctx.runId,
    input: { purpose: "priority buyer questions", facts: facts.length },
    prompt: {
      system:
        "You identify the questions B2B buyers ask before choosing a supplier. Use only the facts provided. Return one question per line, no numbering, max 8. Label nothing as fact that is not in the input.",
      user: `Business facts:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}\n\nWhat questions would buyers ask?`,
      maxTokens: 800,
    },
    rules: () => questions.join("\n"),
  });
  if (outcome.status === "succeeded") {
    const list = outcome.text
      .split("\n")
      .map((q) => q.replace(/^[-•\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    await ctx.db.insert(clientBrainFacts).values({
      organisationId: ctx.organisationId,
      category: "strategy",
      label: "Suggested: priority buyer questions",
      value: list.join(" | "),
      sourceType: "agent",
      sourceRef: `run:${ctx.runId}`,
      verification: "unverified",
    });
    add(
      ctx,
      "recommended",
      "Priority buyer questions identified",
      `${list.length} questions saved to the Client Brain as unverified suggestions (${outcome.source === "ai" ? "AI-assisted" : "rule-based"}). Based on: ${servicesFact.slice(0, 80)}`,
      { agent: "research" },
    );
  } else {
    add(ctx, "blocked", "Question research skipped", outcome.reason, { agent: "research" });
  }
  add(
    ctx,
    "blocked",
    "AI answer monitoring not connected",
    "Measuring whether AI assistants mention the business requires a monitoring integration (planned). Nothing is assumed.",
    { agent: "visibility" },
  );
}

async function stepCompetitors(ctx: RunContext) {
  const rivals = await ctx.db
    .select()
    .from(competitors)
    .where(eq(competitors.organisationId, ctx.organisationId));
  if (rivals.length === 0) {
    add(
      ctx,
      "blocked",
      "No competitors on file",
      "Add 2–3 competitors to the client profile to compare.",
    );
    return;
  }
  const result = await latestAudit(ctx, 0, true);
  if (!result) return;
  for (const c of result.competitors) {
    if (c.considerations.length)
      add(
        ctx,
        "recommended",
        `What ${c.name} is doing that you could consider`,
        c.considerations.join("; "),
        { agent: "strategy" },
      );
    else
      add(ctx, "no_action", `${c.name}: no clear advantage found`, c.highlights.join(" "), {
        agent: "strategy",
      });
  }
}

async function stepContent(ctx: RunContext) {
  const result = await latestAudit(ctx, 14);
  const goals = await ctx.db
    .select()
    .from(clientGoals)
    .where(
      and(eq(clientGoals.organisationId, ctx.organisationId), eq(clientGoals.status, "active")),
    );
  const keywords = await ctx.db
    .select()
    .from(clientBrainFacts)
    .where(
      and(
        eq(clientBrainFacts.organisationId, ctx.organisationId),
        eq(clientBrainFacts.category, "keywords"),
      ),
    );
  const existing = new Set(
    (
      await ctx.db
        .select({ title: contentItems.title })
        .from(contentItems)
        .where(eq(contentItems.organisationId, ctx.organisationId))
    ).map((r) => r.title.toLowerCase()),
  );
  const ideas: { title: string; rationale: string; keyword?: string }[] = [];
  for (const k of keywords
    .flatMap((f) => f.value.split(/;|,/))
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4)) {
    ideas.push({
      title: `Service guide: ${k}`,
      rationale: "Priority topic from the Client Brain without a dedicated page or article.",
      keyword: k,
    });
  }
  if (result?.signals.questionHeadings.length === 0)
    ideas.push({
      title: "FAQ: the 10 questions buyers ask before choosing you",
      rationale: "No question-style content found on the site.",
    });
  if (result && !result.signals.blogPage)
    ideas.push({
      title: "Start an insights section with a first practical article",
      rationale: "No articles section found.",
    });
  for (const g of goals.slice(0, 2))
    ideas.push({
      title: `Content supporting: ${g.title}`,
      rationale: `Supports the goal "${g.title}".`,
    });

  let added = 0;
  for (const idea of ideas) {
    if (existing.has(idea.title.toLowerCase())) continue;
    await ctx.db
      .insert(contentItems)
      .values({
        organisationId: ctx.organisationId,
        title: idea.title,
        stage: "idea",
        rationale: idea.rationale,
        targetKeyword: idea.keyword,
      });
    added++;
  }
  if (added)
    add(
      ctx,
      "recommended",
      `${added} content idea(s) added to the pipeline`,
      ideas
        .map((i) => i.title)
        .slice(0, 3)
        .join(" · "),
      { agent: "content", link: `/workspace/clients/${ctx.organisationId}?tab=content` },
    );
  else
    add(
      ctx,
      "no_action",
      "No new content ideas",
      "Existing pipeline already covers the identified topics.",
    );

  const top = ideas[0];
  if (top) {
    const brief = await runAgent(ctx.db, {
      agent: "content",
      action: "write.content_drafts",
      organisationId: ctx.organisationId,
      runId: ctx.runId,
      input: { idea: top.title },
      prompt: {
        system:
          "You write concise content briefs for B2B websites. Plain language. No guarantees, no buzzwords. Structure: Audience, Search intent, Key questions to answer, Outline (H2s), Proof to include, Call to action.",
        user: `Company: ${ctx.client.name}\nDescription: ${ctx.client.description ?? ""}\nTopic: ${top.title}\nTarget keyword: ${top.keyword ?? "n/a"}`,
        maxTokens: 1200,
      },
      rules: () =>
        [
          `Audience: decision makers researching ${top.keyword ?? "this topic"}.`,
          `Search intent: understand options, cost and process before contacting a supplier.`,
          `Key questions: What is it? When do you need it? What does it cost? How long does it take? How do you choose a supplier?`,
          `Outline: What it is · Signs you need it · How the process works · Cost factors · How to choose · Next step`,
          `Proof: a relevant project example (with permission), certifications, response times you can stand behind.`,
          `Call to action: request a quote or book a site assessment.`,
        ].join("\n"),
    });
    if (brief.status === "succeeded") {
      await ctx.db
        .update(contentItems)
        .set({ stage: "brief", brief: brief.text })
        .where(
          and(
            eq(contentItems.organisationId, ctx.organisationId),
            eq(contentItems.title, top.title),
          ),
        );
      add(
        ctx,
        "completed",
        `Brief drafted: ${top.title}`,
        brief.source === "ai" ? "AI-assisted draft for review." : "Template brief for review.",
        { agent: "content" },
      );
    }
  }
}

async function stepConversion(ctx: RunContext) {
  const result = await latestAudit(ctx, 7);
  if (!result) return;
  let created = 0;
  for (const f of findingsFor(result, ["conversion"])) if (await createTaskOnce(ctx, f)) created++;
  add(
    ctx,
    created ? "completed" : "no_action",
    created ? `${created} conversion task(s) created` : "No new conversion issues",
    undefined,
    { agent: "visibility" },
  );
}

async function stepLeads(ctx: RunContext) {
  if (!ctx.client.isInternal) {
    add(
      ctx,
      "blocked",
      "Prospect discovery needs a data source",
      "Connect Sales Scout or import a prospect list for this client. No personal data is scraped.",
      { agent: "lead" },
    );
    return;
  }
  const open = await ctx.db
    .select()
    .from(leads)
    .where(inArray(leads.stage, ["new", "audit_generated", "qualified"]));
  let drafted = 0;
  for (const lead of open) {
    const [audit] = await ctx.db
      .select({ result: audits.result })
      .from(audits)
      .where(and(eq(audits.leadId, lead.id), eq(audits.status, "complete")))
      .orderBy(desc(audits.completedAt))
      .limit(1);
    if (!lead.score) {
      const q = qualifyLead({
        industry: lead.industry,
        employeeRange: lead.employeeRange,
        goal: lead.goal,
        audit: audit?.result ?? null,
      });
      await ctx.db
        .update(leads)
        .set({
          score: q.score,
          recommendedServices: q.recommendedServices,
          opportunitySummary: q.opportunitySummary,
          outreachAngle: q.outreachAngle,
        })
        .where(eq(leads.id, lead.id));
    }
    const fit = lead.score?.fit.level;
    if (!lead.email || !lead.consentAt || fit === "low") continue;
    const [recent] = await ctx.db
      .select({ id: leadActivities.id })
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.leadId, lead.id),
          inArray(leadActivities.type, ["email", "call"]),
          gte(leadActivities.createdAt, new Date(Date.now() - 3 * 86400_000)),
        ),
      )
      .limit(1);
    if (recent) continue;
    const top = audit?.result?.opportunities[0];
    const first = (lead.contactName ?? "there").split(" ")[0];
    const draft = await runAgent(ctx.db, {
      agent: "outreach",
      action: "write.outreach_drafts",
      organisationId: ctx.organisationId,
      runId: ctx.runId,
      input: { leadId: lead.id },
      prompt: {
        system:
          "You write short, personal follow-up emails from Dylan at Mea Creo to people who requested a Visibility Report. Under 120 words. Reference one specific finding. Offer a 20-minute call. No guarantees, no hype, no buzzwords. Plain text only.",
        user: `Name: ${lead.contactName}\nCompany: ${lead.company}\nTop finding: ${top?.title ?? "n/a"}\nWhy: ${top?.description ?? ""}`,
        maxTokens: 500,
      },
      rules: () =>
        `Hi ${first},\n\nThanks for requesting a Visibility Report for ${lead.company}. ${top ? `The biggest opportunity we saw: ${top.title.toLowerCase()}` : "There are a few quick wins in there."}\n\nWould a 20-minute call next week be useful to walk through what we'd do first? No obligation.\n\nKind regards,\nDylan\nMea Creo`,
    });
    if (draft.status !== "succeeded") continue;
    const qc = checkQuality(draft.text);
    await requestApproval(ctx.db, {
      organisationId: ctx.organisationId,
      level: "internal",
      type: "outreach",
      title: `Send follow-up email to ${lead.company}`,
      description: `${draft.source === "ai" ? "AI-drafted" : "Template"} follow-up. Nothing is sent without approval.${qc.passed ? "" : ` QC flags: ${qc.issues.map((i) => i.rule).join(", ")}`}`,
      preview: draft.text,
      requestedAction: "Approve & send",
      requestedByAgent: "outreach",
      runId: ctx.runId,
      entityType: "lead",
      entityId: lead.id,
      action: {
        type: "outreach.send",
        payload: {
          leadId: lead.id,
          subject: `Your Visibility Report for ${lead.company}`,
          body: draft.text,
          sequence: 1,
        },
      },
    });
    drafted++;
  }
  add(
    ctx,
    drafted ? "requires_approval" : "no_action",
    drafted ? `${drafted} follow-up email(s) awaiting approval` : "No follow-ups due",
    `${open.length} open prospect(s) reviewed.`,
    { agent: "outreach", link: "/workspace/approvals" },
  );
}

async function stepLinkedIn(ctx: RunContext) {
  const targets = ctx.client.isInternal
    ? await ctx.db
        .select()
        .from(leads)
        .where(inArray(leads.stage, ["audit_generated", "qualified", "contacted", "call_booked"]))
    : [];
  const plan = [
    "Review 10 target decision makers this week.",
    "For each: note one genuine reason to connect (a post, a project, a shared connection).",
    "Send a personal connection note (drafts provided). A person sends it; nothing is automated.",
    "Follow up once after acceptance with something useful, not a pitch.",
    ...targets
      .slice(0, 5)
      .map(
        (l) =>
          `Connect with ${l.contactName ?? "the decision maker"} at ${l.company}${l.linkedinUrl ? ` (${l.linkedinUrl})` : ""}.`,
      ),
  ];
  const approval = await requestApproval(ctx.db, {
    organisationId: ctx.organisationId,
    level: "manual",
    type: "outreach",
    title: "Weekly LinkedIn networking plan",
    description:
      "Assisted workflow: LinkedIn actions are performed by a person, in line with LinkedIn's terms.",
    preview: plan.join("\n"),
    requestedAction: "Mark as done",
    requestedByAgent: "outreach",
    runId: ctx.runId,
  });
  add(
    ctx,
    approval.pending ? "requires_approval" : "completed",
    "LinkedIn networking plan prepared",
    "Assisted: a person performs every LinkedIn action.",
    { agent: "outreach" },
  );
}

async function stepMonthlyReview(ctx: RunContext) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  const done = await ctx.db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.organisationId, ctx.organisationId),
        eq(tasks.status, "complete"),
        gte(tasks.completedAt, start),
      ),
    );
  const published = await ctx.db
    .select()
    .from(contentItems)
    .where(
      and(
        eq(contentItems.organisationId, ctx.organisationId),
        gte(contentItems.publishedAt, start),
      ),
    );
  const recentAudits = await ctx.db
    .select()
    .from(audits)
    .where(and(eq(audits.organisationId, ctx.organisationId), eq(audits.status, "complete")))
    .orderBy(desc(audits.completedAt))
    .limit(2);
  const openTasks = await ctx.db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.organisationId, ctx.organisationId),
        inArray(tasks.status, ["ready", "in_progress", "backlog"]),
        isNull(tasks.completedAt),
      ),
    )
    .limit(6);
  const waitingOnClient = await ctx.db
    .select()
    .from(tasks)
    .where(and(eq(tasks.organisationId, ctx.organisationId), eq(tasks.status, "waiting_client")));

  const [latest, previous] = recentAudits;
  const whatChanged: string[] = [];
  if (latest?.result && previous?.result) {
    const before = previous.result.counts.critical + previous.result.counts.improvements;
    const after = latest.result.counts.critical + latest.result.counts.improvements;
    whatChanged.push(`Visibility issues: ${before} → ${after} (from our site audits).`);
  }
  const search = resolveIntegration("search");
  const dataNotes: string[] = [];
  if (!search.available || search.adapter.isMock)
    dataNotes.push(
      "Google Search Console isn't connected, so search outcomes (clicks, impressions, positions) aren't included.",
    );

  const content: ReportContent = {
    headline: "",
    whatWeDid: done.slice(0, 10).map((t) => t.title),
    whatChanged: whatChanged.length
      ? whatChanged
      : ["No measured outcome changes this period. Connect data sources to report outcomes."],
    whatWeLearned: [],
    opportunities: latest?.result?.opportunities.slice(0, 3).map((o) => o.title) ?? [],
    whatHappensNext: openTasks.map((t) => t.title),
    needsFromYou: waitingOnClient.map((t) => t.title),
    activityMetrics: [
      { label: "Tasks completed", value: String(done.length) },
      { label: "Content published", value: String(published.length) },
      {
        label: "Audits run",
        value: String(recentAudits.filter((a) => a.completedAt && a.completedAt >= start).length),
      },
    ],
    outcomeMetrics: [],
    dataNotes,
  };
  const narrative = await runAgent(ctx.db, {
    agent: "reporting",
    action: "write.report_drafts",
    organisationId: ctx.organisationId,
    runId: ctx.runId,
    input: { period: [start.toISOString(), end.toISOString()], tasksCompleted: done.length },
    prompt: {
      system:
        "Write a one-sentence headline for a client's monthly report. Plain, specific, honest. Only reflect the data given; if outcomes aren't measured, don't imply they improved. No hype.",
      user: JSON.stringify({
        did: content.whatWeDid,
        changed: content.whatChanged,
        next: content.whatHappensNext,
      }),
      maxTokens: 200,
    },
    rules: () =>
      done.length
        ? `This month we completed ${done.length} piece${done.length === 1 ? "" : "s"} of work${content.opportunities.length ? `, and identified ${content.opportunities.length} opportunities for next month` : ""}.`
        : "A quieter month. Here's what's planned next.",
  });
  content.headline = narrative.text || "Monthly report";
  const qc = checkQuality(
    [content.headline, ...content.whatWeDid, ...content.whatChanged].join("\n"),
  );
  const month = end.toLocaleString("en-ZA", { month: "long", year: "numeric" });
  const [report] = await ctx.db
    .insert(reports)
    .values({
      organisationId: ctx.organisationId,
      title: `${month} report`,
      periodStart: start,
      periodEnd: end,
      status: "in_review",
      content,
      runId: ctx.runId,
      createdById: ctx.triggeredById,
    })
    .returning();
  add(
    ctx,
    "completed",
    "Monthly report drafted",
    qc.passed
      ? "Quality check passed."
      : `Quality check flagged: ${qc.issues.map((i) => i.rule).join(", ")}`,
    { agent: "reporting", link: `/workspace/reports/${report.id}` },
  );
  const approval = await requestApproval(ctx.db, {
    organisationId: ctx.organisationId,
    level: "internal",
    type: "report",
    title: `Publish ${month} report to client`,
    description: `Drafted by the Reporting agent (${narrative.source === "ai" ? "AI-assisted" : "rule-based"}).`,
    preview: `${content.headline}\n\nWhat we did:\n${content.whatWeDid.map((w) => `• ${w}`).join("\n")}`,
    requestedAction: "Approve & publish",
    requestedByAgent: "reporting",
    runId: ctx.runId,
    entityType: "report",
    entityId: report.id,
    action: { type: "report.publish", payload: { reportId: report.id } },
  });
  add(
    ctx,
    approval.pending ? "requires_approval" : "completed",
    "Report publication",
    approval.pending ? "Waiting for Mea Creo approval." : "Published automatically.",
    { agent: "reporting" },
  );
}

const STEPS: Record<
  Exclude<RunKind, "client_growth_review">,
  (ctx: RunContext) => Promise<void>
> = {
  visibility_audit: stepVisibilityAudit,
  seo_analysis: stepSeo,
  ai_visibility_analysis: stepAiVisibility,
  competitor_analysis: stepCompetitors,
  content_opportunity_scan: stepContent,
  website_conversion_audit: stepConversion,
  lead_opportunity_scan: stepLeads,
  linkedin_opportunity_scan: stepLinkedIn,
  monthly_client_review: stepMonthlyReview,
};

async function stepGrowth(ctx: RunContext) {
  const configured = await ctx.db
    .select({ runKinds: services.runKinds, name: services.name })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(
        eq(clientServices.organisationId, ctx.organisationId),
        eq(clientServices.status, "active"),
      ),
    );
  const kinds = new Set<RunKind>();
  for (const s of configured)
    for (const k of s.runKinds)
      if (isRunKind(k) && k !== "monthly_client_review" && k !== "client_growth_review")
        kinds.add(k);
  if (ctx.client.isInternal)
    ["visibility_audit", "lead_opportunity_scan", "content_opportunity_scan"].forEach((k) =>
      kinds.add(k as RunKind),
    );
  if (kinds.size === 0) {
    add(
      ctx,
      "no_action",
      "No automated workflows for the active services",
      configured.length ? "Active services are delivered manually." : "No active services.",
      { agent: "orchestrator" },
    );
  } else {
    add(
      ctx,
      "completed",
      "Workflows selected",
      [...kinds].map((k) => RUN_KINDS[k].label.replace(/^Run /, "")).join(", "),
      { agent: "orchestrator" },
    );
  }
  // Order matters: a fresh audit first, so later steps reuse it.
  const ordered = (
    [
      "visibility_audit",
      "seo_analysis",
      "ai_visibility_analysis",
      "competitor_analysis",
      "website_conversion_audit",
      "content_opportunity_scan",
      "lead_opportunity_scan",
      "linkedin_opportunity_scan",
    ] as const
  ).filter((k) => kinds.has(k));
  for (const kind of ordered) {
    const before = ctx.items.length;
    try {
      await STEPS[kind](ctx);
    } catch (error) {
      add(
        ctx,
        "blocked",
        `${RUN_KINDS[kind].label.replace(/^Run /, "")} failed`,
        error instanceof Error ? error.message : String(error),
      );
    }
    for (const item of ctx.items.slice(before))
      item.title = `${RUN_KINDS[kind].label.replace(/^Run /, "")}: ${item.title}`;
  }
  const count = await refreshClientOpportunities(ctx.db, ctx.organisationId, `run:${ctx.runId}`);
  add(
    ctx,
    "recommended",
    `${count} growth opportunit${count === 1 ? "y" : "ies"} reviewed`,
    "Upsell and improvement opportunities updated with reasons.",
    { agent: "strategy", link: `/workspace/clients/${ctx.organisationId}?tab=overview` },
  );
  const health = await recomputeHealth(ctx.db, ctx.organisationId);
  if (health)
    add(
      ctx,
      "completed",
      `Client health: ${health.state.replace("_", " ")}`,
      health.reasons
        .filter((r) => r.effect === "negative")
        .map((r) => r.detail)
        .join(" ") || "No concerns.",
      { agent: "client_success" },
    );
}

/** Executes a queued run end to end and records a summary. */
export async function executeRun(
  db: Db,
  runId: string,
  options: { fetcher?: Fetcher } = {},
): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run || run.status === "complete") return;
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.organisationId, run.organisationId))
    .limit(1);
  if (!client) {
    await db
      .update(runs)
      .set({ status: "failed", error: "Client not found", finishedAt: new Date() })
      .where(eq(runs.id, runId));
    return;
  }
  await db.update(runs).set({ status: "running", startedAt: new Date() }).where(eq(runs.id, runId));
  const active = await db
    .select({ slug: services.slug })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(
        eq(clientServices.organisationId, run.organisationId),
        eq(clientServices.status, "active"),
      ),
    );
  const ctx: RunContext = {
    db,
    runId,
    organisationId: run.organisationId,
    client,
    activeServices: active.map((a) => a.slug),
    items: [],
    fetcher: options.fetcher,
    triggeredById: run.triggeredById,
  };

  const kind = run.kind as RunKind;
  try {
    const { agentBlockReason } = await import("@/agents/runtime");
    const blocked = await agentBlockReason(db, "orchestrator", run.organisationId);
    if (blocked) {
      add(ctx, "blocked", "Run not started", blocked, { agent: "orchestrator" });
    } else if (kind === "client_growth_review") {
      await stepGrowth(ctx);
    } else {
      await STEPS[kind](ctx);
    }
    const counts = {
      completed: 0,
      requires_approval: 0,
      recommended: 0,
      blocked: 0,
      no_action: 0,
    } as Record<RunOutcome, number>;
    for (const item of ctx.items) counts[item.outcome]++;
    const headline = `${RUN_KINDS[kind].label.replace(/^Run /, "")} complete: ${counts.completed} completed, ${counts.requires_approval} awaiting approval, ${counts.recommended} recommended${counts.blocked ? `, ${counts.blocked} blocked` : ""}.`;
    const { agentRuns } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const [cost] = await db
      .select({ total: sql<number>`coalesce(sum(${agentRuns.costMicroUsd}), 0)::bigint` })
      .from(agentRuns)
      .where(eq(agentRuns.runId, runId));
    await db
      .update(runs)
      .set({
        status:
          counts.blocked === ctx.items.length && ctx.items.length > 0 ? "blocked" : "complete",
        items: ctx.items,
        summary: { headline, counts, findings: ctx.items.length },
        finishedAt: new Date(),
        costMicroUsd: Number(cost?.total ?? 0),
      })
      .where(eq(runs.id, runId));
    if (kind === "client_growth_review" && counts.blocked !== ctx.items.length) {
      await db
        .insert(timelineEntries)
        .values({
          organisationId: run.organisationId,
          kind: "work",
          title: "Growth review completed",
          description: `${counts.completed} actions completed, ${counts.recommended} recommendations, ${counts.requires_approval} awaiting approval.`,
          visibility: "client",
        });
    }
    await logActivity(
      db,
      run.triggeredById ? { type: "user", id: run.triggeredById, label: "Run" } : SYSTEM,
      {
        organisationId: run.organisationId,
        action: "run.completed",
        summary: headline,
        entityType: "run",
        entityId: runId,
      },
    );
    await emitEvent(db, "run.completed", run.organisationId, { runId, kind });
  } catch (error) {
    logger.error(
      { runId, err: error instanceof Error ? error.stack : String(error) },
      "run failed",
    );
    await db
      .update(runs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        items: ctx.items,
        finishedAt: new Date(),
      })
      .where(eq(runs.id, runId));
  }
}
