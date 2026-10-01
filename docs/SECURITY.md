# Security

## What's in place

| Area               | Implementation                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords          | scrypt (N=2^17), per-password salt, minimum length; never logged                                                                                                                                        |
| Sessions           | Random tokens stored as SHA-256 hashes; `mc_session` cookie is HTTP-only, `SameSite=Lax`, `Secure` in production; 30-day sliding expiry; sign-out deletes the session                                   |
| Login protection   | Rate-limited per IP + email (failed attempts only); generic error messages; no account enumeration on reset                                                                                             |
| Invites and resets | Single-use, expiring, hashed tokens                                                                                                                                                                     |
| Authorisation      | Role → permission map (`src/modules/auth/permissions.ts`). Every page and action calls `requireStaff(permission)` or `requireClient(permission)`. Staff without "all clients" see only assigned clients |
| Tenant isolation   | Client queries always use the session's organisation; other organisations' records return 404. Covered by unit and E2E tests                                                                            |
| Server Actions     | Next.js origin checks; zod validation on every input; user-safe errors only                                                                                                                             |
| Public forms       | Honeypots, per-IP and per-email rate limits, recorded consent                                                                                                                                           |
| Visibility Report  | SSRF-safe fetcher: http(s) only, DNS checked against private, loopback, link-local and metadata ranges on every redirect hop, size and time limits                                                      |
| Files              | Type and size allow-list; random storage keys; access checked per download; 5-minute signed URLs                                                                                                        |
| Webhooks           | Payfast: signature, source host, server-side validation, idempotency. Sales Scout: HMAC-SHA256 with constant-time compare                                                                               |
| API keys           | Shown once, stored as SHA-256 hashes, scoped, revocable, rate-limited                                                                                                                                   |
| Secrets            | Environment variables only, validated at startup; integration tokens encrypted with AES-256-GCM (`ENCRYPTION_KEY`); never sent to the browser                                                           |
| Markdown           | Rendered through a sanitiser allow-list (no scripts, handlers or `javascript:` links)                                                                                                                   |
| Headers            | HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, permissions policy; `X-Powered-By` removed                                                                                            |
| AI                 | Agents can't send, publish, pay or sign; budgets cap spend; Ask Mea Creo reads only the client's own visible data                                                                                       |
| Audit trail        | Activity log of who did what (before/after, reason, IP for logins); append-only from the interface                                                                                                      |
| Production guards  | Refuses mock adapters and missing secrets; non-production is `noindex`                                                                                                                                  |
| Data rights        | Full JSON export per client (POPIA access requests); no hard deletes from the interface                                                                                                                 |

## Before launch

- [ ] Set strong `AUTH_SECRET` and `ENCRYPTION_KEY` (`openssl rand -base64 32`), unique per environment
- [ ] Use managed Postgres with encryption at rest, automated backups, and a tested restore
- [ ] Use S3-compatible storage with a private bucket
- [ ] Ensure the host passes the real client IP in `x-forwarded-for` (Payfast source checks, rate limits)
- [ ] Create the founder account with `pnpm admin:create`; don't seed demo data in production
- [ ] Turn on 2-factor authentication on every provider account (host, database, Payfast, Google, Anthropic, domain registrar)
- [ ] Legal review of the privacy policy, terms and cookie notice
- [ ] Run `pnpm audit` and review dependency advisories

## Known gaps (planned)

- Two-factor authentication for staff sign-in
- Postgres row-level security as a second layer behind application checks
- Content Security Policy header (needs a nonce strategy for inline JSON-LD)
- Automated malware scanning of uploads (files are never executed or served inline as HTML)

## Reporting a vulnerability

Email the address on the Contact page. Please don't test against client data.
