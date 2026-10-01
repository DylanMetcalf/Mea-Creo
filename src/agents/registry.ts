/**
 * Specialised agents. No agent has unrestricted access: each declares the actions it
 * may take, and the approval engine still decides whether an action needs a human.
 */
export const AGENT_ACTIONS = [
  "read.client_brain",
  "read.audits",
  "read.tasks",
  "read.reports",
  "read.leads",
  "read.billing_status",
  "read.analytics",
  "write.findings",
  "write.recommendations",
  "write.tasks",
  "write.content_drafts",
  "write.report_drafts",
  "write.proposal_drafts",
  "write.outreach_drafts",
  "write.opportunities",
  "write.brain_suggestions",
  "request.approval",
  "run.audit",
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

export interface AgentDefinition {
  id: string;
  name: string;
  purpose: string;
  permissions: AgentAction[];
  /** Explicitly forbidden, documented for clarity (enforced by never granting them). */
  never: string[];
  effort: "low" | "medium" | "high";
  promptVersion: string;
  status: "active" | "planned";
}

export const AGENTS: AgentDefinition[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    purpose: "Decides which work a run needs, which agent does it, and what needs approval.",
    permissions: [
      "read.client_brain",
      "read.audits",
      "read.tasks",
      "read.billing_status",
      "request.approval",
      "write.tasks",
    ],
    never: ["bypass approvals", "change billing", "send external messages"],
    effort: "low",
    promptVersion: "orchestrator.v1",
    status: "active",
  },
  {
    id: "research",
    name: "Research Agent",
    purpose:
      "Researches companies, markets, competitors and questions. Labels facts, inferences and recommendations.",
    permissions: ["read.client_brain", "read.audits", "write.findings", "write.brain_suggestions"],
    never: ["fabricate sources", "mark its own suggestions as verified"],
    effort: "medium",
    promptVersion: "research.v1",
    status: "active",
  },
  {
    id: "visibility",
    name: "Visibility Agent (SEO/GEO/AEO)",
    purpose:
      "Analyses search, AI discoverability and answer readiness; turns findings into prioritised recommendations.",
    permissions: [
      "read.client_brain",
      "read.audits",
      "read.analytics",
      "run.audit",
      "write.findings",
      "write.recommendations",
      "write.tasks",
      "request.approval",
    ],
    never: ["promise rankings or AI citations", "publish website changes without approval"],
    effort: "low",
    promptVersion: "visibility.v1",
    status: "active",
  },
  {
    id: "content",
    name: "Content Intelligence Agent",
    purpose: "Finds content opportunities from questions, gaps and goals; drafts briefs.",
    permissions: [
      "read.client_brain",
      "read.audits",
      "write.content_drafts",
      "write.recommendations",
      "request.approval",
    ],
    never: ["publish content", "use restricted claims"],
    effort: "low",
    promptVersion: "content.v1",
    status: "active",
  },
  {
    id: "lead",
    name: "Lead Agent",
    purpose: "Qualifies prospects against the ideal customer profile with explained reasons.",
    permissions: ["read.leads", "read.audits", "write.findings", "write.opportunities"],
    never: ["collect prohibited personal data", "scrape platforms against their terms"],
    effort: "low",
    promptVersion: "lead.v1",
    status: "active",
  },
  {
    id: "outreach",
    name: "Outreach Agent",
    purpose: "Prepares personalised outreach and follow-ups for human approval.",
    permissions: ["read.leads", "read.audits", "write.outreach_drafts", "request.approval"],
    never: ["send messages", "automate LinkedIn actions", "bulk email"],
    effort: "low",
    promptVersion: "outreach.v1",
    status: "active",
  },
  {
    id: "client_success",
    name: "Client Success Agent",
    purpose: "Monitors client health and explains why a client is healthy or at risk.",
    permissions: [
      "read.tasks",
      "read.billing_status",
      "read.reports",
      "write.findings",
      "write.tasks",
    ],
    never: ["contact clients directly"],
    effort: "low",
    promptVersion: "client_success.v1",
    status: "active",
  },
  {
    id: "reporting",
    name: "Reporting Agent",
    purpose: "Drafts monthly reports: what we did, what changed, what we learned, what's next.",
    permissions: [
      "read.client_brain",
      "read.tasks",
      "read.audits",
      "read.analytics",
      "write.report_drafts",
      "request.approval",
    ],
    never: ["publish reports", "present activity as outcomes", "invent metrics"],
    effort: "low",
    promptVersion: "reporting.v1",
    status: "active",
  },
  {
    id: "strategy",
    name: "Strategy Agent",
    purpose: "Turns findings into prioritised recommendations and next steps.",
    permissions: [
      "read.client_brain",
      "read.audits",
      "read.reports",
      "write.recommendations",
      "write.opportunities",
    ],
    never: ["change a client's contract or services"],
    effort: "medium",
    promptVersion: "strategy.v1",
    status: "active",
  },
  {
    id: "proposal",
    name: "Proposal Agent",
    purpose: "Drafts proposals from real needs, configured services and configured prices only.",
    permissions: ["read.leads", "read.audits", "write.proposal_drafts"],
    never: ["invent services or prices", "send proposals"],
    effort: "low",
    promptVersion: "proposal.v1",
    status: "active",
  },
  {
    id: "operations",
    name: "Operations Agent",
    purpose: "Creates and organises tasks from runs, meetings and onboarding.",
    permissions: ["read.tasks", "write.tasks"],
    never: ["delete work", "reassign people without approval"],
    effort: "low",
    promptVersion: "operations.v1",
    status: "active",
  },
  {
    id: "quality_control",
    name: "QA Agent",
    purpose:
      "Checks client-facing output for unsupported claims, restricted claims, pricing, links and missing evidence.",
    permissions: ["read.client_brain", "write.findings"],
    never: ["approve on behalf of a human"],
    effort: "low",
    promptVersion: "qc.v1",
    status: "active",
  },
  {
    id: "growth",
    name: "Mea Creo Growth Agent",
    purpose: "Looks for opportunities to improve Mea Creo's own visibility and pipeline.",
    permissions: [
      "read.client_brain",
      "read.audits",
      "read.leads",
      "write.recommendations",
      "write.opportunities",
      "write.tasks",
    ],
    never: ["send external messages"],
    effort: "low",
    promptVersion: "growth.v1",
    status: "active",
  },
  {
    id: "analytics",
    name: "Analytics Agent",
    purpose: "Interprets Search Console and Analytics trends (requires connected data).",
    permissions: ["read.analytics", "write.findings"],
    never: ["change ad budgets"],
    effort: "low",
    promptVersion: "analytics.v1",
    status: "planned",
  },
  {
    id: "client_assistant",
    name: "Ask Mea Creo (client assistant)",
    purpose: "Answers client questions using only that client's permitted data.",
    permissions: ["read.client_brain", "read.tasks", "read.reports", "read.billing_status"],
    never: [
      "reveal other clients",
      "reveal internal notes, prompts or secrets",
      "make commitments or change billing",
    ],
    effort: "low",
    promptVersion: "assistant.v1",
    status: "active",
  },
];

export function getAgent(id: string): AgentDefinition {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}

export function agentCan(id: string, action: AgentAction): boolean {
  return getAgent(id).permissions.includes(action);
}
