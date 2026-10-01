import { and, desc, eq } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import {
  audits,
  clientBrainFacts,
  clientGoals,
  clients,
  leadActivities,
  leads,
  type MeetingBriefing,
  type MeetingOutcome,
  meetings,
  tasks,
} from "@/db/schema";
import { runAgent } from "@/agents/runtime";
import { requestApproval } from "@/modules/approvals/service";
import { emitEvent } from "@/modules/notifications/service";
import { getPlatformOrganisation } from "@/modules/settings/service";

/**
 * Pre-call briefing: company, website, visibility, audit findings, competitors, problems,
 * opportunities, recommended services, likely objections, questions and next step.
 * Built from stored data (with sources); AI only adds an optional summary paragraph.
 */
export async function generateMeetingBriefing(
  db: Db,
  meetingId: string,
): Promise<MeetingBriefing | null> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting) return null;
  const sections: MeetingBriefing["sections"] = [];
  const sources: string[] = [];

  if (meeting.leadId) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, meeting.leadId)).limit(1);
    if (!lead) return null;
    const [audit] = await db
      .select()
      .from(audits)
      .where(and(eq(audits.leadId, lead.id), eq(audits.status, "complete")))
      .orderBy(desc(audits.completedAt))
      .limit(1);
    const history = await db
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, lead.id))
      .orderBy(desc(leadActivities.createdAt))
      .limit(6);
    sources.push(
      "Lead record",
      ...(audit ? ["Visibility Report"] : []),
      ...(history.length ? ["Activity history"] : []),
    );

    sections.push({
      heading: "Company",
      items: [
        `${lead.company}${lead.industry ? `: ${lead.industry}` : ""}${lead.location ? `, ${lead.location}` : ""}`,
        lead.website ? `Website: ${lead.website}` : "No website on file",
        lead.employeeRange ? `Size: ${lead.employeeRange} employees` : "Size unknown",
        `Contact: ${lead.contactName ?? "unknown"}${lead.contactRole ? ` (${lead.contactRole})` : ""}`,
        lead.goal ? `Stated goal: "${lead.goal}"` : "No goal stated",
      ],
    });
    if (lead.score?.budgetLikelihood) {
      sections.push({
        heading: "Qualification",
        items: [
          `Fit: ${lead.score.fit.level}. ${lead.score.fit.reasons.join(" ")}`,
          `Visibility opportunity: ${lead.score.visibilityOpportunity.level}`,
          `Budget likelihood: ${lead.score.budgetLikelihood.level}. ${lead.score.budgetLikelihood.reasons.join(" ")}`,
          `Decision-maker access: ${lead.score.decisionMakerAccess.level}`,
          `Confidence: ${lead.score.confidence.level}`,
        ],
      });
    }
    if (audit?.result) {
      const r = audit.result;
      sections.push({
        heading: "Existing visibility",
        items: [
          r.headline,
          ...r.categories
            .filter((c) => c.status === "critical" || c.status === "needs_attention")
            .map((c) => `${c.label}: ${c.summary}`),
        ],
      });
      sections.push({
        heading: "Biggest opportunities",
        items: r.opportunities.slice(0, 5).map((o) => `${o.title} (${o.impact} impact)`),
      });
    } else {
      sections.push({
        heading: "Existing visibility",
        items: ["No Visibility Report yet. Consider running one before the call."],
      });
    }
    sections.push({
      heading: "Recommended services",
      items: lead.recommendedServices.length
        ? lead.recommendedServices
        : ["To be confirmed in the call"],
    });
    sections.push({
      heading: "Questions to ask",
      items: [
        "How do most of your new clients find you today?",
        "What is a new client worth to you (first year)?",
        "Who decides on marketing spend, and what's the budget range?",
        "Have you worked with an agency before? What worked, and what didn't?",
        "What would make the next 6 months a success?",
        ...(lead.score?.budgetLikelihood?.level === "high"
          ? ["Who handles marketing internally today?"]
          : []),
      ],
    });
    sections.push({
      heading: "Likely objections",
      items: [
        '"We tried SEO before and saw nothing." Show the measurement plan and monthly reporting.',
        '"Most work comes from referrals." Visibility supports referrals: people check you online first.',
        '"It\'s expensive." Anchor on the value of one new client.',
      ],
    });
    sections.push({
      heading: "Previous interactions",
      items: history.length
        ? history.map((h) => `${h.createdAt.toISOString().slice(0, 10)}: ${h.summary}`)
        : ["None"],
    });
    sections.push({
      heading: "Suggested next step",
      items: ["Agree priorities, then send a proposal within 3 working days."],
    });
  } else if (meeting.organisationId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.organisationId, meeting.organisationId))
      .limit(1);
    const goals = await db
      .select()
      .from(clientGoals)
      .where(eq(clientGoals.organisationId, meeting.organisationId));
    const openTasks = await db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.organisationId, meeting.organisationId), eq(tasks.status, "waiting_client")),
      );
    sources.push("Client profile", "Goals", "Tasks");
    sections.push({
      heading: "Client",
      items: [
        `${client?.name}: health ${client?.health?.replace("_", " ")}`,
        ...(client?.healthReasons ?? [])
          .filter((r) => r.effect !== "positive")
          .map((r) => r.detail),
      ],
    });
    sections.push({
      heading: "Goals",
      items: goals.map(
        (g) =>
          `${g.title}${g.current ? ` (current: ${g.current}, target: ${g.target ?? "n/a"})` : ""}`,
      ),
    });
    sections.push({
      heading: "Waiting on the client",
      items: openTasks.length ? openTasks.map((t) => t.title) : ["Nothing outstanding"],
    });
  }

  const summary = await runAgent(db, {
    agent: "research",
    action: "write.findings",
    organisationId: meeting.organisationId,
    input: { meetingId },
    prompt: {
      system:
        "Summarise this sales/client briefing in 3 sentences for the person taking the call. Use only the information given. Separate facts from suggestions.",
      user: JSON.stringify(sections),
      maxTokens: 400,
    },
    rules: () => "",
  });
  if (summary.text) sections.unshift({ heading: "Summary (AI-assisted)", items: [summary.text] });

  const briefing: MeetingBriefing = { generatedAt: new Date().toISOString(), sections, sources };
  await db.update(meetings).set({ briefing }).where(eq(meetings.id, meetingId));
  return briefing;
}

