# Integrations

All external systems sit behind the contracts in `src/integrations/<kind>/types.ts`.
Application code asks the registry for an adapter:

```ts
import { getIntegration, resolveIntegration } from "@/integrations/registry";

const payments = getIntegration("payments"); // throws INTEGRATION_NOT_CONNECTED if unavailable

const search = resolveIntegration("search"); // non-throwing: render "Not connected" + Connect
if (!search.available) return <NotConnected health={search.health} />;
```

## Status

| Kind       | Contract             | Mock | Real adapter                       | Phase | Flag                       |
| ---------- | -------------------- | ---- | ---------------------------------- | ----- | -------------------------- |
| payments   | `PaymentProvider`    | ✅   | Payfast ⬜ (later Yoco/Stripe)     | 14    | `FEATURE_PAYFAST`          |
| accounting | `AccountingProvider` | ✅   | Xero ⬜                            | 14    | `FEATURE_XERO`             |
| calendar   | `CalendarProvider`   | ✅   | Google Calendar ⬜ (later Outlook) | 15    | none                       |
| analytics  | `AnalyticsProvider`  | ✅   | Google Analytics 4 ⬜              | 16    | `FEATURE_GOOGLE_ANALYTICS` |
| search     | `SearchProvider`     | ✅   | Google Search Console ⬜           | 16    | `FEATURE_GSC`              |
| ai         | `AIProvider`         | ✅   | Anthropic ⬜ (OpenAI/Google later) | 17    | `FEATURE_AI_AUTOMATION`    |
| email      | `EmailProvider`      | ✅   | SMTP ⬜, Resend ⬜                 | 3     | none                       |
| storage    | `StorageProvider`    | ✅   | S3-compatible ⬜                   | 9     | none                       |
| crm        | `CRMProvider`        | ✅   | Sales Scout ⬜                     | V2    | `FEATURE_SALES_SCOUT`      |
| social     | `SocialProvider`     | ✅   | LinkedIn ⬜ (approved APIs only)   | V2    | `FEATURE_LINKEDIN`         |

## Rules

1. **No fake success.** A provider configured but not implemented reports `NOT_CONNECTED`
   with an explanation. Mocks never fabricate performance data; mock analytics and search
   return empty results.
2. **Mocks are for development and tests only.** Production refuses them twice: in env
   validation and in the registry.
3. **Secrets.** App-level credentials live in environment variables. Per-organisation
   OAuth tokens (Google, Xero) are stored in the `integrations` table, encrypted with
   `ENCRYPTION_KEY` (AES-256-GCM), and never sent to the browser or logged.
4. **Webhooks** are verified before any state change: signature, source and amount
   (Payfast ITN also confirms with Payfast's server). They are idempotent, keyed on the
   provider event id.
5. **External ids are references** (`external_id`, `external_provider`), never primary keys.
6. **Platform terms.** Social providers declare their granted capabilities. Anything not
   granted, such as LinkedIn personal connection requests, is an assisted workflow: the
   system prepares the list and message drafts, and a human performs the action.
7. **Sync jobs** run in the worker with retries and backoff. Failures surface in
   Integration Health, and the admin can retry.

## Adding a real adapter

1. Implement the contract in `src/integrations/<kind>/<provider>.ts`, importing the vendor
   SDK or `fetch` only there.
2. Register it in `factories` in `registry.ts`.
3. Add its env variables to `env.ts` (with conditional requirements), `.env.example` and
   ENVIRONMENT.md.
4. Add contract tests with recorded or mocked HTTP. CI never calls live APIs.
5. Update the status table above.

## Future: Sales Scout and Founder OS

Both stay independent applications. Mea Creo exposes a versioned, HMAC-signed
webhook and API layer (`/api/v1/...`):

- **Sales Scout → Mea Creo:** qualified prospect (company, contact, research, score,
  source, notes). The prospect is created, an audit is queued, and it lands in the CRM.
- **Founder OS ↔ Mea Creo:** read high-level status and metrics, receive tasks and
  notifications, and deep-link into the workspace. No shared database.
