# Changelog

## 0.1.0 — V1 build (2026-10-01)

First complete version, not yet deployed.

### Added

- **Foundation:** Next.js 16, TypeScript, Tailwind v4 design system, validated environment,
  feature flags, structured logging, error model, money primitives, CI.
- **Data:** 49-table Postgres schema with migrations; embedded Postgres for development;
  base seed (Mea Creo, settings, unpriced catalogue, packages, internal client) and a
  clearly labelled demo built from real engine output.
- **Auth:** sessions, roles (Founder, Manager, Specialist, Creative, Sales, Viewer, Client
  admin, Client member), invitations, password reset, rate limiting, organisation switching.
- **Engines:** Visibility Report (SSRF-safe, rule-based findings), lead qualification,
  client health, opportunities, booking availability, briefings and note processing,
  proposals, onboarding, billing (Payfast, EFT, daily cycle, pause/resume), approvals with
  hard locks, run engine with ten RUN buttons, workflow engine, agents with budgets and QC,
  Ask Mea Creo.
- **Website:** home, services and four pillar pages, how it works, about, work, insights,
  contact, booking, Visibility Report, legal drafts, sitemap, robots, Wix redirects.
- **Workspace:** Command Centre, clients (12 tabs), leads pipeline, Visibility reports,
  proposals, approvals, tasks, calendar, reports, runs & agents, billing, services &
  pricing, website content, business dashboard, settings, notifications, search.
- **Client portal:** home, approvals, work timeline, reports, services, files, meetings,
  billing, messages, Ask Mea Creo, notifications, team; mobile-first.
- **Integrations:** Payfast, Anthropic, Resend/SMTP, S3/local storage, Sales Scout
  webhook, Founder OS API with scoped keys; contracts and mocks for Google and Xero.
- **Operations:** `pnpm worker`, cron endpoints, `pnpm admin:create`, client data export.
- **Docs:** architecture, setup, environment, database, integrations, agents, workflows,
  billing, deployment, migration, security, testing, design system, costs, owner handbook,
  walkthrough, roadmap.
- **Tests:** 59 unit/integration tests and 22 E2E checks (desktop and mobile).
