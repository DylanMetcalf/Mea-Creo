# Changelog

## 0.3.0 — Operating system completion (2026-10-07)

- Branded PDFs for proposals, invoices, reports and legal documents: night header band,
  Mea Creo lockup, client logo, consistent footer. POPIA statement downloadable as PDF.
- Meeting brief with the sixteen handoff headings; "Meeting complete" drafts the proposal;
  proposals follow the handoff's section order with next steps.
- Onboarding adds a delivery plan and a reporting baseline.
- Settings: Prospecting (qualification and outreach limits), Quality (QA checklist),
  Google Calendar connection.
- Fresh prospects: weekly researched prospects for client workspaces, released to the
  portal after review, with CSV export.
- Quality pipeline from draft to published with client review through Approvals.
- Sales dashboard on the Business page; first-touch attribution with consent.
- Cookie consent banner; GA4 only after consent.
- Google Calendar adapter (OAuth, REST); `vercel.json` daily cron.
- Launch checklist with the DNS gate.
- Light/dark theme, PWA manifest, new logo, client logos and workspace switcher,
  portfolio share links, permission-based testimonials, updated POPIA statement.

## 0.2.0 — Premium redesign and acquisition loop (2026-10-02)

- Design system rebuilt as a premium technology brand: escarpment palette, gradient
  tokens, Manrope/Geist/Geist Mono, depth and motion tokens (docs/DESIGN_SYSTEM.md).
- Website: new home page rhythm, hero signal visual, dark sections, founder photography,
  aurora page headers, dark footer, premium package cards, split sign-in page.
- Visibility Report: Mea Creo Visibility Index (own measure, method explained).
- Workspace: night sidebar, breadcrumb, ⌘K command palette, redesigned Command Centre.
- Portal: personalised welcome with Index and trust signals; Ask Mea Creo suggestions.
- Component library additions and /workspace/design-system showcase.
- Prospect research, intelligence brief, nine-dimension qualification and
  permission-based outreach (POPIA s69) with opt-out suppression.

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
