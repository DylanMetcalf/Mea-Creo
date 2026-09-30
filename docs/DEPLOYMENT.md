# Deployment

**Status:** CI in place (Phase 1). Hosting is provisioned in Phase 22; the provider
decision is Dylan's (see the recommendation below).

## Runtime shape

| Process    | Command (planned)                                                | Notes                                                              |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| Web        | `node server.js` (Next.js standalone) or platform-native Next.js | Stateless; scale horizontally.                                     |
| Worker     | `pnpm worker`                                                    | Long-running pg-boss consumer: jobs, schedules, syncs, agent runs. |
| Migrations | `pnpm db:migrate`                                                | Runs once per release, before the new web version takes traffic.   |

External services: managed PostgreSQL (with PITR), S3-compatible object storage, a
transactional email provider, and a log/error sink.

## Recommended hosting (decision pending)

Portable by design (`output: "standalone"`, no vendor SDKs outside adapters). A
low-maintenance setup for a single operator:

- **Web:** Vercel, for preview deployment per PR, CDN, SSL and custom domains. Or the same
  container platform as the worker.
- **Worker:** a container platform that runs long-lived processes (Railway, Render or Fly.io).
- **Database:** managed Postgres with point-in-time recovery (Neon, Supabase or the same
  platform's managed Postgres). Choose a region close to both the web and worker regions.
- **Storage:** Cloudflare R2 (S3-compatible, no egress fees).

Any of these can be replaced without code changes.

## Environments and pipeline

`feature branch` → PR (CI plus preview deployment on staging-like config with mocks) →
`main` → **staging** (sandbox providers, migrations applied) → manual promotion →
**production**.

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests, build and
Playwright E2E on every PR and on `main`.

## Domains

- `www.meacreo.co.za` (apex redirects to `www`): public site
- `app.meacreo.co.za`: workspace and client portal (same deployment; `proxy.ts` host rewrite)
- HSTS is sent on every response; enable preload only once all subdomains serve HTTPS.

## Backups and recovery

| What          | How                                                                               | Retention                   |
| ------------- | --------------------------------------------------------------------------------- | --------------------------- |
| Database      | Provider PITR plus a nightly `pg_dump` to separate storage in another region      | 30 days PITR, 90 days dumps |
| Files         | Bucket versioning plus a replication or periodic copy to a second bucket          | 90 days of versions         |
| Configuration | Env vars kept in the host's secret store and in a password manager (owner access) | n/a                         |
| Code          | GitHub                                                                            | n/a                         |

**Restore procedure:**

1. Freeze writes by enabling maintenance mode and pausing all automations.
2. Restore the database to a new instance at the target time and run `pnpm db:migrate`.
3. Point `DATABASE_URL` at the new instance and redeploy.
4. Verify with smoke tests and a spot-check of the latest records.
5. Resume automations.

Test the restore quarterly and record the result.

## Monitoring

Structured logs (pino JSON) to a log sink; error tracking on web and worker; uptime check
on `/api/health`; alerts for failed payments, webhook verification failures, integration
errors, agent failures, job queue backlog and budget thresholds.