/**
 * Rule-based extraction from call notes, so the workflow works without AI.
 * Lines starting with a keyword ("Budget:", "Next:", "Goal:") are picked up.
 */
export function extractFromNotes(
  notes: string,
): Omit<MeetingOutcome, "generatedAt" | "followUpEmail"> {
  const lines = notes
    .split(/\n|(?<=\.)\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pick = (re: RegExp) =>
    lines
      .filter((l) => re.test(l))
      .map((l) =>
        l
          .replace(re, "")
          .replace(/^[:\-–\s]+/, "")
          .trim(),
      )
      .filter(Boolean);
  const find = (re: RegExp) => lines.find((l) => re.test(l));
  return {
    summary: lines.slice(0, 2).join(" "),
    needs: pick(/^(needs?|problem|pain|challenge)s?\b/i),
    goals: pick(/^(goals?|wants?|objective)\b/i),
    budget: find(/budget|r\s?\d{1,3}[\s,]?\d{3}|per month/i),
    timeline: find(/\b(start|timeline|by (next|end of)|next month|weeks?)\b/i),
    objections: pick(/^(objection|concern|worry|worried|previous agency)\b/i),
    servicesDiscussed: [
      "SEO",
      "GEO",
      "AEO",
      "Google Ads",
      "LinkedIn",
      "Lead generation",
      "Content",
      "Automation",
      "Website",
    ].filter((s) => notes.toLowerCase().includes(s.toLowerCase())),
    nextSteps: pick(/^(next( steps?)?|action|follow[- ]?up|todo)\b/i),
  };
}

/** Post-meeting: summary, requirements, tasks, follow-up email draft (for approval). */
export async function processMeetingNotes(
  db: DbOrTx,
  meetingId: string,
  actor: { id: string; name: string },
): Promise<MeetingOutcome | null> {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  if (!meeting || !(meeting.notes || meeting.transcript)) return null;
  const source = [meeting.notes, meeting.transcript].filter(Boolean).join("\n\n");
  const rules = extractFromNotes(source);

  const extraction = await runAgent(db, {
    agent: "research",
    action: "write.findings",
    organisationId: meeting.organisationId,
    input: { meetingId, chars: source.length },
    prompt: {
      system:
        "Extract a JSON object from meeting notes with keys: summary (string), needs, goals, objections, servicesDiscussed, nextSteps (string arrays), budget, timeline (strings or null). Use only what the notes say. Respond with JSON only.",
      user: source.slice(0, 30_000),
      maxTokens: 1500,
    },
    rules: () => JSON.stringify(rules),
  });
  let parsed = rules;
  try {
    const json = JSON.parse(extraction.text.replace(/^```json|```$/g, "").trim());
    parsed = { ...rules, ...json };
  } catch {
    parsed = rules;
  }

  const [lead] = meeting.leadId
    ? await db.select().from(leads).where(eq(leads.id, meeting.leadId)).limit(1)
    : [];
  const first = (lead?.contactName ?? meeting.attendees[0]?.name ?? "there").split(" ")[0];
  const followUpEmail = `Hi ${first},\n\nThank you for your time today. To recap:\n${(parsed.needs.length ? parsed.needs : [parsed.summary]).map((n) => `• ${n}`).join("\n")}\n\nNext steps:\n${(parsed.nextSteps.length ? parsed.nextSteps : ["We'll send a proposal shortly."]).map((n) => `• ${n}`).join("\n")}\n\nKind regards,\n${actor.name.split(" ")[0]}`;
  const outcome: MeetingOutcome = {
    ...parsed,
    followUpEmail,
    generatedAt: new Date().toISOString(),
  };
  await db.update(meetings).set({ outcome, status: "completed" }).where(eq(meetings.id, meetingId));

  const platform = await getPlatformOrganisation(db);
  const orgForTasks = meeting.organisationId ?? platform.id;
  for (const step of outcome.nextSteps.slice(0, 6)) {
    await db.insert(tasks).values({
      organisationId: orgForTasks,
      title: step.slice(0, 180),
      source: "meeting",
      sourceRef: meetingId,
      assigneeId: actor.id,
      dueAt: new Date(Date.now() + 3 * 86400_000),
    });
  }
  if (lead) {
    await db
      .update(leads)
      .set({
        stage: "call_completed",
        lastActivityAt: new Date(),
        goal: lead.goal ?? outcome.goals[0] ?? null,
      })
      .where(eq(leads.id, lead.id));
    await db.insert(leadActivities).values({
      leadId: lead.id,
      type: "meeting",
      summary: `Call completed: ${outcome.summary.slice(0, 200)}`,
      actorId: actor.id,
    });
    if (lead.email) {
      await requestApproval(db, {
        organisationId: platform.id,
        level: "internal",
        type: "outreach",
        title: `Send call follow-up to ${lead.company}`,
        description: "Drafted from the call notes. Review before sending.",
        preview: followUpEmail,
        requestedAction: "Approve & send",
        requestedByAgent: "outreach",
        entityType: "lead",
        entityId: lead.id,
        action: {
          type: "outreach.send",
          payload: {
            leadId: lead.id,
            subject: "Thank you for your time today",
            body: followUpEmail,
            sequence: `call-${meetingId}`,
          },
        },
      });
    }
  }
  if (meeting.organisationId) {
    for (const goal of outcome.goals.slice(0, 3)) {
      await db.insert(clientBrainFacts).values({
        organisationId: meeting.organisationId,
        category: "strategy",
        label: "Goal from meeting",
        value: goal,
        sourceType: "agent",
        sourceRef: `meeting:${meetingId}`,
        verification: "unverified",
      });
    }
  }
  await emitEvent(db, "call.completed", meeting.organisationId, { meetingId });
  return outcome;
}
