# Integrations

Every external system sits behind an adapter in `src/integrations/<kind>/`, resolved through
`src/integrations/registry.ts`. Each kind has a mock for development. Production refuses
mocks. If an integration isn't configured, the product says **Not connected** and keeps
working; nothing is faked. Live status: Workspace → Settings → Integrations.

| Kind       | Provider(s)                 | Status in V1                                        | What it does                                                                       | Configure with                                                                                                     |
| ---------- | --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Payments   | Payfast                     | **Built**, REQUIRES CONFIGURATION                   | Once-off checkout, subscriptions, signed ITN webhook with server validation        | `PAYMENT_PROVIDER=payfast`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX` |
| AI         | Anthropic (Claude)          | **Built**, REQUIRES CONFIGURATION                   | Drafting and extraction for agents, with server-side model fallback; costs tracked | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `AI_MODEL`                                                  |
| Email      | Resend or SMTP              | **Built**, REQUIRES CONFIGURATION                   | Transactional and notification email, logged in Settings → Email log               | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, or `EMAIL_PROVIDER=smtp` + `SMTP_URL`; `EMAIL_FROM`                    |
| Storage    | Local disk or S3-compatible | **Built**                                           | Uploads with signed, expiring downloads                                            | `STORAGE_PROVIDER=s3` + `S3_*` for production                                                                      |
| CRM        | Sales Scout                 | **Built (inbound webhook)**, REQUIRES CONFIGURATION | Signed lead import into the pipeline                                               | `CRM_PROVIDER=sales_scout`, `SALES_SCOUT_WEBHOOK_SECRET`                                                           |
| Founder OS | Mea Creo API                | **Built**                                           | Read business, clients, pipeline, tasks; create leads                              | Workspace → Settings → API keys                                                                                    |
| Accounting | Xero                        | Contract + mock; adapter not built                  | Invoice and payment sync                                                           | `ACCOUNTING_PROVIDER=xero`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`                                                 |
| Calendar   | Google Calendar             | Built: OAuth (REST, no SDK), connect in Settings    | Busy times for booking, events with Meet links                                     | `CALENDAR_PROVIDER=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                             |
| Search     | Google Search Console       | Contract + mock; adapter not built                  | Queries, impressions, clicks for reports                                           | `SEARCH_PROVIDER=google` + Google OAuth                                                                            |
| Analytics  | Google Analytics 4          | Contract + mock; adapter not built                  | Sessions and conversions for reports                                               | `ANALYTICS_PROVIDER=google` + Google OAuth                                                                         |
| Social     | LinkedIn                    | Not built by design                                 | Assisted only. No automated LinkedIn actions                                       | n/a                                                                                                                |

"Contract + mock" means the interface, the mock, the settings UI and every call site exist;
until the real adapter is added, the integration reports **Not connected** and the product
uses its fallback (internal calendar only, reports marked "not yet measured", invoices kept
in Mea Creo). See [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md).

## Google Calendar

The calendar lives on **meacreo@gmail.com**; client email stays on **dylan@meacreo.co.za**.
Mea Creo signs in with Google (OAuth). No password is stored, only a refresh token,
encrypted with `ENCRYPTION_KEY` in the `integrations` table.

1. In Google Cloud Console (signed in as meacreo@gmail.com), create a project and enable
   the **Google Calendar API**.
2. OAuth consent screen: External, app name "Mea Creo", support email
   dylan@meacreo.co.za. Scopes: `calendar.events`, `calendar.freebusy`, `openid`, `email`.
   Add meacreo@gmail.com as a test user, or publish the app.
3. Credentials → OAuth client ID → Web application. Authorised redirect URI:
   `https://www.meacreo.co.za/api/integrations/google/callback` (add the staging URL too).
4. Set `CALENDAR_PROVIDER=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
   `ENCRYPTION_KEY` (32+ random characters) in the host's environment, then redeploy.
5. Workspace → Settings → Integrations → **Connect Google Calendar**, and sign in as
   meacreo@gmail.com.

What it does: public and portal bookings exclude busy times from that calendar; new
meetings are added with a Google Meet link, and Google sends the invitations. Disconnect
in the same place (the token is revoked and deleted).

## Payfast

- Checkout: `startCheckout` → adapter builds the signed form → browser posts to Payfast.
- Notifications: `POST /api/webhooks/payments/payfast`. The adapter checks the signature,
  that the request comes from a Payfast host (from the `x-forwarded-for` client IP, so the
  host must pass the real client IP), and confirms with Payfast's validate endpoint. The
  billing handler applies the amount to the invoice: less than the balance is recorded as a
  partial payment and the invoice stays open. Payments are idempotent on
  `(provider, provider_payment_id)`.
- Testing without Payfast: the mock sends you to `/pay/test-checkout`, which posts a signed
  test notification through the same webhook code path. It is disabled whenever a real
  provider is configured, and mocks are refused in production.
- Manual EFT: Workspace → Billing → invoice → Record an EFT payment (same code path).

## Sales Scout

`POST /api/webhooks/sales-scout` with header `x-sales-scout-signature` =
hex HMAC-SHA256 of the raw body using `SALES_SCOUT_WEBHOOK_SECRET`. Body:

```json
{
  "leads": [
    {
      "externalId": "ss-123",
      "company": "Example Ltd",
      "website": "https://example.com",
      "industry": "Engineering",
      "location": "Durban",
      "employeeRange": "11-50",
      "contact": { "name": "Jane", "email": "jane@example.com", "role": "MD" },
      "notes": "…"
    }
  ]
}
```

Imports are idempotent by `externalId`, qualified on arrival, and carry **no consent**:
outreach still needs approval and a lawful basis.

## Founder OS API

Create a key in Workspace → Settings → API keys (shown once, stored hashed). Send
`Authorization: Bearer mc_…`. Rate limit: 120 requests a minute per key.

| Method | Path               | Scope           | Returns                                                             |
| ------ | ------------------ | --------------- | ------------------------------------------------------------------- |
| GET    | `/api/v1/business` | `read:business` | MRR, client counts and health, pipeline, receivables, cash, AI cost |
| GET    | `/api/v1/clients`  | `read:clients`  | Clients with lifecycle, billing state, health and reasons           |
| GET    | `/api/v1/pipeline` | `read:pipeline` | Leads with stage, source and fit                                    |
| GET    | `/api/v1/tasks`    | `read:tasks`    | Open tasks                                                          |
| POST   | `/api/v1/leads`    | `write:leads`   | Creates a lead; returns its id                                      |

Amounts are integer minor units (ZAR cents); AI cost is in micro-USD.

## Adding a provider

1. Implement the kind's interface in `src/integrations/<kind>/<provider>.ts`.
2. Register a factory in `registry.ts` and add its env vars to `src/config/env.ts`,
   `.env.example` and [ENVIRONMENT.md](ENVIRONMENT.md).
3. Add a health check message that tells the admin exactly what's missing.
4. Never import the SDK anywhere else.
