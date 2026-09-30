# Website migration (Wix → new platform)

Source: `https://www.meacreo.co.za/` (Wix), inventoried 2026-09-30 from its sitemaps.
The live site stays in place until the launch checklist below is complete.

## Content inventory and decisions

| Content                                                                                     | Decision                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo and brand cues (near-black, warm off-white, deep blue `#2B5672`)                       | Keep as inspiration; cleaned up in the Phase 4 design system. Need original logo files (SVG) from Dylan.                                                                                              |
| Contact: dylan@meacreo.co.za, +27 79 889 5569, Mooikloof, Pretoria 0081                     | Migrated to `src/config/site.ts`; **verify before production**; becomes admin-editable.                                                                                                               |
| Hero "Engage. Inspire. Convert." and agency copy                                            | Replace with the new positioning (Get found. Get noticed. Grow.).                                                                                                                                     |
| "Who we are", "Tailored approach", "Competitive edge" copy                                  | Rewrite. Remove "team of creative and strategic minds" and small-business-only framing.                                                                                                               |
| **Testimonials** (Deena Levies, Tom Smithenson, Tilly Green)                                | **Do not migrate.** These are Wix template placeholders (paired with San Francisco neighbourhoods). Replace only with real, permissioned testimonials.                                                |
| Packages section                                                                            | Remove from the public site for V1 (spec §108).                                                                                                                                                       |
| Portfolio projects (`project-title-1…6`)                                                    | Template slugs. Review the underlying imagery with Dylan; keep genuine work under Work / Portfolio.                                                                                                   |
| Photography galleries: food, photoshoots, matric dance, wildlife, landscape, lodge & travel | Retain the best commercial work under Creative → Photography. Consumer-focused galleries (matric dance) should be de-emphasised or removed so they don't dilute B2B positioning. **Decision: Dylan.** |
| Booking services (Wix Bookings)                                                             | Replaced by "Book a strategy call" (Phase 15).                                                                                                                                                        |
| Terms & Conditions                                                                          | Replaced by reviewed legal pages (Phase 5).                                                                                                                                                           |
| Team members                                                                                | Dylan only. Megan Bartie is not listed.                                                                                                                                                               |

## Redirect map (draft)

Finalise after reviewing Search Console data for which URLs actually earn impressions
and links. All redirects are permanent (308).

| Old URL                                                                 | New URL                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/social-media`                                                         | `/creative#social-media`                                   |
| `/portfolio`                                                            | `/work`                                                    |
| `/portfolio-collections/my-portfolio`                                   | `/work`                                                    |
| `/portfolio-collections/my-portfolio/project-title-{1..6}`              | `/work` (or the specific migrated project)                 |
| `/photoshoots`, `/food`, `/wildlife`, `/landscape`, `/lodge-and-travel` | `/creative/photography`                                    |
| `/matric-dance`                                                         | `/creative/photography` (or 410 if the gallery is removed) |
| `/book-online`                                                          | `/book`                                                    |
| `/service-page/ads-creation-and-management`                             | `/growth#google-ads`                                       |
| `/service-page/content-creation`                                        | `/creative#content`                                        |
| `/service-page/website-design-consultation`                             | `/creative#websites`                                       |
| `/service-page/graphic-design`                                          | `/creative#design`                                         |
| `/service-page/social-media-audit`                                      | `/visibility-audit`                                        |
| `/service-page/initial-call-social-media-management`                    | `/book`                                                    |
| `/terms-and-conditions`                                                 | `/legal/terms`                                             |
| `/*?lightbox=*`                                                         | Strip the query parameter                                  |

## Launch checklist (spec §183)

- [ ] Crawl the live site once more; confirm there are no new URLs since this inventory
- [ ] Redirect map implemented and tested (every old URL returns 308 to a 200)
- [ ] DNS: `www` and apex to new host, `app` to new host; SSL valid on all
- [ ] Favicon, logo, metadata, Open Graph images
- [ ] `sitemap.xml` and `robots.txt` (production only indexable)
- [ ] Search Console verified for the domain property; new sitemap submitted
- [ ] Analytics installed with consent handling; conversion events verified
- [ ] Forms, audit, booking and email deliverability (SPF, DKIM, DMARC)
- [ ] Payments in live mode, verified with a small real transaction and refund
- [ ] Privacy, terms and cookie pages published (reviewed)
- [ ] 404 page, mobile, desktop, accessibility (axe) and performance (Lighthouse) checks
- [ ] Security review, backups verified by a test restore, monitoring and alerts live

## First 30 days after launch (spec §184)

Watch daily for the first week, then weekly: 404s from old URLs, indexing and coverage in
Search Console, form and audit submissions, bookings, payment errors, integration
failures, Core Web Vitals and lead conversion. Keep the Wix site available (unpublished)
for 30 days as a rollback reference.
