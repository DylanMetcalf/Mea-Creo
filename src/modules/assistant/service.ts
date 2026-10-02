import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  approvals,
  clientGoals,
  clients,
  clientServices,
  invoices,
  opportunities,
  reports,
  services,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { runAgent } from "@/agents/runtime";
import { isEnabled } from "@/config/flags";
import { formatMoney, isCurrency, money } from "@/lib/money";
import { latestClientAudit } from "@/modules/audits/service";
import { BAND_LABELS, INDEX_METHOD, visibilityIndex } from "@/modules/audits/visibility-index";

export interface AssistantAnswer {
  answer: string;
  sources: { label: string; href: string }[];
  source: "ai" | "rules";
  suggestions: string[];
}

type Intent =
  | "services"
  | "month"
  | "improved"
  | "approvals"
  | "next"
  | "report"
  | "opportunities"
  | "billing"
  | "meeting"
  | "upload"
  | "visibility"
  | "unknown";

const INTENTS: [Intent, RegExp][] = [
  ["approvals", /approv|sign off|need.*from (me|us)|waiting on (me|us)/i],
  ["billing", /invoice|pay|bill|owe|balance|account/i],
  ["meeting", /meet|call|book|appointment/i],
  ["upload", /upload|send (you|files)|what should we (upload|send)/i],
  ["visibility", /visibility (index|score)|\bindex\b|how visible|how (easy|easily) .*found/i],
  ["report", /report|mean|explain/i],
  ["improved", /improv|better|result|progress|working|perform/i],
  ["month", /this month|happen|done|complet|what did you/i],
  ["next", /next|plan|upcoming|work on/i],
  ["opportunities", /opportunit|should we|add|recommend|google ads|grow/i],
  ["services", /service|doing for us|active|package|what are you doing/i],
];

export function classifyQuestion(question: string): Intent {
  return INTENTS.find(([, re]) => re.test(question))?.[0] ?? "unknown";
}

const SUGGESTIONS = [
  "What changed this month?",
  "What should we focus on next?",
  "Explain my Visibility Index",
  "What is Mea Creo doing for us?",
  "What needs my approval?",
  "What has improved?",
  "What are our biggest opportunities?",
  "What happens next?",
];

/**
 * Answers a client's question using ONLY that organisation's client-visible data.
 * Internal notes, other clients, prompts and secrets are never retrieved, so they can't leak.
 */
