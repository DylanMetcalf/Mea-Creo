# Environment

Configuration is read from environment variables, validated by
[`src/config/env.ts`](../src/config/env.ts). `.env.example` is the template; copy it to
`.env.local` for development. **Never commit real values.**

## Environments

| `APP_ENV`     | Purpose                             | Mock adapters | Indexable | Secrets required                                            |
| ------------- | ----------------------------------- | ------------- | --------- | ----------------------------------------------------------- |
| `development` | Local machine                       | Allowed       | No        | None                                                        |
| `test`        | Automated tests (set by test setup) | Allowed       | No        | None                                                        |
| `staging`     | Pre-production, sandbox providers   | Allowed       | No        | `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`             |
| `production`  | Live                                | **Refused**   | Yes       | As staging, plus real credentials for every provider in use |

Production credentials are never used locally. Staging uses provider sandboxes
(Payfast sandbox, Xero demo company, a test Google property).

## Variables

| Variable                                                                            | Default                     | Description                                                                                                         |
| ----------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                           | `development`               | See the table above.                                                                                                |
| `LOG_LEVEL`                                                                         | `info`                      | `trace`…`fatal`, or `silent`.                                                                                       |
| `NEXT_PUBLIC_SITE_URL`                                                              | `http://localhost:3000`     | Canonical public URL. Used for metadata, sitemap and callback URLs.                                                 |
| `NEXT_PUBLIC_APP_URL`                                                               | `http://localhost:3000/app` | Workspace and portal base URL (`https://app.meacreo.co.za` in production).                                          |
| `DATABASE_URL`                                                                      | none                        | PostgreSQL connection string.                                                                                       |
| `AUTH_SECRET`                                                                       | none                        | Session signing secret. `openssl rand -base64 32`.                                                                  |
| `ENCRYPTION_KEY`                                                                    | none                        | 32-byte base64 key for encrypting OAuth tokens at rest.                                                             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                         | none                        | Google OAuth: sign-in, Calendar, Search Console, Analytics.                                                         |
| `AI_PROVIDER`                                                                       | `mock`                      | `mock`, `anthropic`, `openai` or `google`.                                                                          |
| `AI_MODEL`                                                                          | provider default            | Model id for the selected provider.                                                                                 |
| `ANTHROPIC_API_KEY` etc.                                                            | none                        | Required for the selected AI provider.                                                                              |
| `AI_MONTHLY_BUDGET_USD`                                                             | `50`                        | Global monthly AI spend ceiling. Per-client budgets are set in admin.                                               |
| `EMAIL_PROVIDER`                                                                    | `mock`                      | `mock`, `smtp` or `resend`.                                                                                         |
| `EMAIL_FROM`                                                                        | `Mea Creo <no-reply@…>`     | Default sender.                                                                                                     |
| `SMTP_URL`                                                                          | none                        | e.g. `smtp://localhost:1025` for Mailpit.                                                                           |
| `RESEND_API_KEY`                                                                    | none                        | Required when `EMAIL_PROVIDER=resend`.                                                                              |
| `STORAGE_PROVIDER`                                                                  | `mock`                      | `mock` or `s3` (any S3-compatible store).                                                                           |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | none                        | Object storage.                                                                                                     |
| `PAYMENT_PROVIDER`                                                                  | `mock`                      | `none`, `mock` or `payfast`.                                                                                        |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`                 | none                        | Payfast credentials.                                                                                                |
| `PAYFAST_SANDBOX`                                                                   | `false`                     | Use the Payfast sandbox.                                                                                            |
| `ACCOUNTING_PROVIDER`                                                               | `none`                      | `none`, `mock` or `xero`.                                                                                           |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET`                                             | none                        | Xero OAuth app.                                                                                                     |
| `CALENDAR_PROVIDER`                                                                 | `mock`                      | `none`, `mock` or `google`.                                                                                         |
| `ANALYTICS_PROVIDER`                                                                | `mock`                      | `none`, `mock` or `google` (GA4).                                                                                   |
| `SEARCH_PROVIDER`                                                                   | `mock`                      | `none`, `mock` or `google` (Search Console).                                                                        |
| `CRM_PROVIDER`                                                                      | `none`                      | `none`, `mock` or `sales_scout`.                                                                                    |
| `SALES_SCOUT_WEBHOOK_SECRET`                                                        | none                        | HMAC secret for inbound Sales Scout webhooks.                                                                       |
| `SOCIAL_PROVIDER`                                                                   | `none`                      | `none`, `mock` or `linkedin`.                                                                                       |
| `FEATURE_*`                                                                         | `false`                     | Feature flags: XERO, PAYFAST, GOOGLE_ANALYTICS, GSC, AI_AUTOMATION, SALES_SCOUT, CLIENT_AI, SELF_SERVICE, LINKEDIN. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE`                                                    | none                        | Optional path to a pre-installed Chromium for E2E tests.                                                            |

Validation rules:

- Selecting a real provider makes its credentials required.
- Any Google provider requires the Google OAuth client and `ENCRYPTION_KEY`.
- `APP_ENV=production` with any `*_PROVIDER=mock` fails at startup.

When you add a variable, update `env.ts`, `.env.example` and this table together.
