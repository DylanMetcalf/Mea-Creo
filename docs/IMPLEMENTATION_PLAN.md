# Implementation plan

Phases follow the Master Build Directive. Every phase ends with lint, format, typecheck,
unit tests, build and E2E passing, docs updated, committed.

Legend: ✅ done · 🟡 partly done (see notes) · ⬜ not started

## Phase 0: Audit ✅

- [x] Audit of the live Wix site and its content ([AUDIT.md](AUDIT.md), [MIGRATION.md](MIGRATION.md))
- [x] Architecture and plan

## Phase 1: Design system and website ✅

- [x] Tokens, typography, components, accessibility rules ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md))
- [x] Home with the new hero and both CTAs; services and four pillar pages; how it works;
      about (Dylan only); work (permissioned case studies only); insights; contact; booking;
      legal drafts; 404/error pages
- [x] SEO: metadata, Organization/Service/FAQ/Article structured data, sitemap, robots
      (production only indexable), Wix redirects
- [x] Free Visibility Report with consent, rate limits and a shareable report page
- [ ] Owner: real logo vector, photos, bio; legal review

## Phase 2: Auth and workspace ✅

- [x] Sessions, roles and permissions, invitations, password reset, rate limits
- [x] Command Centre, clients (12 tabs), leads, Visibility reports, proposals, approvals,
      tasks, calendar, reports, runs & agents, billing, services & pricing, website content,
      business, settings, notifications, search
- [ ] Staff two-factor authentication

## Phase 3: Client portal ✅

- [x] Home, approvals, work timeline, reports + PDF, services + requests, files, meetings
      booking, billing + pay, messages and support, Ask Mea Creo, notifications, team
- [x] Organisation switching; tenant isolation tested; mobile-first navigation

## Phase 4: Visibility engine ✅

- [x] SSRF-safe crawler, signal parsing, rule-based findings in six areas, competitor
      comparison, opportunities (3–7), no overall score
- [x] Visibility, SEO, AI visibility, competitor and conversion runs
- [ ] Search Console / GA4 data (adapters not built; reported as "not yet measured")

## Phase 5: Sales and onboarding ✅

- [x] Pipeline by stage, explained qualification, CSV import, activity log
- [x] Booking with availability, briefings, note processing → tasks + follow-up approval
- [x] Proposals from leads (catalogue prices only), readiness checks, send, public
      accept/decline, PDF
- [x] Onboarding from acceptance: client, services, Brain facts, goals, tasks, invoice, invitation

## Phase 6: Automation ✅

- [x] Agent registry with permissions; runtime with emergency controls, budgets, cost
      tracking, rules fallback; deterministic QC
- [x] Run engine and ten RUN buttons; approval engine with four levels and hard locks
- [x] Workflow engine on a domain-event outbox; job queue; worker; daily cycle; cron endpoints

## Phase 7: Billing ✅ (Xero 🟡)

- [x] Invoices, Payfast checkout and webhook, test checkout, EFT recording, reminders,
      pause and resume without data loss, invoice PDFs, VAT settings
- [ ] Xero adapter (contract, mock and UI exist)

## Phase 8: Growth intelligence ✅

- [x] Opportunities (upsell and cross-sell rules), client health with reasons, business
      dashboard, targets, Mea Creo's own client account

## Phase 9: Sales Scout 🟡

- [x] Signed inbound webhook with idempotent import
- [ ] Outbound status reporting

## Phase 10: Founder OS ✅

- [x] `/api/v1` read API (business, clients, pipeline, tasks) and lead creation, scoped API keys

## Phase 11: Operating system completion ✅

- [x] Branded PDFs (proposals, invoices, reports, legal) with the Mea Creo lockup and client logos
- [x] Meeting brief (§29 headings), "Meeting complete" → proposal draft (§30), proposal sections (§31)
- [x] Onboarding: delivery plan and reporting baseline (§32)
- [x] Settings → Prospecting (qualification rules, outreach limits) and Settings → Quality
- [x] Fresh prospects: a weekly prospect service per client workspace (not for Mea Creo HQ)
- [x] QA pipeline DRAFT → PUBLISHED with configurable checklists (§34)
- [x] Sales dashboard: funnel, new/lost MRR, win rate, leads by channel
- [x] Cookie consent, GA4 after consent, first-touch attribution on leads
- [x] Google Calendar adapter (OAuth, REST); daily Vercel cron
- [x] Launch checklist with the DNS gate; client testimonials by permission only; portfolio share links
- [ ] Owner: tick legal pages reviewed, connect Google, production env, final QA, DNS

## Open decisions (owner)

1. Real prices for each service (and whether packages are offered as listed).
2. VAT registration status.
3. Which old photography galleries to keep.
4. Hosting choice (Vercel or a server) and accounts to create (see [COSTS.md](COSTS.md)).
5. Launch date for the DNS switch.

## Next to build

See [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md): Google Search Console and GA4 reporting
adapters, Xero, staff 2FA, a prospect data provider for Fresh prospects.
