# Implementation plan

The master specification is delivered in dependency order. Each phase ends with the same
gate: **tests pass, errors fixed, UX reviewed, architecture reviewed, docs updated,
committed.** No phase starts with a known critical error in a previous one.

Legend: ✅ done · 🔄 in progress · ⬜ not started

## V1 scope

V1 covers spec §164: website, auth, internal dashboard, clients, workspace, portal,
documents, services, tasks, leads, free visibility audit, CRM, proposals, payments,
calendar, Google architecture, basic SEO and client reporting, approvals, basic agents,
Run Growth, the Mea Creo self-account, admin settings, security and responsive design.

Explicitly **not** in V1 (spec §165): autonomous LinkedIn personal outreach, autonomous
ad-spend changes, autonomous client-facing publishing, HR, complex accounting,
inventory, a SaaS marketplace, unrestricted browser automation and bulk outbound email.

---

## Phase 1: Project setup ✅

- [x] Inspect repository (empty) and live site (see MIGRATION.md)
- [x] Architecture and implementation plan
- [x] Next.js 16, TypeScript strict, Tailwind v4, ESLint, Prettier
- [x] Validated environment config; production refuses mocks and missing secrets
- [x] Feature flags (`FEATURE_*`)
- [x] Structured logging with secret redaction
- [x] User-safe error model
- [x] Money and currency primitives
- [x] Contracts for all 10 integration kinds, a mock adapter for each, and the registry
- [x] Security headers, non-production `noindex`, health endpoint, 404 and error pages
- [x] Vitest unit tests and Playwright smoke tests (desktop and mobile)
- [x] docker-compose for Postgres, Mailpit and MinIO
- [x] CI: lint, format, typecheck, unit, build, E2E
- [x] Documentation set

## Phase 2: Database ⬜

- Drizzle setup, migration workflow, `db:migrate`, `db:seed`, `db:studio` scripts
- Core tables: organisations, users, memberships, roles and permissions, clients,
  contacts, settings, activity_log, domain_events (outbox), integrations
  (encrypted tokens), feature_flag_overrides
- Conventions: UUIDv7 ids, `created_at`/`updated_at`, soft delete where needed, `organisation_id` on tenant tables
- `TenantContext` and base tenant-scoped repository; row-level security policies
- Seed: the Mea Creo organisation, Dylan as owner, and clearly fictional demo data (dev only)
- Tests: migrations apply cleanly on an empty database; RLS blocks cross-tenant reads

## Phase 3: Authentication ⬜

- Better Auth: email/password (hashed), Google OAuth, verification, password reset
- Sessions, CSRF, rate limiting on auth routes, 2FA-ready
- `proxy.ts`: `app.` host rewrite, auth gate for `/app/*`
- Permission checks (`can(ctx, "clients.read")`) and server-side guards
- Invitations for staff and client users
- Tests: authentication, authorisation matrix, tenant isolation (first suite)

## Phase 4: Design system ⬜

- Tokens (colour, type, spacing, radius, shadow) with admin-configurable brand overrides
- Primitives: Button, Link, Input, Select, Textarea, Checkbox, Form field with errors,
  Card, Table, Tabs, Modal/Sheet, Toast, Badge/Status, EmptyState, Skeleton, Chart wrapper
- App shell: workspace sidebar, portal navigation (mobile-first), command palette (⌘K), quick action
- Accessibility pass: keyboard navigation, focus, contrast, labels

## Phase 5: Public website ⬜

- Pages: Home, Visibility, Growth, Automation, Creative, How It Works, About, Work,
  Insights, Free Visibility Audit, Contact, and legal pages
- Content collections in the database: case studies (metrics hidden unless real),
  insights (categories, FAQ, related), portfolio
- SEO: metadata, canonical, Open Graph, JSON-LD (Organization, Service, Article,
  BreadcrumbList, FAQPage only where genuine), sitemap, robots, 404
- Redirect map from the Wix URLs (MIGRATION.md)
- Contact form leads to a lead record. Conversion events tracked.
- Copy follows the brand rules: plain language, no guarantees, no buzzwords

## Phase 6: Admin workspace ⬜

- Command Centre: Today, Clients, Pipeline, Revenue, Agents, Approvals, Tasks,
  System Health, Opportunities (real data only, with useful empty states)
- Setup wizard with completion percentage (company, logo, colours, currency, contacts,
  services, packages, integrations)
- Admin settings: brand, pricing defaults, roles, AI budgets, approval rules, tax,
  currency, legal text, feature-flag overrides, emergency controls
- Global search, notifications (in-app), audit log viewer, integration health

## Phase 7: Clients ⬜

- Client database and internal client view (header plus tabs), client assignments
- Client Brain: structured facts with provenance (`verified`, `unverified`, `ai_suggested`),
  brand rules, approved and restricted claims, goals, KPIs
- Onboarding wizard (15 steps), growth timeline, health status with stated reasons
- Mea Creo "Growth" self-account created as the first client

## Phase 8: Client portal ⬜

- Home, Growth, Services, Work, Approvals, Reports, Leads, Documents, Meetings, Billing,
  Settings. Mobile-first. Client admin can invite members.

## Phase 9: Documents ⬜

