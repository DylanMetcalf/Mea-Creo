@AGENTS.md

# Project conventions

- Master product spec lives with the owner; the working plan is `docs/IMPLEMENTATION_PLAN.md`.
  Update its checklist when a phase item lands.
- Architecture and dependency rules: `docs/ARCHITECTURE.md` (routes → actions → service → repository).
- Never import a vendor SDK outside `src/integrations/`; resolve providers via `src/integrations/registry.ts`.
- No fake functionality, no invented business facts, prices, testimonials or results.
- Money is integer minor units + currency (`src/lib/money.ts`). Errors use `AppError` (`src/lib/errors.ts`).
- New env vars: update `src/config/env.ts`, `.env.example` and `docs/ENVIRONMENT.md` together.
- Before committing: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
