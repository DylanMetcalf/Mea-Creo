# Testing

| Command             | What runs                                                                               |
| ------------------- | --------------------------------------------------------------------------------------- |
| `pnpm lint`         | ESLint, zero warnings allowed                                                           |
| `pnpm format:check` | Prettier                                                                                |
| `pnpm typecheck`    | Route types + TypeScript                                                                |
| `pnpm test`         | Vitest unit and integration tests (in-memory Postgres per file)                         |
| `pnpm test:e2e`     | Playwright against a production build, desktop and mobile, on its own embedded database |
| `pnpm check`        | lint + typecheck + test                                                                 |

Before committing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
CI runs all of the above plus E2E on pull requests.

## What's covered

- **Engines:** audit engine on fixture sites (explained findings, 3–7 opportunities, no
  overall score), SSRF address checks, lead qualification, client health, booking
  availability, Payfast signature encoding, proposal totals, QC guarantee blocking.
- **Lifecycle (database):** invoice payment and duplicate notifications, overdue → pause
  without data loss, approval hard locks, cross-tenant approval decisions, Ask Mea Creo
  isolation, API keys, Sales Scout signature and idempotent import, daily cycle.
- **Platform:** env validation (production refuses mocks), feature flags, integration
  registry, mocks, money, errors, logging redaction, markdown sanitising.
- **E2E:** health, security headers, noindex, 404, home hero, founder workspace pages,
  client isolation, contact form, unknown proposal links, Wix redirects.

## Writing tests

- Database tests: `const { db, close } = await testDb()` from `tests/helpers/db.ts` gives a
  migrated, base-seeded in-memory Postgres.
- Use the demo fixtures (`src/db/seed/fixtures.ts`) for anything that fetches websites; tests
  never hit the network.
- E2E: set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a pre-installed Chromium.

## Manual checks before a release

Sign in as each demo role, click through the portal on a phone, request a Visibility Report
for a real site, accept a proposal and pay with the test checkout, approve an item as a
client, run Run Growth, and check Settings → Integrations and Email log.
