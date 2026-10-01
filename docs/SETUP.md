# Local setup

## Requirements

Node.js (version in `.nvmrc`) and pnpm. Docker is optional.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

That's all. With no `DATABASE_URL`, the app uses an embedded Postgres in `.data/pglite`,
migrates it and seeds demo data on the first request (about 10 seconds). Uploads go to
`.data/uploads`. All integrations use mocks.

Sign in at `/login` with a demo account (shown on the login page in development):

| Role                    | Email                      | Password           |
| ----------------------- | -------------------------- | ------------------ |
| Founder (workspace)     | `dylan@demo.meacreo.test`  | `MeaCreoDemo2026!` |
| Client: Harbourline     | `thandi@demo.meacreo.test` | `ClientDemo2026!`  |
| Client: Veldt (overdue) | `pieter@demo.meacreo.test` | `ClientDemo2026!`  |

Optional: `pnpm worker` in a second terminal processes jobs on a schedule. Without it,
jobs still run right after each request.

## Useful commands

```bash
pnpm db:reset        # start again with fresh demo data (stop pnpm dev first)
pnpm db:studio       # browse the database
pnpm check           # lint + typecheck + unit tests
pnpm test:e2e        # end-to-end (builds first: pnpm build)
```

## Using real Postgres, email and storage locally

```bash
docker compose up -d   # Postgres :5432, Mailpit :8025, MinIO :9001
```

Then in `.env.local`:

```
DATABASE_URL=postgres://meacreo:meacreo@localhost:5432/meacreo
EMAIL_PROVIDER=smtp
SMTP_URL=smtp://localhost:1025
```

and run `pnpm db:seed`.

## Trying integrations safely

- Payments: leave `PAYMENT_PROVIDER=mock`; "Pay" opens the test checkout.
- AI: set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in `.env.local`; budgets in
  Settings → AI & costs keep spend capped.
- Email: mock emails appear in Workspace → Settings → Email log.

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing code, and the Next.js guides in
`node_modules/next/dist/docs/` (this Next.js version differs from older ones).