export async function askMeaCreo(
  db: DbOrTx,
  organisationId: string,
  question: string,
): Promise<AssistantAnswer> {
  const q = question.trim().slice(0, 500);
  const intent = classifyQuestion(q);
  const since = new Date(Date.now() - 31 * 86400_000);
  const facts: string[] = [];
  const sources: AssistantAnswer["sources"] = [];

  const [client] = await db
    .select({ name: clients.name, billingState: clients.billingState })
    .from(clients)
    .where(eq(clients.organisationId, organisationId));

  if (intent === "services" || intent === "unknown") {
    const rows = await db
      .select({
        name: services.name,
        status: clientServices.status,
        focus: clientServices.currentFocus,
      })
      .from(clientServices)
      .innerJoin(services, eq(services.id, clientServices.serviceId))
      .where(
        and(
          eq(clientServices.organisationId, organisationId),
          inArray(clientServices.status, ["active", "paused", "pending"]),
        ),
      );
    facts.push(
      rows.length
        ? `Your services: ${rows.map((r) => `${r.name} (${r.status})${r.focus ? `: currently ${r.focus.charAt(0).toLowerCase()}${r.focus.slice(1)}` : ""}`).join("; ")}.`
        : "You don't have any active services yet.",
    );
    sources.push({ label: "Your services", href: "/portal/services" });
  }
  if (intent === "month" || intent === "improved" || intent === "unknown") {
    const done = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, organisationId),
          eq(tasks.visibility, "client"),
          eq(tasks.status, "complete"),
          gte(tasks.completedAt, since),
        ),
      )
      .limit(8);
    const timeline = await db
      .select({ title: timelineEntries.title, kind: timelineEntries.kind })
      .from(timelineEntries)
      .where(
        and(
          eq(timelineEntries.organisationId, organisationId),
          eq(timelineEntries.visibility, "client"),
          gte(timelineEntries.occurredAt, since),
        ),
      )
      .orderBy(desc(timelineEntries.occurredAt))
      .limit(6);
    if (intent !== "improved")
      facts.push(
        done.length
          ? `Completed in the last month: ${done.map((d) => d.title).join("; ")}.`
          : "No completed work recorded in the last month.",
      );
    const results = timeline.filter((t) => t.kind === "result");
    if (intent === "improved")
      facts.push(
        results.length
          ? `Recorded results: ${results.map((r) => r.title).join("; ")}.`
          : "No measured results have been recorded in the last month.",
      );
    sources.push({ label: "Growth timeline", href: "/portal/growth" });
  }
  if (intent === "improved" || intent === "report") {
    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.organisationId, organisationId), eq(reports.status, "published")))
      .orderBy(desc(reports.publishedAt))
      .limit(1);
    if (report) {
      facts.push(`Latest report (${report.title}): ${report.content.headline}`);
      if (report.content.whatChanged.length)
        facts.push(`What changed: ${report.content.whatChanged.join("; ")}.`);
      if (report.content.dataNotes.length)
        facts.push(`Note: ${report.content.dataNotes.join(" ")}`);
      sources.push({ label: report.title, href: `/portal/reports/${report.id}` });
    } else {
      facts.push("No report has been published yet.");
    }
  }
  if (intent === "visibility") {
    const audit = await latestClientAudit(db, organisationId);
    const index = audit?.result ? visibilityIndex(audit.result) : null;
    if (audit?.result && index) {
      const measured = index.areas.filter((a) => a.score !== null);
      const strongest = [...measured].sort((a, b) => b.score! - a.score!)[0];
      const weakest = [...measured].sort((a, b) => a.score! - b.score!)[0];
      facts.push(
        `Your Mea Creo Visibility Index is ${index.score} out of 100 (${BAND_LABELS[index.band].toLowerCase()}), from the Visibility Report checked on ${new Date(audit.result.fetchedAt).toLocaleDateString("en-ZA", { dateStyle: "medium" })}.`,
        `Strongest area: ${strongest.label} (${strongest.score}). Biggest gap: ${weakest.label} (${weakest.score}).`,
        INDEX_METHOD,
      );
      sources.push({ label: "Visibility Report", href: `/visibility-report/${audit.publicToken}` });
    } else {
      facts.push(
        "There's no completed Visibility Report for your business yet, so there's no Index to explain.",
      );
    }
  }
  if (intent === "approvals") {
    const pending = await db
      .select({ id: approvals.id, title: approvals.title })
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, organisationId),
          eq(approvals.level, "client"),
          eq(approvals.status, "pending"),
        ),
      );
    const waiting = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.organisationId, organisationId), eq(tasks.status, "waiting_client")));
    facts.push(
      pending.length
        ? `${pending.length} item(s) need your approval: ${pending.map((p) => p.title).join("; ")}.`
        : "Nothing is waiting for your approval.",
    );
    if (waiting.length)
      facts.push(`We're also waiting on you for: ${waiting.map((w) => w.title).join("; ")}.`);
    sources.push({ label: "Approvals", href: "/portal/approvals" });
  }
  if (intent === "next") {
    const upcoming = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.organisationId, organisationId),
          eq(tasks.visibility, "client"),
          inArray(tasks.status, ["ready", "in_progress", "backlog"]),
        ),
      )
      .limit(8);
    facts.push(
      upcoming.length
        ? `Coming up: ${upcoming.map((u) => u.title).join("; ")}.`
        : "Nothing new is scheduled yet. Your account manager will share the next plan.",
    );
    sources.push({ label: "Current work", href: "/portal/work" });
  }
  if (intent === "opportunities") {
    const opps = await db
      .select({ title: opportunities.title, reason: opportunities.reason })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.organisationId, organisationId),
          eq(opportunities.status, "open"),
          eq(opportunities.clientVisible, "yes"),
        ),
      )
      .limit(5);
    facts.push(
      opps.length
        ? `Opportunities we've identified: ${opps.map((o) => `${o.title} (${o.reason})`).join(" ")}`
        : "There are no new opportunities to share right now.",
    );
    sources.push({ label: "Services & opportunities", href: "/portal/services" });
  }
  if (intent === "billing") {
    const open = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organisationId, organisationId),
          inArray(invoices.status, ["open", "overdue"]),
        ),
      );
    facts.push(
      open.length
        ? `Outstanding: ${open.map((i) => `${i.number} ${formatMoney(money(i.totalMinor - i.amountPaidMinor, isCurrency(i.currency) ? i.currency : "ZAR"))} (${i.status})`).join("; ")}.`
        : "You have no outstanding invoices.",
    );
    if (client?.billingState === "overdue")
      facts.push(
        "Some automated work is paused until the overdue invoice is paid. Nothing has been deleted.",
      );
    sources.push({ label: "Billing", href: "/portal/billing" });
  }
  if (intent === "meeting") {
    facts.push(
      "You can book a meeting with your account manager from the Meetings page. Available times come from our calendar.",
    );
    sources.push({ label: "Meetings", href: "/portal/meetings" });
  }
  if (intent === "upload") {
    const waiting = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.organisationId, organisationId), eq(tasks.status, "waiting_client")));
    facts.push(
      waiting.length
        ? `Helpful uploads right now: ${waiting.map((w) => w.title).join("; ")}.`
        : "Useful uploads: logos, brand guidelines, photos of your team and work, case studies and sales documents.",
    );
    sources.push({ label: "Files", href: "/portal/files" });
  }
  if (intent === "unknown") {
    const goals = await db
      .select({ title: clientGoals.title })
      .from(clientGoals)
      .where(and(eq(clientGoals.organisationId, organisationId), eq(clientGoals.status, "active")));
    if (goals.length) facts.push(`Your current goals: ${goals.map((g) => g.title).join("; ")}.`);
  }

  const rulesAnswer = facts.join("\n\n");
  const useAi = isEnabled("CLIENT_AI");
  const outcome = await runAgent(db, {
    agent: "client_assistant",
    action: "read.client_brain",
    organisationId,
    input: { intent, question: q.slice(0, 200) },
    prompt: useAi
      ? {
          system:
            "You are 'Ask Mea Creo', a helpful assistant inside a client's workspace. Answer ONLY from the facts provided. If the facts don't cover the question, say so and suggest contacting the account manager. Never make commitments, quote new prices, change billing or contracts, or mention other clients. Be brief and plain.",
          user: `Client: ${client?.name}\nFacts:\n${rulesAnswer}\n\nQuestion: ${q}`,
          maxTokens: 600,
        }
      : undefined,
    rules: () =>
      intent === "unknown"
        ? `${rulesAnswer}\n\nI can answer questions about your services, recent work, approvals, reports, opportunities, billing and meetings. For anything else, send your account manager a message.`
        : rulesAnswer,
  });

  return {
    answer:
      outcome.status === "succeeded"
        ? outcome.text
        : "The assistant is paused right now. Please message your account manager.",
    sources,
    source: outcome.source,
    suggestions: SUGGESTIONS.filter((s) => classifyQuestion(s) !== intent).slice(0, 3),
  };
}
