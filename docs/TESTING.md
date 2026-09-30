# Testing

| Layer           | Tool                                            | Location                      | Command                       |
| --------------- | ----------------------------------------------- | ----------------------------- | ----------------------------- |
| Unit            | Vitest                                          | `src/**/*.test.ts`            | `pnpm test`                   |
| Integration     | Vitest + Postgres (docker compose / CI service) | `tests/integration` (Phase 2) | `pnpm test:integration`       |
| End-to-end      | Playwright (desktop and mobile Chromium)        | `tests/e2e`                   | `pnpm build && pnpm test:e2e` |
| All fast checks | none                                            | none                          | `pnpm check`                  |

Unit tests run with `APP_ENV=test` and the mock adapters, never with a developer's `.env`
and never against live provider APIs.

If Playwright's bundled browser is not downloaded (e.g. sandboxed environments), point it
at an installed Chromium:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e
```

## Current coverage (Phase 1)

- Environment validation, including production refusing mocks and missing credentials
- Feature flags
- Error model: no leakage of internal messages
- Money: parsing, arithmetic and currency safety
- Log redaction
- Integration registry: mocks, not-connected semantics, production guard, health
- Mock adapters: webhook signature verification and tamper rejection, subscription state,
  invoice payment state, calendar busy time, email idempotency, storage path traversal,
  AI mock labelling, social capability enforcement
- E2E: health, home, noindex outside production, security headers, 404

## Required suites (spec §120), by phase

Authentication and authorisation (3), **tenant isolation** (2/3, and on every new
module), documents and file access (9), services and activation (10), lead creation (11),
audit generation (12), proposal acceptance (13), billing, payment webhooks, suspension
and restoration (14), Xero mocks (14), Google mocks (16), agent permissions (17),
workflow engine (20), client portal (8), and the full acceptance run (spec §198) in Phase 21.

## Rules

- Every bug fix comes with a test that fails before the fix.
- Every new tenant-scoped query gets a cross-tenant test.
- Integration adapters get contract tests with recorded or mocked HTTP.
