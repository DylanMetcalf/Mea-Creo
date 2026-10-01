# MEA CREO — OWNER HANDBOOK

A plain-English guide to running Mea Creo on the new platform. No technical knowledge
needed. Screenshots: [WALKTHROUGH.md](WALKTHROUGH.md).

---

## 1. What you have

One system that does four jobs:

1. **Your website** (meacreo.co.za). It explains what Mea Creo does and turns visitors into
   enquiries, mainly through the **free Visibility Report**: a visitor enters their website
   and gets a structured report in about a minute.
2. **Your workspace** (`/workspace`). Your office: clients, leads, proposals, tasks,
   approvals, calendar, billing, reports and settings.
3. **The client portal** (`/portal`). What clients see: progress, approvals, reports, files,
   meetings, invoices, messages, and "Ask Mea Creo".
4. **The engines.** Software that does the repetitive work (audits, qualification, briefings,
   report drafts, health checks, billing reminders) and asks a person before anything
   important happens.

**The promise you can make clients:** nothing is published, sent or charged on their behalf
without the approval they agreed to, and reports show honestly what was done and what
changed. Never promise rankings or leads; the system won't let proposals or reports say it.

---

## 2. Your first day (setup)

Work through these once, in this order. Everything is in **Workspace → Settings**.

1. **Company**: check every detail (copied from the old website). Add registration and VAT
   numbers if you have them. Tick "verified".
2. **Billing**: are you VAT registered? Add your bank details for EFT (they print on
   invoices). Set payment terms and when to pause unpaid accounts.
3. **Services & pricing** (left menu): enter your real prices for each service. Then press
   "I've set real prices". Until then, everything warns that prices are placeholders.
4. **Availability**: the days and hours people can book calls.
5. **Approvals & workflows**: the defaults are sensible. Payments, refunds, contracts,
   cancellations and budget changes always need you, whatever you set.
6. **Integrations**: shows what's connected. Anything marked "REQUIRES CONFIGURATION" needs
   an account or key (see section 9).
7. **Team**: you're the founder. Only invite real people.

---

## 3. A normal day

Open **Command Centre** (the first page after signing in). It answers "what matters
today?": calls, approvals waiting for you, overdue tasks, overdue invoices, new leads and
clients needing attention. Then:

| Do this                         | Where                              | Why                                                                   |
| ------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Clear approvals                 | Approvals                          | Agents' drafts and reports wait here for you                          |
| Reply to new leads within a day | Leads & pipeline                   | Each has a Visibility Report and an explained fit                     |
| Prepare for calls               | Calendar → the meeting             | A briefing is prepared the day before                                 |
| After a call, paste your notes  | Calendar → meeting → Process notes | Creates a summary, next-step tasks and a follow-up email for approval |
| Check client messages           | Clients → client → Messages        |                                                                       |
| Tick off tasks                  | Tasks → My tasks                   |                                                                       |

Once a week: **Business** (MRR, pipeline, cash, client health) and **Runs & agents** (what
ran, what it cost).

---

## 4. From enquiry to paying client

1. **Enquiry arrives**: from the Visibility Report, the contact form, a booked call, Sales
   Scout or added by you (Leads → Add lead). It appears on the pipeline board.
2. **Look at the lead**: fit, opportunity and confidence, each with reasons; their report.
3. **Call**: book it (Calendar) or they book themselves (`/book`). Read the briefing.
4. **Proposal**: on the lead, "Draft proposal". Prices come from your catalogue. Edit the
   wording, check "Before sending" is clear, then **Send**. They get an email with a link.
5. **They accept** on that page (name, email, tick to agree). The system creates their
   client account, services, onboarding tasks, the first invoice and a portal invitation.
6. **They pay** online (Payfast) or by EFT (you record it on the invoice). Services become
   active.
7. **Onboarding**: the client page has a checklist; the welcome call task is already there.

---

## 5. Looking after a client

Open **Clients → the client**. Tabs:

- **Overview**: health (and exactly why), goals, services, next steps.
- **Strategy & Brain**: what we know about them. Facts show whether they're verified.
- **Work / Services**: tasks, content, active services, and the **RUN buttons** ("Run
  Growth" plus "More runs": SEO, AI visibility, competitors, leads, content, conversion,
  LinkedIn, monthly review). A run never acts on its own: it reports what it did, what needs
  approval, what it recommends, and what's blocked.
- **Reports**: monthly reports are drafted by the Monthly Client Review (automatically on
  your monthly review day). Edit the wording, then **Publish to client**.
- **Billing**, **Documents**, **Messages**, **Meetings**, **Activity**, **Settings**
  (invite their staff, pause automation for this client, export their data).

**Client health** is never a mystery score. It's the worst thing that's true right now
(e.g. "invoice overdue", "approvals waiting more than 5 days"), listed with reasons.

---

## 6. Money

- **Invoices**: Workspace → Billing. Monthly invoices are created automatically for active
  clients. You can also create one manually.
- **EFT received?** Open the invoice → Record an EFT payment.
- **Late payers**: reminders go out automatically; after your grace period, automated work
  pauses (their data and portal stay available, and they see a "pay to resume" banner).
  Payment resumes everything.
- **Mistakes**: void an unpaid invoice with a reason. Nothing is deleted.

---

## 7. Your own growth

**Clients → Mea Creo Growth** is Mea Creo as a client of itself: your goals, your own
Visibility Report, the Lead Opportunity Scan and content ideas. Use it weekly.

**Website content** (left menu): write Insights articles and add case studies. Case studies
need the client's written permission; only outcomes you mark "verified" with a source are
shown. Starter article drafts are waiting for your review: read, correct and publish them
yourself.

---

## 8. When something goes wrong

| Problem                                | What to do                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Something automated looks wrong        | Settings → Emergency → Pause all automation. Nothing is deleted.                 |
| One agent misbehaves                   | Runs & agents → Pause that agent                                                 |
| Emails going out you didn't expect     | Settings → Emergency → pause notification email; check Email log                 |
| A client says they can't sign in       | Clients → client → Settings → re-invite them                                     |
| You can't sign in                      | "Forgot password" on the sign-in page                                            |
| Payment marked paid wrongly or missing | Billing → invoice: see payments; record EFT; contact Payfast with the payment id |
| Website down                           | Check the host's status page; roll back the last deploy (DEPLOYMENT.md)          |

Every action is recorded in **Settings → Activity log**.

---

## 9. Accounts you need

| Account                  | Why                                                                 | Without it                                        |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| Hosting (e.g. Vercel)    | Runs the website and platform                                       | Can't go live                                     |
| Managed Postgres         | Stores everything, with backups                                     | Can't go live                                     |
| Storage bucket (e.g. R2) | Files clients upload                                                | Use server disk only on a single server           |
| Resend (or SMTP)         | Sends emails                                                        | Can't go live (invites, receipts, resets)         |
| Payfast                  | Online card/instant EFT payments                                    | Clients pay by EFT; you record it                 |
| Anthropic                | AI drafting                                                         | Rules mode: everything works, plainer wording     |
| Google Cloud project     | Calendar, Search Console, Analytics (once those adapters are built) | Internal calendar; reports say "not yet measured" |
| Xero                     | Accounting sync (once built)                                        | Invoices stay in Mea Creo                         |

Turn on two-factor sign-in for every one of these accounts.

---

## 10. What the system will never do

- Promise rankings, AI mentions, traffic or leads.
- Invent testimonials, results, prices or facts.
- Send, publish, pay, sign or change budgets without the approval rule allowing it.
- Automate LinkedIn messaging or connections.
- Show one client another client's information.
- Delete a client's data because they paid late.
