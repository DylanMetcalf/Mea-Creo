# Database

PostgreSQL 16 through Drizzle ORM. Schema: `src/db/schema/*.ts`. Migrations: `drizzle/`
(SQL, committed). 49 tables.

## Connections

| Situation                    | Database                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL` set           | PostgreSQL via postgres.js (staging, production, `docker compose`)                |
| No `DATABASE_URL` (dev/demo) | Embedded PGlite in `.data/pglite` (`PGLITE_DIR` to change, `memory://` for tests) |
| Production without a URL     | Refused at startup                                                                |

The embedded database migrates and seeds itself on first use (unless `APP_ENV=test` or
`DEMO_AUTO_SEED=false`). Only one process may open a PGlite directory at a time: don't run
`pnpm db:*` scripts while `pnpm dev` is using the same directory.

## Commands

| Command                                | What it does                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm db:generate`                     | Generate a migration from schema changes (review the SQL before committing) |
| `pnpm db:migrate`                      | Apply migrations                                                            |
| `pnpm db:seed`                         | Migrate, then seed base data (and demo data outside production)             |
| `pnpm db:reset`                        | Development only: delete `.data` and start again                            |
| `pnpm db:studio`                       | Drizzle Studio                                                              |
| `pnpm admin:create --email … --name …` | Create a founder account and print a one-time set-password link             |

## Conventions

- **Ids:** UUIDv7. External ids in `external_id`.
- **Timestamps:** `timestamptz`, stored in UTC, shown in `Africa/Johannesburg`.
- **Money:** integer minor units (`bigint`) plus `currency`. Never floats.
- **Tenancy:** client-owned rows carry `organisation_id`. Isolation is enforced in the
  application layer (every client query filters by the session's organisation) and covered
  by unit and E2E tests. Postgres row-level security is a planned hardening step.
- **Visibility:** `visibility` (`internal` | `client`) on tasks, documents, timeline entries.
- **Provenance:** Client Brain facts carry `source_type`, `source_ref` and `verification`.
- **Files:** the database stores metadata and the storage key only.
- **No hard deletes from the interface:** clients are offboarded, documents archived,
  invoices voided with a reason.
- **Migrations:** additive first; destructive changes in a later release.

## Tables by area

| Area       | Tables                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity   | `organisations` (kind `platform` or `client`, `is_demo`), `users`, `memberships`, `sessions`, `auth_tokens`, `client_assignments`, `api_keys`, `rate_limits`                |
| Clients    | `clients` (lifecycle, billing state, health + reasons, checklist), `contacts`, `client_brain_facts`, `client_goals`, `competitors`, `timeline_entries`, `notes`, `messages` |
| Commercial | `services` (catalogue, prices per currency, run kinds, agents), `packages`, `package_items`, `client_services`, `service_requests`                                          |
| Sales      | `leads` (stage, explained score), `lead_activities`, `audits` (Visibility Reports), `meetings` (briefing, outcome), `proposals`, `proposal_items`                           |
| Billing    | `subscriptions`, `invoices`, `invoice_lines`, `payments` (unique per provider payment id)                                                                                   |
| Work       | `projects`, `tasks`, `approvals` (level, attached action), `documents` (versioned), `reports`, `content_items`                                                              |
| Platform   | `runs`, `agent_runs` (cost, tokens, provider), `jobs`, `domain_events`, `activity_log`, `notifications`, `email_log`, `integrations`, `settings`, `opportunities`           |
| Website    | `insights`, `case_studies` (client permission + verified outcomes)                                                                                                          |

## Seed data

`src/db/seed/base.ts` (all environments): the Mea Creo platform organisation, default
settings, the service catalogue **without prices**, four packages, and Mea Creo's own
client account ("Mea Creo Growth") with facts taken from the current website.

`src/db/seed/demo.ts` (development and demo only): fictional companies clearly labelled
"(Demo)" on `.example` domains, demo prices flagged with `pricesAreDemo`, demo users
(see README), and real engine runs over offline fixture websites so the demo shows actual
engine output rather than hand-written results.
