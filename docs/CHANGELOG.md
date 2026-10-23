# Changelog

## 0.4.1 — Production on Render + Supabase (2026-10-23)

- `render.yaml` Blueprint (web service, health check, generated secrets, Supabase storage).
- `db:deploy` enables row level security on every public table (closes Supabase's Data API).
- Postgres client disables prepared statements on transaction poolers (port 6543).
- New enquiries email the founder/managers (reply-to the enquirer); contact-form
  enquirers get a confirmation email. Idempotent per lead and recipient.
- Fix: workflow events now run right after each request (they previously needed the
  worker or `/api/cron/jobs`), and are claimed with `FOR UPDATE SKIP LOCKED`.
- Daily cycle via a scheduled GitHub Actions workflow; host-neutral setup wording.
- Home page "What do you need?" tiles for each service (SEO/AEO/GEO, LinkedIn, social media,
  photography and video, websites, apps, AI and business optimisation, lead generation);
  each opens the contact form with that interest preselected and recorded on the lead.
- `/book` embeds Calendly when `CALENDLY_URL` is set.
- SEO/GEO/AEO: Open Graph and Twitter cards with a branded share image, specific page titles
  under 60 characters, `/llms.txt`, FAQ questions as real headings.
- Engine accuracy: `alt=""` counts as decorative; questions followed by an icon are read.

## 0.4.0 — Execution engine (2026-10-22)

- Client → Fixes: reads the live site (home page + up to seven linked pages, robots.txt,
  sitemap, llms.txt) and drafts finished fixes: the exact title, meta description, H1,
  Organization JSON-LD, FAQ section with FAQPage JSON-LD, Open Graph tags, tel: link,
  canonical tag, robots.txt line, sitemap or llms.txt file.
- Every fix records the page, the evidence (source and date), where it goes,
  step-by-step instructions for WordPress, Shopify, Wix, Squarespace or custom sites,
  benefit, dependencies, uncertainty, rollback and history. Fixes are labelled as a
  confirmed issue, an improvement or a hypothesis to test.
- Workflow Draft → Review → Approve → Apply → Verify. Approval needs `approvals.decide`;
  approved work is locked; "Verify" re-reads the live page and only passes when the
  approved change is actually there.
- Content is built only from verified Brain facts and what the crawl observed; when a fix
  would need invented content the run lists what information is missing instead.
- Client profile: website platform field. Portal → Work lists approved, applied and
  verified fixes. Monthly reports count fixes verified live (activity, not outcomes).
- `db:seed`, `db:reset`, `worker` and `admin:create` run with the `react-server`
  condition so server-only modules load outside Next.js.

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
