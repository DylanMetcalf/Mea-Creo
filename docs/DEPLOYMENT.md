# Deployment

The app is one Next.js build (`output: "standalone"`) plus PostgreSQL, object storage and a
scheduler. Two ways to host it:

| Option                               | Pieces                                                                                                                           | Good for                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **A. Vercel (recommended to start)** | Vercel project, managed Postgres (e.g. Neon or Supabase), S3-compatible bucket (e.g. Cloudflare R2), Vercel Cron → `/api/cron/*` | Least maintenance       |
| **B. A server or container**         | Node process (`node .next/standalone/server.js`), `pnpm worker` process, managed Postgres, S3 bucket or local disk with backups  | Full control, long jobs |

Prices for these services are in [COSTS.md](COSTS.md) as estimates.

## Production: Render + Supabase (current plan)

`render.yaml` describes the whole service; Render reads it as a Blueprint.

| Piece       | Choice                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Web         | Render **Web Service**, Node 22, region Frankfurt, instance `0.5c-512mb` (always on)              |
| Build       | `corepack enable && pnpm install --frozen-lockfile && pnpm db:deploy && pnpm build`               |
| Start       | `pnpm start` (honours Render's `PORT`); health check `/api/health`                                |
| Branch      | `claude/adoring-ptolemy-hloaac` (the repository's only and default branch), auto-deploy           |
| Database    | Supabase Postgres (project ref `udzxayyxtqkjeuogoutu`, eu-west-1) via the **session pooler**      |
| Files       | Supabase Storage, private bucket `mea-creo-private`, through its S3 endpoint                      |
| Email       | Resend (domain `meacreo.co.za` verified with DNS records)                                         |
| Daily cycle | GitHub Actions workflow `Daily cycle` calls `/api/cron/daily` (secrets `SITE_URL`, `CRON_SECRET`) |
| Jobs/events | Run in the web process right after each request; no worker service                                |

Notes:

- **Connection string:** Supabase → Connect → Session pooler (port 5432, IPv4). Render has
  no IPv6 egress, and the direct `db.<ref>.supabase.co` host is IPv6-only. Append
  `?sslmode=require`. The transaction pooler (6543) also works: the client turns off
  prepared statements for it automatically.
- **Row level security:** `db:deploy` enables RLS on every table in `public` with no
  policies. The app connects as the table owner, so it is unaffected; Supabase's Data API
  roles (`anon`, `authenticated`) can read and write nothing. The app does not use
  Supabase Auth or the Data API: sign-in, sessions and permissions are the app's own,
  checked on the server.
- **Storage keys:** Supabase → Storage → S3 → enable the connection, create an access key.
  The key bypasses storage policies, so it lives only in Render's environment.
- **Rollback:** Render → the service → Events → pick the previous successful deploy →
  Rollback. Migrations are additive, so the previous build runs on the newer schema.
- **Logs:** Render → the service → Logs. Database: Supabase → Logs.

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

## 3. Prepare the database and create the founder account

**On Vercel nothing needs a terminal.**

- The database is prepared on every deploy: `vercel.json` runs `pnpm db:deploy` before
  `pnpm build`, which applies migrations and the base data (Mea Creo organisation,
  settings, service catalogue, internal client). It never creates demo data and is safe to
  run repeatedly. It uses `DATABASE_URL_UNPOOLED` when the host provides one (Neon does).
- The founder account is created in the browser: set `SETUP_TOKEN` (16+ characters only you
  know), deploy, open `/setup`, enter the code, your name, email and a password. You are
  signed in and taken to **Launch**. The page closes for good once a founder exists; then
  delete `SETUP_TOKEN` (the Launch page reminds you).

Without Vercel (a server), the same steps from a terminal:

```bash
pnpm install
APP_ENV=production DATABASE_URL=… pnpm db:deploy
APP_ENV=production DATABASE_URL=… NEXT_PUBLIC_SITE_URL=https://www.meacreo.co.za pnpm admin:create --email dylan@meacreo.co.za --name "Dylan Metcalf"
```

`admin:create` prints a one-time link to set the password. Run `pnpm db:deploy` before
every release that includes new files in `drizzle/`.

## 4a. Vercel

1. Import the repository; framework Next.js. The build command comes from `vercel.json`
   (`pnpm db:deploy && pnpm build`).
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
