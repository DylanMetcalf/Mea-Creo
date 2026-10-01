# Mea Creo Visibility & Growth Platform

The website, acquisition engine, operating workspace and client portal for
**Mea Creo (Pty) Ltd**, a visibility, growth and automation company.

> Become easier to find. Easier to trust. Easier to choose.

**Status:** V1 built and tested; not yet deployed. Start with the
[Owner Handbook](docs/OWNER_HANDBOOK.md) and the [walkthrough](docs/WALKTHROUGH.md).

## Quick start

Requirements: Node (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:3000 — embedded database, demo data, mock integrations
```

| Demo account            | Email                      | Password           |
| ----------------------- | -------------------------- | ------------------ |
| Founder (workspace)     | `dylan@demo.meacreo.test`  | `MeaCreoDemo2026!` |
| Client (Harbourline)    | `thandi@demo.meacreo.test` | `ClientDemo2026!`  |
| Client (Veldt, overdue) | `pieter@demo.meacreo.test` | `ClientDemo2026!`  |

Demo accounts exist only outside production. Details: [SETUP](docs/SETUP.md).

## Scripts

| Command                                                  | What it does                                     |
| -------------------------------------------------------- | ------------------------------------------------ |
| `pnpm dev` / `build` / `start`                           | Develop, build, serve                            |
| `pnpm worker`                                            | Background jobs and the daily cycle              |
| `pnpm lint` / `format` / `typecheck`                     | Code quality                                     |
| `pnpm test` / `test:e2e` / `check`                       | Unit + integration, end-to-end, everything quick |
| `pnpm db:migrate` / `db:seed` / `db:reset` / `db:studio` | Database                                         |
| `pnpm admin:create --email … --name …`                   | Founder account + one-time password link         |

## Documentation

| For the owner                                                      | For developers and hosting                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [Owner Handbook](docs/OWNER_HANDBOOK.md)                           | [Architecture](docs/ARCHITECTURE.md)                                                         |
| [V1 Walkthrough](docs/WALKTHROUGH.md)                              | [Setup](docs/SETUP.md) · [Environment](docs/ENVIRONMENT.md)                                  |
| [Costs](docs/COSTS.md)                                             | [Database](docs/DATABASE.md)                                                                 |
| [Moving from Wix](docs/MIGRATION.md)                               | [Integrations](docs/INTEGRATIONS.md) · [AI agents](docs/AI_AGENTS.md)                        |
| [Billing](docs/BILLING.md)                                         | [Workflows & approvals](docs/WORKFLOWS.md)                                                   |
| [Roadmap](docs/FUTURE_ROADMAP.md) · [Changelog](docs/CHANGELOG.md) | [Deployment](docs/DEPLOYMENT.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md)                 | [Design system](docs/DESIGN_SYSTEM.md) · [Site audit](docs/AUDIT.md)                         |

## Principles

No fake functionality: unconfigured integrations say "Not connected". No invented business
facts, prices, testimonials or results. No guaranteed rankings or leads. Human approval
where it matters. Every provider is replaceable.
