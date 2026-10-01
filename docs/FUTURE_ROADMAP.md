# Future roadmap

In priority order. Each item names why it matters and what it unlocks.

## Next (to finish V1 integrations)

1. **Google OAuth + Search Console adapter.** Real search queries, impressions and clicks
   in reports and runs (today: "not yet measured"). Biggest jump in report value.
2. **Google Analytics 4 adapter.** Sessions and conversions for "what changed".
3. **Google Calendar adapter.** Busy times in booking, events with Meet links, no
   double-booking.
4. **Xero adapter.** Push invoices and payments; pull payment status.
5. **Staff two-factor authentication** (TOTP).

## Then

6. **Client-side approval of content in context** (side-by-side diff for page changes).
7. **Content calendar** across clients, with scheduling once approved.
8. **Postgres row-level security** as a second isolation layer.
9. **Content Security Policy** with nonces.
10. **Proposal e-signature audit PDF** (signed acceptance certificate).
11. **Self-service purchases** in the portal for simple services (`FEATURE_SELF_SERVICE`).
12. **Sales Scout outbound** (report lead status back) and a scheduled pull as a fallback.
13. **Founder OS write endpoints** (tasks) and webhooks out.

## Later

- Google Ads reporting adapter (read-only first; budget changes always manual).
- LinkedIn assisted workflows (drafts and reminders only; no automation of personal accounts).
- Multi-currency Payfast alternatives for international clients (e.g. Stripe or PayPal adapters).
- Portfolio/creative gallery for photography and video work.
- White-label portal for partner agencies.

## Explicitly not planned

Autonomous LinkedIn outreach, autonomous ad-spend changes, autonomous publishing to client
channels, bulk cold email, and anything that bypasses a platform's rules.
