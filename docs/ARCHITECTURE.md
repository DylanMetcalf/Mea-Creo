# Architecture

Mea Creo Visibility & Growth Platform: the public website, acquisition engine, internal
operating workspace and multi-client portal for Mea Creo (Pty) Ltd.

> Simple front end. Intelligent back end. Measurable outcomes. Human approval where it
> matters. Automation where it is safe. Scalability from day one.

This document records the architecture and the decisions behind it. The phased delivery
plan is in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## 1. Starting point (inspected 2026-09-30)

- **Repository:** empty. No existing code, deployment or assets, so there is nothing to
  preserve or migrate in the repo itself.
- **Live website:** `https://www.meacreo.co.za/` on Wix. It is the source material for
  brand cues, contact details, portfolio and service concepts. The full inventory,
  URL map and content decisions are in [MIGRATION.md](MIGRATION.md).
  - The three testimonials on the live site are Wix template placeholders
    (the names are paired with San Francisco neighbourhoods). They must **not** be migrated.
  - The portfolio project URLs are also still template slugs (`project-title-1` … `-6`).

## 2. Technology decisions

| Concern         | Choice                                                        | Why                                                                                                                                    |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | **Next.js 16** (App Router), React 19, TypeScript strict      | Server rendering for the SEO-critical site and a rich app in one codebase; server actions and route handlers keep secrets server-side. |
| Styling         | **Tailwind CSS v4** with CSS-variable design tokens           | Tokens are brand-configurable at runtime; no component-library lock-in.                                                                |
| Database        | **PostgreSQL 16**                                             | Relational, as specified; runs on Neon, Supabase, RDS, Railway or self-hosted.                                                         |
| ORM/migrations  | **Drizzle ORM + drizzle-kit** (Phase 2)                       | SQL-first, typed, no engine binary. Migrations are plain SQL files that another developer can read.                                    |
| Auth            | **Better Auth** (Phase 3)                                     | Self-hosted in our own database (no auth vendor lock-in); email/password, Google OAuth, password reset, 2FA plugin, sessions.          |
| Validation      | **Zod**                                                       | One schema for forms, API input, env and AI structured output.                                                                         |
| Background jobs | **pg-boss** on PostgreSQL (Phase 17/20)                       | Durable queue, retries and cron without adding Redis. Swappable behind a job interface.                                                |
| File storage    | **S3-compatible** via `StorageProvider`                       | AWS S3, Cloudflare R2, Supabase Storage or MinIO locally; signed URLs only.                                                            |
| Email           | `EmailProvider`: SMTP / Resend                                | Mailpit catches all mail locally.                                                                                                      |
| AI              | `AIProvider`: Anthropic first; OpenAI/Google possible         | Model chosen by env var; prompts versioned in code; usage metered per call.                                                            |
| Payments        | `PaymentProvider`: **Payfast** first; Yoco/Stripe later       | Hosted/tokenised checkout only; card data never touches our servers.                                                                   |
| Accounting      | `AccountingProvider`: **Xero** (OAuth)                        | Optional; Xero ids stored as external references.                                                                                      |
| Logging         | **pino** structured JSON with secret redaction                | Works with any log drain.                                                                                                              |
| Testing         | **Vitest** (unit/integration), **Playwright** (E2E)           | See [TESTING.md](TESTING.md).                                                                                                          |
| Hosting         | Portable `standalone` build. Recommended target in DEPLOYMENT | Web process plus a separate worker process. Nothing depends on a single host vendor.                                                   |

## 3. Shape of the system: a modular monolith

One deployable Next.js application plus one worker process that shares its code.
A monolith is the right size for 1 operator growing to about 100 clients and a small team.
Module boundaries are enforced by folder structure and import rules, so any module can
be split out later if it ever needs to be. The tree below is the target layout; folders appear as their phases land.

