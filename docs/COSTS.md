# Running costs

> **All figures are estimates** from public pricing pages at the time of writing, in US
> dollars unless stated, and change often. Check each provider's current pricing before
> signing up. Nothing here is a quote.

## Monthly, to run the platform

| Item                | Option                                            | Estimated monthly cost                                                  | Needed?                       |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| Hosting             | Vercel Pro (one member)                           | about $20                                                               | Yes (or a server, below)      |
| Hosting alternative | A small VPS (2 vCPU, 4 GB)                        | about $10–30                                                            | Instead of Vercel             |
| Database            | Managed Postgres (Neon, Supabase)                 | $0 on free tiers while small; about $20–30 on paid plans with backups   | Yes                           |
| File storage        | Cloudflare R2 or S3                               | Under $5 at this scale                                                  | Yes                           |
| Transactional email | Resend                                            | Free tier for low volume; about $20 on the first paid tier              | Yes                           |
| AI (Anthropic)      | Usage-based                                       | Capped by your budget setting (default $50 a month, and $10 per client) | Optional: rules mode costs $0 |
| Uptime monitoring   | Free tiers exist (e.g. UptimeRobot, Better Stack) | $0–10                                                                   | Recommended                   |
| Domain              | Domains.co.za                                     | Existing annual renewal                                                 | Already paid                  |

**Typical total to start:** roughly **$40–80 a month** plus AI usage you choose to allow.

## Per transaction

| Item    | Note                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payfast | A per-transaction fee on each payment (percentage plus a fixed amount, varying by payment method). See Payfast's pricing page. EFT payments recorded manually cost nothing in Mea Creo. |

## Already paid or existing

| Item               | Note                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Xero               | Only if you use Xero: your existing subscription. The integration adds no Xero fees. |
| Your email hosting | Email stays where it is; the migration never touches MX records.                     |
| Google APIs        | Search Console, Analytics and Calendar APIs are free at this usage.                  |
| Wix                | Keep for 30 days after launch as a fallback, then cancel to save the plan fee.       |

## Keeping AI costs down

- Start with `AI_PROVIDER=none` (rules mode). Turn AI on when drafts are worth it.
- Budgets in Settings → AI & costs are hard limits; over budget means rules mode.
- Runs & agents shows cost per agent and per run, and the Business page shows the month.
