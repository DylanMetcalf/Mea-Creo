# Mea Creo Visibility & Growth Platform

The website, acquisition engine, operating workspace and client portal for
**Mea Creo (Pty) Ltd**, a visibility, growth and automation company.

> Help businesses become easier to find, easier to understand and easier to choose.

**Status:** Phase 1 (project foundation) complete. See the
[implementation plan](docs/IMPLEMENTATION_PLAN.md) for what comes next.

## Quick start

Requirements: Node 22+, pnpm 10, Docker (optional, for local Postgres, Mailpit and MinIO).

```bash
pnpm install
cp .env.example .env.local      # defaults run everything on mock adapters
docker compose up -d            # optional until Phase 2
pnpm dev                        # http://localhost:3000
```

## Scripts

| Command          | What it does                                         |
| ---------------- | ---------------------------------------------------- |
| `pnpm dev`       | Development server                                   |
| `pnpm build`     | Production build                                     |
| `pnpm start`     | Serve the production build                           |
| `pnpm lint`      | ESLint                                               |
| `pnpm typecheck` | Generate route types and run the TypeScript compiler |
| `pnpm format`    | Prettier (write)                                     |
| `pnpm test`      | Unit tests                                           |
| `pnpm test:e2e`  | Playwright E2E (run `pnpm build` first)              |
| `pnpm check`     | Lint, typecheck and unit tests                       |

## Documentation

| Doc                                                | About                                           |
| -------------------------------------------------- | ----------------------------------------------- |
| [ARCHITECTURE](docs/ARCHITECTURE.md)               | System shape, decisions, tenancy, principles    |
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) | Phases, checklists, open decisions              |
| [DATABASE](docs/DATABASE.md)                       | Conventions, entities, backups                  |
| [INTEGRATIONS](docs/INTEGRATIONS.md)               | Adapter contracts, status, rules                |
| [AI_AGENTS](docs/AI_AGENTS.md)                     | Agent runtime, guarantees, agents               |
| [WORKFLOWS](docs/WORKFLOWS.md)                     | Events, rules, approval matrix, Run Growth      |
| [DEPLOYMENT](docs/DEPLOYMENT.md)                   | Hosting, pipeline, domains, backups, monitoring |
| [SECURITY](docs/SECURITY.md)                       | Controls in place and planned                   |
| [TESTING](docs/TESTING.md)                         | Test layers and required suites                 |
| [ENVIRONMENT](docs/ENVIRONMENT.md)                 | Every environment variable                      |
| [MIGRATION](docs/MIGRATION.md)                     | Wix inventory, redirect map, launch checklist   |

## Principles

No fake functionality: unconfigured integrations say "Not connected". No invented business
facts, prices or results. Human approval where it matters. Every provider is replaceable.
