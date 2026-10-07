# Environment

Configuration comes from environment variables, validated at startup by
[`src/config/env.ts`](../src/config/env.ts). `.env.example` is the template; copy it to
`.env.local` for development. **Never commit real values.** Secrets stay on the server.

## Environments

| `APP_ENV`     | Purpose                   | Mock adapters | Indexable | Required                                               |
| ------------- | ------------------------- | ------------- | --------- | ------------------------------------------------------ |
| `development` | Local machine, demo       | Allowed       | No        | Nothing                                                |
| `test`        | Automated tests           | Allowed       | No        | Nothing                                                |
| `staging`     | Pre-production, sandboxes | Allowed       | No        | `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`        |
| `production`  | Live                      | **Refused**   | Yes       | As staging, plus credentials for every provider in use |

## Core

| Variable               | Default                 | Description                                                                             |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `APP_ENV`              | `development`           | See above                                                                               |
| `LOG_LEVEL`            | `info`                  | `trace`…`fatal`, or `silent`                                                            |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical public URL: links in emails, payment return URLs, sitemap, metadata           |
| `NEXT_PUBLIC_APP_URL`  | `http://localhost:3000` | Reserved for a separate app domain; currently everything is served from the site URL    |
| `DATABASE_URL`         | none                    | PostgreSQL connection string. Without it (non-production) the embedded database is used |
| `DATABASE_POOL_SIZE`   | `10`                    | Postgres connections per process                                                        |
| `AUTH_SECRET`          | none                    | Signs local file download URLs. `openssl rand -base64 32`                               |
| `ENCRYPTION_KEY`       | none                    | 32-byte base64 key; encrypts integration tokens at rest                                 |
| `CRON_SECRET`          | none                    | Bearer secret for `/api/cron/daily` and `/api/cron/jobs` (hosts without a worker)       |

## Development and operations

| Variable                         | Default               | Description                                                                |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| `PGLITE_DIR`                     | `.data/pglite`        | Embedded database location; `memory://` for throwaway                      |
| `DEMO_MODE`                      | on outside production | `false` hides demo accounts and skips demo data                            |
| `DEMO_AUTO_SEED`                 | on                    | `false` stops the embedded database seeding itself                         |
| `JOBS_INLINE`                    | on                    | `false` leaves all jobs to `pnpm worker` instead of running after requests |
| `WORKER_POLL_MS`                 | `3000`                | Worker idle poll interval                                                  |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | none                  | Use a pre-installed Chromium for E2E                                       |

## Integrations

| Variable                                                                            | Default                             | Description                                                                 |
| ----------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `AI_PROVIDER`                                                                       | `mock`                              | `none` (rules mode only), `mock`, `anthropic` (`openai`, `google` reserved) |
| `AI_MODEL`                                                                          | none                                | Override the default model (`claude-opus-5-5`)                              |
| `ANTHROPIC_API_KEY`                                                                 | none                                | Required when `AI_PROVIDER=anthropic`                                       |
| `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`                                              | none                                | Reserved for future providers                                               |
| `AI_MONTHLY_BUDGET_USD`                                                             | `50`                                | Initial budget; the live budget is edited in Settings → AI & costs          |
| `EMAIL_PROVIDER`                                                                    | `mock`                              | `mock`, `smtp` or `resend`                                                  |
| `EMAIL_FROM`                                                                        | `Mea Creo <no-reply@meacreo.co.za>` | Sender. The domain must be verified with the provider                       |
| `SMTP_URL` / `RESEND_API_KEY`                                                       | none                                | Per provider                                                                |
| `STORAGE_PROVIDER`                                                                  | `local`                             | `mock`, `local` or `s3`                                                     |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | none / `auto`                       | S3-compatible storage (AWS, Cloudflare R2, MinIO)                           |
| `PAYMENT_PROVIDER`                                                                  | `mock`                              | `none`, `mock` or `payfast`                                                 |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`                 | none                                | From the Payfast dashboard                                                  |
| `PAYFAST_SANDBOX`                                                                   | `false`                             | `true` to use the Payfast sandbox                                           |
| `ACCOUNTING_PROVIDER`                                                               | `none`                              | `none`, `mock`, `xero` (adapter not built yet)                              |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET`                                             | none                                | Xero app credentials                                                        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                         | none                                | Google OAuth app (Calendar, Search Console, Analytics)                      |
| `CALENDAR_PROVIDER`                                                                 | `mock`                              | `none`, `mock`, `google` (adapter not built yet)                            |
| `ANALYTICS_PROVIDER`                                                                | `mock`                              | `none`, `mock`, `google` (adapter not built yet)                            |
| `SEARCH_PROVIDER`                                                                   | `mock`                              | `none`, `mock`, `google` (adapter not built yet)                            |
| `CRM_PROVIDER`                                                                      | `none`                              | `none`, `mock`, `sales_scout`                                               |
| `SALES_SCOUT_WEBHOOK_SECRET`                                                        | none                                | HMAC secret for inbound Sales Scout webhooks                                |
| `SOCIAL_PROVIDER`                                                                   | `none`                              | Reserved; LinkedIn stays assisted-only                                      |

## Website analytics

| Variable            | Default | Purpose                                                                                                     |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `GA_MEASUREMENT_ID` | none    | GA4 id (`G-…`). Loaded only when `FEATURE_GOOGLE_ANALYTICS=true` **and** the visitor accepts analytics cookies |

## Feature flags

`FEATURE_XERO`, `FEATURE_PAYFAST`, `FEATURE_GOOGLE_ANALYTICS`, `FEATURE_GSC`,
`FEATURE_AI_AUTOMATION`, `FEATURE_SALES_SCOUT`, `FEATURE_CLIENT_AI`,
`FEATURE_SELF_SERVICE`, `FEATURE_LINKEDIN`: all default `false`. See `src/config/flags.ts`.

## A production `.env` (shape only)

```
APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://www.meacreo.co.za
DATABASE_URL=postgres://…
AUTH_SECRET=…
ENCRYPTION_KEY=…
CRON_SECRET=…            # only if there is no worker process
AI_PROVIDER=none         # or anthropic + ANTHROPIC_API_KEY
EMAIL_PROVIDER=resend
RESEND_API_KEY=…
EMAIL_FROM=Mea Creo <hello@meacreo.co.za>
STORAGE_PROVIDER=s3
S3_…=…
PAYMENT_PROVIDER=payfast # or none until Payfast is set up
PAYFAST_…=…
ACCOUNTING_PROVIDER=none
CALENDAR_PROVIDER=none
ANALYTICS_PROVIDER=none
SEARCH_PROVIDER=none
CRM_PROVIDER=none
DEMO_MODE=false
```