```
src/
  app/                    Routes only: thin, no business logic
    (site)/               Public website: home, services, work, insights, audit, contact
    app/                  Authenticated experience (workspace + client portal)
      (workspace)/        Mea Creo staff: command centre, clients, CRM, tasks, agents...
      (portal)/           Client users: growth, work, approvals, reports, billing...
    api/                  Route handlers: webhooks, integrations, health, public API
  modules/                Business domains (added from Phase 2 onward)
    <domain>/
      schema.ts           Drizzle tables for this domain
      repository.ts       Tenant-scoped data access (the only place that queries tables)
      service.ts          Business rules; the unit tests target this layer
      actions.ts          Server actions and route adapters calling the service
      validation.ts       Zod input schemas
      components/         UI specific to this domain
  integrations/           Provider contracts, mock adapters, real adapters, registry
  agents/                 AI agents, prompts (versioned), tools, orchestrator (Phase 17)
  workflows/              Event bus, workflow engine, automation actions (Phase 20)
  components/ui/          Design-system primitives (Phase 4)
  config/                 env, feature flags, site defaults
  lib/                    Cross-cutting: errors, logger, money, auth helpers, crypto
```

Planned domain modules: `organisations`, `users`, `clients`, `client-brain`, `contacts`,
`crm` (prospects, deals, activities), `audits`, `services` (catalogue, packages, pricing),
`proposals`, `billing` (subscriptions, invoices, payments), `documents`, `tasks`,
`meetings`, `approvals`, `reports`, `analytics`, `content`, `notifications`,
`activity` (audit log), `settings`, `knowledge-base`.

### Dependency rules

1. `app/` → `modules/*/actions` → `modules/*/service` → `modules/*/repository` → database.
2. Modules call other modules through their `service` API, never their tables.
3. Nothing outside `integrations/` imports a vendor SDK. Everything goes through the registry.
4. Nothing outside `agents/` calls an `AIProvider` directly.
5. Server-only code imports `server-only` so it can never be bundled to the browser.

## 4. Experiences and URLs

| Audience          | URL (production)        | Notes                                                               |
| ----------------- | ----------------------- | ------------------------------------------------------------------- |
| Public            | `www.meacreo.co.za`     | Static and ISR where possible; indexable in production only.        |
| Staff and clients | `app.meacreo.co.za`     | Same application. `proxy.ts` rewrites the `app.` host to `/app/*`.  |
| Fallback (no DNS) | `www.meacreo.co.za/app` | Path mode works without the subdomain, e.g. on preview deployments. |

After sign-in, the role decides the experience: staff land on the **Command Centre**,
client users on **Your Growth**. The public navigation shows only a subtle "Sign in" link.

## 5. Multi-tenancy

- **Tenants:** every `organisation` is either the platform operator (Mea Creo) or a client
  organisation. Users belong to organisations through `memberships`, which carry a role.
- **Scope:** every tenant-owned row has `organisation_id` (the client it belongs to).
  Internal-only records such as notes, margins, prompts and agent traces carry a
  `visibility` of `internal`, and portal queries always exclude them.
- **Enforcement (defence in depth):**
  1. Every repository method takes a `TenantContext` (`userId`, `organisationId`, role,
     permissions) and adds the scope itself. Callers cannot forget it.
  2. PostgreSQL **row-level security** on tenant tables, keyed on a per-transaction
     `app.organisation_id` setting (Phase 2), so a missed filter still returns nothing.
  3. Authorisation is checked on the server for every action; the UI only hides things.
  4. Explicit cross-tenant isolation tests in CI (Phase 21 gate, started in Phase 3).
- Staff access to client organisations comes from **client assignments** (account manager,
  SEO owner, and so on) plus role, never from being "logged in as" the client.

## 6. Roles

