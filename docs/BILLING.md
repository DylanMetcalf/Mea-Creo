# Billing

## Principles

- Prices come only from the service catalogue (Workspace → Services & pricing). The seed
  has **no prices**; demo prices are flagged and every billing screen warns until the
  owner confirms real prices.
- VAT is off until Mea Creo's VAT registration is confirmed (Settings → Billing). Invoices
  snapshot the tax rate at issue.
- Money is integer minor units plus a currency. ZAR is the default; USD, GBP, EUR, CAD and
  AUD are supported for invoicing. Payfast only takes ZAR.
- Late payment pauses **automated work**, never the client's data or portal access.

## Lifecycle

```
Proposal accepted ─► client created (billing: pending payment)
                     services created as pending
                     setup invoice issued (setup + first month)
Payment received ──► invoice paid ─► services active ─► billing: active
Monthly ───────────► daily cycle issues monthly invoices for active subscriptions
Not paid by due ───► invoice overdue ─► billing: overdue ─► reminders (days after due)
Grace period over ─► automated services paused (pause reason shown to client)
Paid ──────────────► services resumed, health recomputed
```

Billing states on a client: `trial`, `pending_payment`, `active`, `payment_due`,
`overdue`, `suspended`, `cancelled`, `archived`.

## Taking payment

| Method | How                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Online | Client → Portal → Billing → Pay online (or the proposal page after accepting). Payfast checkout; the signed notification marks the invoice paid. |
| EFT    | Bank details from Settings → Billing are printed on invoices. Record receipt in Workspace → Billing → invoice → Record an EFT payment.           |
| Test   | While Payfast isn't configured, Pay online opens `/pay/test-checkout` (no real money).                                                           |

All three use the same code path (`applyPaymentEvent`), so receipts, service activation,
notifications and health behave identically. Duplicate notifications are ignored.

## Invoices

Workspace → Billing: totals (outstanding, overdue, received this month), filters, invoice
detail with lines, payments, Xero sync status, PDF, void (with a reason, only if unpaid),
and "Run billing cycle now". New invoices: Workspace → Billing → New invoice.

## Settings (Settings → Billing)

Default currency, VAT registration and rate, payment terms, reminder days after due,
pause-after days, invoice and proposal number prefixes, EFT details.

## Accounting

The Xero adapter is not built yet (see [INTEGRATIONS.md](INTEGRATIONS.md)). Until then,
invoices live in Mea Creo, show "Not synced", and can be exported or recreated in Xero.
