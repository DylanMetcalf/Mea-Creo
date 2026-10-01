# AI agents

Agents are specialised workers with narrow permissions. They read what they're allowed to,
draft and recommend, and **request approval** for anything that matters. They never send,
publish, pay, sign or change budgets on their own.

## Registry (`src/agents/registry.ts`)

| Agent                    | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Orchestrator             | Decides what a run needs, which agent does it and what needs approval   |
| Research                 | Companies, markets, competitors, questions; labels facts vs inferences  |
| Visibility (SEO/GEO/AEO) | Turns audit findings into prioritised recommendations                   |
| Content Intelligence     | Content opportunities and briefs                                        |
| Lead                     | Qualification with explained reasons                                    |
| Outreach                 | Personalised follow-up drafts, always for approval                      |
| Client Success           | Health and its reasons                                                  |
| Reporting                | Monthly report drafts: what we did, what changed, what we learned, next |
| Strategy                 | Findings → prioritised recommendations                                  |
| Proposal                 | Drafts from real needs and configured prices only                       |
| Operations               | Tasks from runs, meetings and onboarding                                |
| QA                       | Checks client-facing output for guarantees, unsupported claims, prices  |
| Mea Creo Growth          | Mea Creo's own visibility and pipeline                                  |
| Ask Mea Creo             | Client assistant restricted to that client's visible data               |
| Analytics (planned)      | Search Console and GA4 trends, once connected                           |

Each entry lists allowed actions (e.g. `write.outreach_drafts`, `request.approval`) and a
documented "never" list. The Agents table in Workspace → Runs & agents shows both.

## Runtime (`src/agents/runtime.ts`)

Every agent call goes through `runAgent`, which:

1. Checks the agent may take the action.
2. Applies emergency controls (pause everything, pause one agent), per-client automation
   pauses, and billing pauses (no automated work while an account is overdue).
3. Checks monthly AI budgets (global and per client, Settings → AI & costs). Over budget →
   rules mode, never silent overspend.
4. Calls the AI provider when one is configured (Anthropic, default model
   `claude-opus-5-5`, with server-side fallback), otherwise runs the agent's deterministic
   `rules()` function.
5. Records an `agent_runs` row: agent, action, provider, model, tokens, estimated cost,
   duration, status and errors.

**Rules mode** is a complete product, not a broken one: audits, qualification, health,
opportunities, briefings, note extraction, proposal drafts and report drafts all have
deterministic implementations. AI improves wording and extraction.

## Quality control (`src/agents/quality.ts`)

Deterministic checks on client-facing text: guarantees ("guaranteed rankings", "#1 on
Google"), predicted outcomes, buzzwords, restricted claims and unknown prices. Blocking
issues stop proposals being sent, reports being published and articles going live.

## Ask Mea Creo (`src/modules/assistant/service.ts`)

Classifies the client's question, then reads **only** that organisation's client-visible
records (services, client-visible tasks and timeline, pending client approvals, published
reports, invoices, meetings). Internal notes, other clients, prompts and secrets are never
loaded, so they can't leak. Answers cite their sources and suggest follow-up questions.
Rate-limited per user.

## Costs

Estimated from token counts and the pricing table in `src/integrations/ai/pricing.ts`
(update it when provider prices change). Spend is visible per agent and per run, and on
the Business page.
