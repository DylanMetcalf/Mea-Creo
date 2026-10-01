# MEA CREO — V1 PRODUCT WALKTHROUGH

Screens from the demo (fictional companies marked "(Demo)", demo prices). To click through
it yourself: `pnpm dev`, then sign in with the demo accounts in [SETUP.md](SETUP.md).

## Website

**Home.** The positioning, the three outcomes and the two calls to action.

![Home](walkthrough/01-website-home.jpg)

**Free Visibility Report.** A visitor enters their website and contact details (consent is
recorded). About a minute later they get the report.

![Visibility Report form](walkthrough/02-visibility-report-form.jpg)

**The report.** Strengths, things to improve, critical issues and "not yet measured" items,
then the biggest opportunities and findings by area: what's happening, why it matters,
what to do. No made-up overall score.

![Visibility Report result](walkthrough/03-visibility-report-result.jpg)

## Workspace (Mea Creo)

**Command Centre.** What matters today: calls, approvals, overdue work and money, new leads,
clients needing attention.

![Command Centre](walkthrough/04-command-centre.jpg)

**Clients**, and a client's page with health (and the reasons), services and RUN buttons.

![Clients](walkthrough/05-clients.jpg)
![Client overview](walkthrough/06-client-overview.jpg)
![Client services and RUN buttons](walkthrough/07-client-services-run-buttons.jpg)

**Pipeline** by stage, and a lead with explained qualification and their report.

![Pipeline](walkthrough/08-pipeline.jpg)
![Lead](walkthrough/09-lead-qualification.jpg)

**Proposal editor.** Catalogue prices, optional items, content, and a readiness check that
blocks sending while prices are missing or the text promises results.

![Proposal editor](walkthrough/10-proposal-editor.jpg)

**Approvals.** What's being approved, what approving will do, and the decision.

![Approval](walkthrough/11-approval-decision.jpg)

**A run's result.** Each item is completed, waiting for approval, recommended, blocked
(with what's missing) or no action, with the agent log and cost.

![Run result](walkthrough/12-run-result.jpg)
![Agents and costs](walkthrough/13-agents-and-costs.jpg)

**Billing**, **Business**, **approval rules** and **integration health** (what's
connected, what's in test mode, and what needs configuring).

![Billing](walkthrough/14-billing.jpg)
![Business](walkthrough/15-business.jpg)
![Approval rules](walkthrough/16-approval-rules.jpg)
![Integration health](walkthrough/17-integration-health.jpg)

## Client portal

**Home.** What needs them, their services, the latest report, meetings and progress, and
Ask Mea Creo.

![Portal home](walkthrough/18-portal-home.jpg)

**Approving work**, **reading a report**, and **asking a question** (answers use only their
own account's information and say where they came from).

![Portal approval](walkthrough/19-portal-approval.jpg)
![Portal report](walkthrough/20-portal-report.jpg)
![Ask Mea Creo](walkthrough/21-ask-mea-creo.jpg)

**Billing**, **on a phone**, and **an account paused for late payment** (data and portal
still available; a banner explains how to resume).

![Portal billing](walkthrough/22-portal-billing.jpg)
![Portal on a phone](walkthrough/23-portal-mobile.jpg)
![Paused for billing](walkthrough/24-portal-paused-for-billing.jpg)

## Flows to try in the demo

1. **Prospect → client**: Workspace → Proposals → MCP-2026-0001 → Client view → accept →
   Pay online → Simulate successful payment → see the new client in Clients.
2. **Client approval**: sign in as Thandi → Approvals → approve the article → sign in as
   Dylan → the content item moves on and the activity log shows who approved it.
3. **Run Growth**: Clients → Harbourline → Run Growth → watch the run complete.
4. **Late payment**: sign in as Pieter (Veldt) → the paused banner → Billing → Pay online.
5. **Visibility Report**: request one for any real website from the public page.
