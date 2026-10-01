# Workflows, approvals and runs

## Approval levels

| Level     | Who decides                   | Typical use                                              |
| --------- | ----------------------------- | -------------------------------------------------------- |
| Automatic | Nobody: runs and is logged    | Monitoring, internal checks, organising tasks            |
| Client    | The client, in the portal     | Content, outreach on their behalf, campaign changes      |
| Mea Creo  | Staff with `approvals.decide` | Reports before publishing, outreach drafts, agent output |
| Manual    | A person does the work        | Anything that can't be automated safely                  |

The effective level = service default → admin override (Settings → Approvals & workflows)
→ hard locks. **Payments, refunds, contracts, cancellations and budget changes can never be
automatic.** Approving runs the attached action (`report.publish`, `content.approve`,
`outreach.send`, `task.create`); requesting changes or rejecting creates a follow-up task.
Clients can only decide their own organisation's client-level items.

## Runs (RUN buttons)

| Run                           | Does                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Run Growth                    | Every workflow the client's active services need, then opportunities, health, timeline |
| Run Visibility Audit          | Fresh Visibility Report of the client's site                                           |
| Run SEO Analysis              | Search and technical findings → tasks and page-change approvals                        |
| Run AI Visibility Analysis    | Entity clarity, structured data, answer readiness                                      |
| Run Competitor Analysis       | Client vs competitors, "consider" points                                               |
| Run Lead Opportunity Scan     | Qualifies prospects, prepares follow-ups for approval                                  |
| Run Content Opportunity Scan  | Content ideas and a brief                                                              |
| Run Website Conversion Audit  | Calls to action, enquiry paths, proof, tracking                                        |
| Run LinkedIn Opportunity Scan | Assisted networking plan; a person performs every LinkedIn action                      |
| Run Monthly Client Review     | Drafts the monthly report and next month's plan for approval                           |

Each run produces items with one outcome: **completed**, **requires approval**,
**recommended**, **blocked** (with what's missing, e.g. "connect Search Console") or
**no action**. Runs never invent data: anything that needs an unconnected integration is
reported as blocked or "not yet measured".

## Event workflows (`src/modules/workflows/engine.ts`)

| When                    | Then                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `lead.created`          | Assign an owner, create a follow-up task                                                |
| `invoice.overdue`       | Notify client and admin, follow-up task, recompute health; pause after the grace period |
| `payment.completed`     | Restore paused services, recompute health                                               |
| `approval.completed`    | Recompute health                                                                        |
| `monthly_cycle.started` | Monthly Client Review run for every active client                                       |

All rules are listed in Settings → Approvals & workflows.

## Daily cycle (`src/modules/scheduler/daily.ts`)

Once a day: billing (issue due monthly invoices, mark overdue, reminders, pause after the
grace period), briefings for calls in the next 36 hours, and the monthly cycle on the
configured day (once per month). Run by `pnpm worker` or `/api/cron/daily`.

## Emergency controls

Settings → Emergency: pause all automation,
notification and marketing email (transactional email such as receipts, invoices, invitations and password resets still sends), or online payments. Runs & agents: pause a single agent. Each client: pause automation for
that client. Nothing is deleted; switching off resumes normal operation.
