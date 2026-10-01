# Moving meacreo.co.za from Wix to the new platform

The domain is registered at **Domains.co.za**. The current website runs on **Wix**. This
plan moves the website without risking email or the existing site. **Nothing here has been
done automatically: every step is yours to take, in order.**

> The golden rules: don't touch email (MX) records; don't cancel or unpublish Wix until the
> new site has run cleanly for 30 days; change DNS only after the new site is verified on
> its temporary address; keep a written copy of every DNS record before changing anything.

## Content decisions (from the audit of the old site)

| Old content                                              | Decision                                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero, "Who we are" and agency copy                       | Replaced with the new positioning                                                                                                             |
| Testimonials (Deena Levies, Tom Smithenson, Tilly Green) | **Not migrated**: they are Wix template placeholders. Only real, permissioned testimonials.                                                   |
| Team                                                     | Dylan only                                                                                                                                    |
| Packages section                                         | Not shown publicly; packages live in proposals                                                                                                |
| Portfolio `project-title-1…6`                            | Template pages. Real work goes into Website content → Case studies with client permission                                                     |
| Photography galleries                                    | **Decision needed (Dylan):** keep the best commercial work as creative case studies; consider dropping consumer galleries (e.g. matric dance) |
| Wix Bookings                                             | Replaced by `/book`                                                                                                                           |
| Terms & Conditions                                       | Replaced by `/legal/terms` (draft, needs legal review)                                                                                        |
| Contact details                                          | Moved to Settings → Company; **verify**                                                                                                       |
| Logo                                                     | Uses the current monogram PNG. **Needed:** original vector logo files                                                                         |

## Redirects (already built)

Old Wix URLs redirect permanently (308) to the new pages: `next.config.ts`.

| Old                                                                                                           | New                  |
| ------------------------------------------------------------------------------------------------------------- | -------------------- |
| `/portfolio`, `/portfolio-collections/*`                                                                      | `/work`              |
| `/social-media`, `/photoshoots`, `/food`, `/wildlife`, `/landscape`, `/lodge-and-travel`, `/matric-dance`     | `/services/creative` |
| `/book-online`, `/service-page/initial-call-social-media-management`                                          | `/book`              |
| `/service-page/ads-creation-and-management`                                                                   | `/services/growth`   |
| `/service-page/content-creation`, `/service-page/website-design-consultation`, `/service-page/graphic-design` | `/services/creative` |
| `/service-page/social-media-audit`                                                                            | `/visibility-report` |
| `/service-page/*` (anything else)                                                                             | `/services`          |
| `/terms-and-conditions`                                                                                       | `/legal/terms`       |

Before launch, check Google Search Console (Pages and Links reports) for any other old URL
with traffic or links and add it.

## Step by step

### 1. Back up (before anything else)

- In Wix: download your images and any text you want to keep (Media Manager → download).
- In Domains.co.za (My Account → your domain → DNS / Manage DNS): **screenshot or copy every
  record** (A, AAAA, CNAME, MX, TXT). Save it somewhere safe. This is your rollback.
- Note where email is hosted (the MX records show it, e.g. Google Workspace or Microsoft 365).

### 2. Launch on a temporary address

Deploy (see [DEPLOYMENT.md](DEPLOYMENT.md)) and use the host's temporary URL (e.g.
`meacreo.vercel.app`) with `NEXT_PUBLIC_SITE_URL` set to it. Go through the checklist
below on that URL. Nothing about the live site changes during this step.

### 3. Pre-launch checklist

- [ ] Every page works on phone and desktop; forms, Visibility Report, booking and portal tested
- [ ] Company details, prices, VAT and EFT details verified in Settings
- [ ] Legal pages reviewed
- [ ] Email sending verified (SPF/DKIM/DMARC records added for the email provider; these are _new TXT/CNAME records_, they don't replace MX)
- [ ] Payfast tested in sandbox, then switched to live with one small real payment and refund
- [ ] Redirects checked: each old URL returns 308 to a page that loads
- [ ] Founder account created; demo mode off (`APP_ENV=production`)

### 4. Point the domain (low-traffic time, e.g. a weekday evening)

1. A day before: in Domains.co.za, lower the TTL on the `www` and root (`@`) records to
   the minimum allowed (e.g. 300 seconds), so changes and rollbacks apply quickly.
2. In your host, add `meacreo.co.za` and `www.meacreo.co.za` as domains. The host shows the
   exact records to create. (For Vercel these are typically an `A` record for the root and
   a `CNAME` for `www`; always copy the values the host shows you.)
3. In Domains.co.za, **change only** the root `A` record(s) and the `www` record to the
   host's values. Remove the old Wix `A`/`CNAME` records for the root and `www` only.
   **Leave MX and email-related TXT records exactly as they are.**
4. Wait for the host to show the domain as verified and HTTPS active (minutes to a few hours).
5. Set `NEXT_PUBLIC_SITE_URL=https://www.meacreo.co.za` and redeploy.
6. Test: home page, a redirect, the Visibility Report, contact form, booking, sign-in.
7. In Wix, disconnect the domain from the Wix site (Wix will warn the site is no longer on
   your domain). **Don't delete or unpublish the Wix site.**

### 5. Tell Google

- Search Console: verify the domain property (DNS TXT record), submit
  `https://www.meacreo.co.za/sitemap.xml`, watch Pages and 404s.
- Update the Google Business Profile website link if needed.

### 6. Rollback (if something is wrong)

In Domains.co.za, put back the root and `www` records from your backup (step 1) and
reconnect the domain in Wix. With the low TTL, most visitors see the old site again within
minutes. Email is unaffected because MX records were never changed.

### 7. The 30 days after launch

Check weekly: Search Console coverage and 404s, form and Visibility Report submissions,
bookings, payment errors, Settings → Integrations, Email log. After 30 clean days, decide
whether to cancel the Wix plan (keep an export first).
