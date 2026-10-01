# Architecture

Mea Creo is one Next.js application that serves four surfaces from one codebase and one
PostgreSQL database:

| Surface             | Path                                                | Who                          |
| ------------------- | --------------------------------------------------- | ---------------------------- |
| Public website      | `/`, `/services`, `/insights`, `/visibility-report` | Everyone                     |
| Transactional pages | `/proposal/[token]`, `/pay/test-checkout`           | Prospects with a secret link |
| Workspace           | `/workspace/*`                                      | Mea Creo staff               |
| Client portal       | `/portal/*`                                         | Client users                 |
| APIs and webhooks   | `/api/*`                                            | Integrations, cron, files    |

## Stack

| Concern         | Choice                                                        | Why                                                                          |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, Server Components, Server Actions)    | One deployable for site, workspace, portal and APIs.                         |
| Language        | TypeScript (strict)                                           |                                                                              |
| UI              | Tailwind CSS v4 with design tokens, lucide icons              | See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).                                    |
| Database        | PostgreSQL 16 + Drizzle ORM                                   | Embedded PGlite (real Postgres in WebAssembly) for development and the demo. |
| Auth            | Own session auth (scrypt passwords, hashed session tokens)    | No auth vendor; sessions live in our database and can be revoked.            |
| Background work | Postgres job queue (`FOR UPDATE SKIP LOCKED`) + `pnpm worker` | No Redis. Hosts without a worker can use `/api/cron/*`.                      |
| Events          | Domain-event outbox + workflow engine                         | Every important change emits an event; workflows react to it.                |
| AI              | Anthropic (Claude) behind an adapter, with a rules fallback   | The system works fully without AI; AI only improves drafts.                  |
| Payments        | Payfast adapter; mock + test checkout in development          |                                                                              |
| Email           | Resend or SMTP; mock logs to the Email log                    |                                                                              |
| Files           | Local disk (dev) or S3-compatible storage                     | Signed, expiring download URLs; access checked per request.                  |

## Layers and dependency rules

```
app/ (routes, pages, server actions)      ← validation, auth context, redirects
  └─ modules/<domain>/                     ← business logic (one folder per domain)
       ├─ db/ (Drizzle schema + queries)   ← data access
       ├─ agents/ (registry, runtime, QC)  ← AI work, always via the runtime
       └─ integrations/ (registry + adapters) ← the ONLY place vendor SDKs are imported
```

- Pages and actions never import a vendor SDK; they call modules, which resolve providers
  through `src/integrations/registry.ts`.
- Every page and action first calls `requireStaff(permission)` or `requireClient(permission)`.
  Client queries always filter by the **session's** organisation, never an id from the URL.
- Money is integer minor units plus a currency (`src/lib/money.ts`). Errors are `AppError`
  with a user-safe message (`src/lib/errors.ts`).
- Server Actions use `runAction` + `parseForm` (zod) and return `ActionState`, rendered by
  `<ActionForm>` (works without JavaScript).

## Domains (`src/modules`)

| Module         | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| `auth`         | Sessions, passwords, tokens (invite/reset), roles and permissions, rate limits |
| `audits`       | Visibility Report: SSRF-safe fetch, signal parsing, rule-based findings        |
| `leads`        | Explained qualification (fit, opportunity, commercial potential, maturity, …)  |
| `meetings`     | Availability, booking, briefings, note processing                              |
| `proposals`    | Draft from lead, readiness checks, send, public accept/decline, PDF            |
| `onboarding`   | Proposal → client organisation, services, tasks, invoice, invitations          |
| `billing`      | Invoices, checkout, payment webhooks, daily cycle, pause/resume, PDF           |
| `services`     | Catalogue, client service activation and pausing                               |
| `clients`      | Client queries, health (worst condition + reasons)                             |
| `growth`       | Opportunity identification (upsell/cross-sell rules)                           |
| `runs`         | RUN buttons: run kinds and the run engine                                      |
| `approvals`    | Approval levels, hard locks, decisions, executing approved actions             |
| `workflows`    | Event → action rules                                                           |
| `assistant`    | "Ask Mea Creo" for clients, restricted to that client's visible data           |
| `documents`    | Upload validation, storage, versioning, signed downloads                       |
| `scheduler`    | Daily cycle (billing, briefings, monthly review)                               |
| `integrations` | Sales Scout import                                                             |
| `api-keys`     | Hashed, scoped API keys for Founder OS and other tools                         |

## Request flow examples

**Free Visibility Report.** Form → `requestVisibilityReport` creates a lead and an audit,
enqueues `audit.run`, and `kickJobs()` processes it right after the response. The report
page polls until the audit is complete. Findings come from rules over fetched signals, so
the report works without AI.

**Proposal to paying client.** Lead → draft proposal (catalogue prices only) → readiness
check (prices set, contact email, no guarantees) → send → client accepts on
`/proposal/[token]` → onboarding creates the client, services (pending), tasks, the first
invoice and a portal invitation → payment webhook marks the invoice paid and activates
services.

**Approval.** Agents and runs never act directly. They call `requestApproval`; the
effective level comes from the service default, the admin's approval rules, and hard locks
(payments, refunds, contracts, cancellations and budgets always need a person). Approving
runs the attached action through `executeApprovalAction`.

## Background processing

`pnpm worker` loops: once a day it enqueues the **daily cycle** (billing, call briefings,
monthly review on the configured day); every 30 seconds it processes domain events; and it
drains the job queue. Web requests also call `kickJobs()` after responding, so the demo
works without a worker. On serverless hosts, call `/api/cron/daily` daily and
`/api/cron/jobs` every few minutes with `Authorization: Bearer $CRON_SECRET`.

## Environments

Development and demo run with zero infrastructure (PGlite in `.data/`, local file storage,
mock adapters, demo data seeded automatically). Staging and production require
`DATABASE_URL`, `AUTH_SECRET` and `ENCRYPTION_KEY`; production refuses mock adapters.
See [ENVIRONMENT.md](ENVIRONMENT.md) and [DEPLOYMENT.md](DEPLOYMENT.md).
