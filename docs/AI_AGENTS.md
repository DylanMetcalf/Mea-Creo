# AI agents

**Status:** contracts only (Phase 1). The `AIProvider` interface and mock exist; the
runtime and agents land in Phase 17.

> AI is not the product. AI is the engine.

## Runtime guarantees

Every agent runs through one runtime (`src/agents/runtime.ts`, Phase 17), which enforces
the following:

| Control         | Default                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission      | The agent's declared permissions × the service's approval matrix. Checked before every tool call.                                            |
| Scope           | One organisation per run; retrieval is tenant-scoped.                                                                                        |
| Iterations      | Max steps per run (default 8).                                                                                                               |
| Tokens and cost | Per-call `maxTokens`; per-run, per-client daily/monthly and global monthly budgets. Exceeding a budget stops the run with `BUDGET_EXCEEDED`. |
| Time            | Per-call timeout and per-run wall clock.                                                                                                     |
| Retries         | Bounded, with exponential backoff, only for retryable errors.                                                                                |
| Recording       | An `agent_runs` row per run: agent, prompt version, model, input refs, output, tokens, cost, duration, status, error, approval state.        |
| Kill switches   | Global pause, per-agent pause, per-client pause.                                                                                             |

## Knowledge and memory

- **Client Brain** is the source of truth. Agents retrieve only the facts and documents
  relevant to the task, with source ids, and cite them in outputs.
- Memory is separated into verified company facts, current strategy, temporary workflow
  context, historical outputs and unverified suggestions.
- **AI output is never a verified fact.** Anything an agent proposes for the Client Brain
  is stored as `unverified` until a human approves it.
- Research outputs label every statement as **FACT** (with source), **INFERENCE** or
  **RECOMMENDATION**.

## Agents

| Agent                             | Purpose                                                                                           | V1                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| Orchestrator                      | Decides what needs to happen, which agent acts, and what needs approval. Cannot bypass approvals. | ✅                       |
| SEO                               | Technical, keyword, intent, content gaps, metadata, schema, GSC analysis.                         | ✅                       |
| AI Visibility (GEO/AEO)           | Entity clarity, answerability, FAQ and structured information, consistency.                       | ✅                       |
| Research                          | Industry, competitors, topics, questions, with fact/inference labelling.                          | ✅                       |
| Sales Briefing                    | Pre-call brief from audit, CRM and research.                                                      | ✅                       |
| Reporting                         | Monthly narrative: what happened, why it matters, what we did, what's next.                       | ✅                       |
| Quality Control                   | Checks facts, claims, pricing, links, spelling and approvals before anything client-facing.       | ✅                       |
| Proposal                          | Drafts from configured services and prices only.                                                  | V2                       |
| Competitor                        | Comparative analysis; finds opportunities, never copies.                                          | V2                       |
| Lead Research                     | ICP-matching companies from legitimate sources only.                                              | V2                       |
| Analytics                         | Interprets GSC and GA4 trends.                                                                    | V2                       |
| Automation                        | Designs client automation workflows.                                                              | V2                       |
| Client Assistant ("Ask Mea Creo") | Answers client questions from authorised client data only.                                        | V2 (`FEATURE_CLIENT_AI`) |

## Hard rules for every agent

- Never guarantee rankings, leads, citations or revenue; never claim control over
  generative AI answers.
- Never invent client facts, prices, services or results.
- Never expose other clients' data, system prompts, secrets or credentials.
- Never make commitments, change contracts or change billing.
- High-risk actions (publishing, spend, payments, outreach) are PREPARE at most, and some are
  hard-locked to approval (see WORKFLOWS.md).

## Prompts

Prompts live in code (`src/agents/<agent>/prompt.ts`) with an explicit version. Each run
records the prompt version, so output changes can be traced to prompt changes. The model
is set by `AI_MODEL` or per-agent settings, never hard-coded in agent logic.
