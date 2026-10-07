# Deployment

The app is one Next.js build (`output: "standalone"`) plus PostgreSQL, object storage and a
scheduler. Two ways to host it:

| Option                               | Pieces                                                                                                                           | Good for                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **A. Vercel (recommended to start)** | Vercel project, managed Postgres (e.g. Neon or Supabase), S3-compatible bucket (e.g. Cloudflare R2), Vercel Cron → `/api/cron/*` | Least maintenance       |
| **B. A server or container**         | Node process (`node .next/standalone/server.js`), `pnpm worker` process, managed Postgres, S3 bucket or local disk with backups  | Full control, long jobs |

Prices for these services are in [COSTS.md](COSTS.md) as estimates.

## 1. Create the services

1. **Postgres 16** with automated daily backups and point-in-time restore. Copy the
   connection string (use the pooled one on serverless hosts).
2. **Storage bucket** (private) and an access key limited to that bucket.
3. **Email**: a Resend account (or SMTP), with `meacreo.co.za` verified (SPF, DKIM records;
   add DMARC).
4. **Payfast** merchant account (start with the sandbox), if taking online payments.
5. **Anthropic** API key, if enabling AI drafting (budgets cap spend).

## 2. Configure environment variables

Use the production shape in [ENVIRONMENT.md](ENVIRONMENT.md). Generate secrets with
`openssl rand -base64 32`. Set `NEXT_PUBLIC_SITE_URL` to the final domain before the first
build (it's used in emails and payment return URLs).

## 3. Migrate and create the founder account

From a machine with the repository and the production `DATABASE_URL`:

```bash
pnpm install
APP_ENV=production DATABASE_URL=… pnpm db:migrate
APP_ENV=production DATABASE_URL=… NEXT_PUBLIC_SITE_URL=https://www.meacreo.co.za pnpm admin:create --email dylan@meacreo.co.za --name "Dylan Metcalf"
```

`admin:create` also seeds the base data (Mea Creo organisation, settings, service
catalogue without prices, internal client). It prints a one-time link to set the password.
Demo data is never created in production.

Run `pnpm db:migrate` before every release that includes new files in `drizzle/`.

## 4a. Vercel

1. Import the repository; framework Next.js; install `pnpm install`; build `pnpm build`.
2. Add the environment variables (Production and Preview separately; Preview uses
   `APP_ENV=staging`, sandbox credentials and a separate database).
3. Cron: `vercel.json` schedules `GET /api/cron/daily` at 04:00 UTC (06:00 in South
   Africa), which works on every plan. Vercel Cron sends `Authorization: Bearer
$CRON_SECRET` automatically when `CRON_SECRET` is set. On a Pro plan, also add
   `{ "path": "/api/cron/jobs", "schedule": "*/10 * * * *" }`; without it, jobs still run
   right after each request.
4. Deploy, then open `/api/health`.

## 4b. Server or container

```bash
pnpm install --frozen-lockfile
pnpm build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js     # web (PORT=3000)
pnpm worker                         # second process: jobs, daily cycle
```

Run both under a process manager (systemd, Docker, PM2) with automatic restarts, behind a
TLS-terminating proxy that sets `x-forwarded-for`. If `STORAGE_PROVIDER=local`, back up
`.data/uploads` with the database.

## 5. Connect the domain

See [MIGRATION.md](MIGRATION.md) for the step-by-step DNS change at Domains.co.za, the
pre-launch checklist and the rollback plan. **Do not change DNS until the new site is
verified on its temporary URL.**

## 6. After deploying

- Settings → Company: verify every detail, tick "verified".
- Settings → Billing: VAT status, EFT details, terms.
- Services & pricing: real prices, then "I've set real prices".
- Settings → Integrations: everything you configured shows **Connected**.
- Request a Visibility Report for meacreo.co.za; book a test call; send a test invoice to
  yourself and pay it in the Payfast sandbox.
- Set up uptime monitoring on `/api/health` and error alerts from the host's logs.

## Rollback

Every deploy is a build of a commit. Vercel: "Promote" the previous deployment. Server:
check out the previous commit, build, restart. Migrations are additive, so the previous
build runs against the newer schema. Restore the database from backup only for data
problems, never as a routine rollback.