- Upload through signed URLs, versioning, tags, categories, search, preview, permissions,
  archive and delete, activity log. Type and size validation. Virus-scan hook point.

## Phase 10: Services and packages ⬜

- Service catalogue as configurable objects (spec §33) and the initial catalogue (§34)
  as editable seed data with **no prices**; prices are entered by the admin
- Package builder, multi-currency price books, tax
- Service activation and deactivation side effects (tasks, agents, KPIs, portal sections)
- Client service requests ("Request" or "Buy" per service configuration)

## Phase 11: CRM and leads ⬜

- Companies, contacts, prospects, deals, activities, notes, owners
- Funnel statuses (spec §19), UTM and consent capture, source tracking
- Prospect scoring as explained dimensions (fit, opportunity, potential, maturity,
  service match, confidence). No single opaque score.
- Acquisition dashboard. CSV import. Sales Scout inbound webhook contract (flagged off).

## Phase 12: Audit engine ⬜

- Public audit form leads to a prospect plus a queued audit job
- Checks: availability, title/meta, headings, robots, sitemap, canonical, structured data,
  Open Graph, internal links, contact and conversion paths, trust signals, content depth,
  entity clarity, FAQ opportunities, speed signals (PageSpeed API when configured)
- Results presented as the "Initial Visibility Snapshot": 8 categories, each with status,
  finding, why it matters and recommended action, plus 3–7 opportunities
- Report email, "Book a strategy call" CTA. SSRF-safe fetcher with rate limits.

## Phase 13: Proposals ⬜

- Proposal builder from client plus package plus configured pricing only
- Web proposal, PDF, email version, acceptance page and workflow
- Acceptance creates the portal account and onboarding tasks, then notifies Mea Creo

## Phase 14: Payments ⬜

- Payfast adapter: once-off, subscription, ITN webhook verification (signature, source IP,
  amount and server confirmation), pause, resume, cancel
- Billing states (spec §40), invoices, payment history, overdue handling that pauses
  configured services while keeping portal access; automatic restore on payment
- Xero adapter (flagged): contacts, invoices, payments, sync status and retry

## Phase 15: Calendar ⬜

- Google Calendar adapter (OAuth), availability from busy times, meeting types with
  configurable durations, public "Book a strategy call", client and internal booking
- Pre-call briefing generated automatically; post-meeting workflow hooks

## Phase 16: Google integrations ⬜

- Per-client OAuth connections to Search Console and GA4
- Scheduled syncs into analytics tables (kept separate: search vs. site analytics)
- Integration health, reconnect flows

## Phase 17: AI layer ⬜

- Anthropic adapter, agent runtime (budgets, limits, retries, timeouts), prompt versioning
- Retrieval over the Client Brain and documents with source references
- Agents first: SEO, AI Visibility, Research, Sales Briefing, Reporting, Quality Control
- Agent observability UI and cost tracking per client, agent and workflow

## Phase 18: Run Growth ⬜

- "Run Growth" per client: executes the configured service workflow (spec §63) and
  produces the run report (Completed, Requires approval, Recommended, Blocked, No action)
- "Approve all safe actions" limited to actions already at the EXECUTE level

## Phase 19: Reporting ⬜

- Report builder: internal and client, web and PDF, email summary, branded
- Always structured as "What happened · Why it matters · What we did · What's next"
- Activity kept separate from outcomes; the monthly client cycle drafts the report for approval

## Phase 20: Automation ⬜

- Workflow engine on the outbox and pg-boss; templates (e.g. invoice overdue)
- Maturity state per workflow (manual, assisted, automated); emergency controls wired up
- Transactional email templates (spec §122)

## Phase 21: Testing ⬜

- Complete the suites in spec §120. Run the full acceptance test (§198) end to end
  with mock providers, then in sandbox mode with Payfast, Google and Xero sandboxes.

## Phase 22: Deployment ⬜

- Staging and production environments, managed Postgres with PITR backups, object
  storage, worker process, domains (`www.` and `app.`), SSL, monitoring and alerts
- Launch checklist and 30-day post-launch monitoring (MIGRATION.md)

---

## Decisions needed from Dylan (not blocking current phases)

| #   | Decision                                                                    | Needed by |
| --- | --------------------------------------------------------------------------- | --------- |
| 1   | Hosting provider for web and worker (recommendation in DEPLOYMENT.md)       | Phase 22  |
| 2   | Confirm `app.meacreo.co.za` for the workspace (DNS access)                  | Phase 3   |
| 3   | Transactional email provider and sending domain (SPF/DKIM)                  | Phase 3   |
| 4   | Payfast merchant account (sandbox first)                                    | Phase 14  |
| 5   | Xero organisation to connect (optional)                                     | Phase 14  |
| 6   | Legitimate testimonials and case studies, with client permission            | Phase 5   |
| 7   | Usage rights for portfolio imagery; which galleries remain public           | Phase 5   |
| 8   | VAT registration status, company registration number and legal address      | Phase 10  |
| 9   | Reviewed legal texts (privacy, terms, cancellation), ideally by an attorney | Phase 5   |
| 10  | Google Search Console access for meacreo.co.za (for redirect priorities)    | Phase 5   |