`SUPER_ADMIN`, `ADMIN`, `ACCOUNT_MANAGER`, `TEAM_MEMBER`, `READ_ONLY` (Mea Creo staff),
`CLIENT_ADMIN`, `CLIENT_MEMBER` (client users), and `AGENT` (a service principal for AI
agents with explicit, scoped permissions). Roles map to fine-grained permissions such as
`clients.read` or `billing.manage`; code checks permissions, not role names.

Dylan is the initial `SUPER_ADMIN` and the only active team member. The previous team
listing (Megan Bartie) is not carried over.

## 7. Integrations: adapters everywhere

Ten provider contracts live in `src/integrations/*/types.ts`: Payment, Accounting,
Calendar, Analytics, Search, AI, Email, Storage, CRM and Social. The registry
(`src/integrations/registry.ts`) resolves the configured provider per environment:

- `mock` adapters exist for every kind and are refused in production twice: by env
  validation and by the registry.
- A provider selected in env but not implemented yet reports **NOT_CONNECTED** with an
  explanation. Nothing pretends to work.
- Health for all kinds feeds the admin Integration Health view
  (`CONNECTED | ACTION_REQUIRED | ERROR | NOT_CONNECTED`).
- OAuth tokens (Google, Xero) are encrypted at rest with `ENCRYPTION_KEY`. Integrations
  are per-organisation rows, so each client connects its own Search Console and Analytics.

Details: [INTEGRATIONS.md](INTEGRATIONS.md).

## 8. Events, workflows and approvals

All meaningful state changes emit **domain events** (`lead.created`, `audit.completed`,
`payment.completed`, `invoice.overdue`…) into an outbox table in the same transaction.
The worker delivers them to the **workflow engine**, which evaluates
`WHEN event, IF condition, THEN actions` rules. Every action has an execution level:

| Level       | Meaning                                   |
| ----------- | ----------------------------------------- |
| **SUGGEST** | AI recommends; a human decides.           |
| **PREPARE** | AI prepares everything; a human approves. |
| **EXECUTE** | The system executes automatically.        |

Some action types are hard-coded as **always approval** and no setting can lower them:
payments, refunds, contracts, budget changes and client cancellation.
Details: [WORKFLOWS.md](WORKFLOWS.md).

## 9. AI layer

Modular agents (Orchestrator, SEO, AI Visibility, Research, Competitor, Lead Research,
Sales Briefing, Proposal, Reporting, Client Assistant, Automation, Analytics, Quality
Control) share one runtime that enforces the following:

- permission, scope, budget, max iterations, timeout and retry limits
- retrieval from the **Client Brain**, so each agent gets only what it needs, with source
  references
- the fact / inference / recommendation distinction, and "unverified" status for anything
  AI-generated until a human approves it
- a run record for every call: model, tokens, cost, input, output, status and approval

The orchestrator cannot bypass the approval engine. Details: [AI_AGENTS.md](AI_AGENTS.md).

## 10. Cross-cutting principles

- **No fake functionality.** Unconfigured means "Not connected" plus a Connect button.
  Mock mode is visibly labelled and never fabricates performance numbers.
- **No invented business facts.** Prices, results, testimonials and case-study metrics
  come only from admin-entered data.
- **Money** is integer minor units plus a currency (`src/lib/money.ts`). ZAR is the
  default; USD, GBP, EUR, CAD and AUD are supported. Prices are never hard-coded.
- **Errors** carry a user-safe message (`src/lib/errors.ts`); stack traces never reach a
  browser.
- **Audit log** for every important change: who, what, when, old value, new value,
  source (human or agent) and reason.
- **Emergency controls:** pause all automations, one agent, one client, one service,
  outbound email or payments.
- **Accessibility and performance** are acceptance criteria, not polish.

## 11. Scale assumptions

Designed for about 100 client organisations, 10–20 staff, thousands of documents and tens
of thousands of tasks and events. That is comfortably a single PostgreSQL instance with
sensible indexes. Heavy work (audits, agent runs, report generation, syncs) always runs in
the worker, never in a web request.
