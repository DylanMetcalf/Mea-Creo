# Security

## Implemented (Phase 1)

- Security headers on every response: HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, restrictive `Permissions-Policy`; `X-Powered-By` removed.
- Non-production deployments are `noindex`.
- Environment validation: production refuses to start with mock adapters or without core secrets.
- Log redaction of tokens, passwords, API keys, authorization headers and cookies.
- User-safe errors: internal messages and stack traces never reach the browser.
- `/api/health` reveals no configuration.
- Storage keys are server-generated and path traversal is rejected.
- Payment contract only supports hosted/tokenised checkout; there are no card fields anywhere.
- Secrets only via environment; `.env*` is git-ignored except `.env.example`.

## Planned controls

| Area                | Control                                                                                                            | Phase |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| Authentication      | Better Auth, hashed passwords, Google OAuth, verification, reset, 2FA (TOTP) for staff                             | 3     |
| Sessions            | HTTP-only, `Secure`, `SameSite=Lax` cookies; rotation; revocation                                                  | 3     |
| CSRF                | Origin checks on server actions and route handlers; SameSite cookies                                               | 3     |
| Rate limiting       | Auth, audit form, contact form, webhooks, AI endpoints (Postgres-backed limiter)                                   | 3/12  |
| Authorisation       | Server-side permission checks on every action and query                                                            | 3     |
| Tenant isolation    | Tenant-scoped repositories plus Postgres RLS plus isolation tests                                                  | 2/3   |
| Input validation    | Zod on every boundary                                                                                              | all   |
| XSS                 | React escaping; sanitised rich text (allow-list); nonce-based CSP                                                  | 4/5   |
| Files               | Signed, short-lived URLs after authorisation; type and size limits                                                 | 9     |
| Integration secrets | AES-256-GCM encryption at rest with `ENCRYPTION_KEY`; key rotation procedure                                       | 14/16 |
| Webhooks            | Signature and source verification, idempotency, replay protection                                                  | 14    |
| SSRF                | Audit fetcher blocks private and link-local ranges and limits redirects, size and time                             | 12    |
| AI                  | Tenant-scoped retrieval, no secrets in prompts, output QC, prompt-injection resistant tool permissions             | 17    |
| Audit log           | Who, what, when, old and new values, source and reason for important changes                                       | 2     |
| Credentials         | Client passwords are never stored in normal records; prefer OAuth; an external secrets manager if ever unavoidable | n/a   |

## Data classes

Public · Prospect · Client · Internal · Financial · Credentials · AI context. Internal and
financial data is never visible in the client portal. Credentials never leave the server.

## Privacy (POPIA / GDPR)

Consent is captured with source and timestamp on every lead. Unsubscribe is honoured on
all outbound messages. Data export and deletion workflows are provided, with accounting
records retained as required by law. The retention policy is configurable.

## Reporting a vulnerability

Email dylan@meacreo.co.za. Do not open a public issue.
