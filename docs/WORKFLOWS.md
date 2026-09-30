# Workflows, automation and approvals

**Status:** design (Phase 1). The engine lands in Phase 20; approvals in Phase 6/8.

## Event model

State changes write a row to `domain_events` in the same database transaction (the
transactional outbox), so events are never lost or emitted for rolled-back changes.
The worker delivers events to subscribers at least once, so every handler is idempotent.

Initial events: `lead.created`, `audit.completed`, `call.booked`, `call.completed`,
`proposal.created`, `proposal.accepted`, `payment.completed`, `payment.failed`,
`client.created`, `document.uploaded`, `approval.requested`, `approval.completed`,
`invoice.overdue`, `invoice.paid`, `service.activated`, `service.paused`,
`task.completed`, `report.generated`, `monthly_cycle.started`.

## Rules

```
WHEN   <event>
IF     <conditions on the event and the client>
THEN   <action> [, <action>...]
REQUIRES <approval level>
```

Actions: create or assign task, send email, create draft, notify admin or client, generate
report, run agent, request approval, update CRM, create proposal, create invoice, sync
Xero, create payment request, schedule meeting, update, pause or resume service, create
content brief, run audit, run research.

## Execution levels

| Level   | Behaviour                                    |
| ------- | -------------------------------------------- |
| SUGGEST | Creates a recommendation. A human decides.   |
| PREPARE | Prepares the artifact and requests approval. |
| EXECUTE | Runs automatically and is logged.            |

Defaults begin conservative (spec §141) and move toward EXECUTE only as workflows prove
themselves. Each workflow also has a **maturity** of manual, assisted or automated, and
the admin can change it.

### Default approval matrix

| Action                            | Default                                | Can be lowered?                               |
| --------------------------------- | -------------------------------------- | --------------------------------------------- |
| SEO research, SEO recommendations | EXECUTE                                | n/a                                           |
| Internal reports                  | EXECUTE                                | n/a                                           |
| Strategy                          | PREPARE                                | yes                                           |
| Client-facing content             | PREPARE                                | yes                                           |
| External (client) reports         | PREPARE                                | yes                                           |
| Major website changes             | PREPARE                                | yes                                           |
| Google Ads campaign changes       | PREPARE                                | yes                                           |
| LinkedIn personal outreach        | Assisted: human performs it            | no (unless an approved API capability exists) |
| **Budget changes**                | Always approval                        | **no**                                        |
| **Payments and refunds**          | Always approval                        | **no**                                        |
| **Contracts**                     | Always approval                        | **no**                                        |
| **Client cancellation**           | Always approval                        | **no**                                        |
| Outbound email to non-clients     | PREPARE, rate-limited, consent-checked | yes, within limits                            |

The "always approval" set is enforced in code, not settings.

## Run Growth (Phase 18)

Per client: load the Client Brain, then services and configuration, then latest
performance. Next it detects changes, runs the relevant agents and identifies
opportunities, and creates recommendations and tasks. It then executes EXECUTE-level
actions, requests approvals for the rest, and writes the run summary, timeline entries and
an optional client summary. The outcome of each item is
`COMPLETED | REQUIRES_APPROVAL | RECOMMENDED | BLOCKED | NO_ACTION`.

## Billing automation

`payment.completed` activates eligible services. `payment.failed` notifies the client and
admin. When the overdue threshold is reached, `invoice.overdue` pauses the configured
services while portal access to billing and documents is preserved. A later
`invoice.paid` resumes them. Data is never deleted by billing state.

## Emergency controls

Pause all automations, one agent, one client, one service, outbound email or payments;
disable an integration; retry a failed workflow run; roll back workflow state where the
steps are reversible. Every control change is audit-logged.
