# Phase 0: Audit of the existing Mea Creo website

Source: `https://www.meacreo.co.za` (Wix). Crawled 2026-09-30: sitemaps, home, services
(`/book-online`), social media packages, portfolio, galleries, a service page and terms.

## 1. What exists today

### Pages and navigation

Main navigation: **Home · Social Media · Services · Portfolio (Food, Photoshoots, Matric
Dance, Wildlife, Landscape, Lodge and Travel) · Contact · More**.

| URL                                                     | Purpose                                                                                                                                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                     | Agency home page                                                                                                                                                                                                                 |
| `/social-media`                                         | Social media management packages (Bronze R4,500 pm, Silver R6,500 pm, …; 6-month minimum)                                                                                                                                        |
| `/book-online`                                          | Wix Bookings service list and "Meet the Team"                                                                                                                                                                                    |
| `/service-page/*` (6)                                   | Bookable services: content creation (from R1,500), graphic design (per project), social media audit (R1,000), social media management call (from R4,500), website design consultation (R750), ads creation & management (R1,500) |
| `/portfolio`, 6 gallery pages                           | Photography: people, hospitality, nature, food, weddings/engagements, matric dance, wildlife, landscape, lodges                                                                                                                  |
| `/portfolio-collections/my-portfolio/project-title-1…6` | Unrenamed Wix template project pages                                                                                                                                                                                             |
| `/terms-and-conditions`                                 | Terms                                                                                                                                                                                                                            |

### Branding

- **Logo:** hand-drawn "M" monogram with a circle stroke. Distinctive and personal; worth keeping.
- **Colours:** sage green (`#6B8971` / `#5C8377`) used on the social share image, near-black
  `#191717`, warm off-white `#F2EFEB`. Many other colours in the CSS are Wix theme defaults.
- **Typography:** Wix defaults (Avenir Light, DIN Next, Proxima Nova, Helvetica, Space Grotesk).
  No deliberate type system.

### Copy and messaging

- Hero: "Engage. Inspire. Convert." with "innovative and effective digital marketing solutions to elevate your brand."
- Positioning: "a team of creative and strategic minds", focused on **small and medium
  businesses**, social media, content, photography and design.
- Team: Dylan Metcalf (Managing Director & Lead Content Creator), Meghan Bartie (Creative Director & Head of Design).
- CTAs: "Get Started", "Learn More", "Get in Touch", "Sign Up" (newsletter), booking buttons.

### Forms

- Contact form (first name, last name, email, phone, company, "What are you looking for?"). All fields required.
- Newsletter sign-up ("Join the Club … specials deals").
- Wix Bookings for paid consultations.

### SEO and metadata (measured)

| Signal             | Finding                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Titles             | Present on every page, but generic ("Mea Creo (Pty) Ltd \| Digital Marketing").                                            |
| Meta descriptions  | Present; agency/consumer tone ("capturing your special day").                                                              |
| Headings           | Multiple H1s on several pages; the home H1 "Engage. Inspire. Convert." carries no search meaning; prices marked up as H2s. |
| Structured data    | Only a basic `WebSite` object. No `Organization`, `LocalBusiness`, `Service` or `FAQPage`.                                 |
| Open Graph         | Present, same generic image on every page.                                                                                 |
| Image alt text     | ~1 in 30 images has meaningful alt text; filenames used as alt elsewhere ("BR Feb 2024 (470 of 636).jpg").                 |
| Canonical / robots | Canonicals set; robots.txt and sitemap are auto-generated by Wix.                                                          |
| Analytics          | No Google Analytics or Tag Manager detected in page source.                                                                |
| Phone links        | Phone number is shown as text only (no `tel:` link).                                                                       |
| AI discoverability | No entity data (Organization, sameAs, founder), no FAQ content, no answer-style content, no `llms.txt`.                    |
| Content depth      | No articles or insights; service pages are short booking descriptions.                                                     |
| Social profiles    | Facebook, Instagram, LinkedIn (a personal-style LinkedIn URL rather than a company page).                                  |

## 2. Assessment

### Strengths (keep)

- The monogram logo and sage-green identity are recognisable and premium when used with restraint.
- Genuine photography and videography capability (real shoots: food, lodges, people, events).
- Dylan as a visible founder is an asset for trust in a B2B services business.
- Contact details are clear.

### Weaknesses (fix)

1. **Positioning:** reads as a small-business social media/photography agency. That conflicts with the
   B2B visibility, growth and automation direction.
2. **Credibility risks:** the three testimonials (Deena Levies, Mission Bay; Tom Smithenson, Parkmerced;
   Tilly Green, Hayes Valley) are Wix template placeholders. Portfolio project pages are template
   slugs. "Proven results" and "many happy clients" have no evidence behind them.
3. **Consumer galleries** (matric dance, engagements, wildlife) dilute B2B credibility.
4. **Public price list** of low-ticket items (R750–R1,500 calls) anchors Mea Creo as low-cost and conflicts with retainer pricing.
5. **The site doesn't practise what Mea Creo will sell:** weak headings, no schema, missing alt
   text, no analytics, no content, no FAQ, no lead magnet.
6. **No lead capture beyond a generic form;** no reason for a visitor to engage before they are ready to buy.
7. **Team page** lists a person who is no longer active.
8. Wix dependency: limited control over performance, schema, redirects and integrations.

## 3. Content decisions

| Keep / evolve                                                          | Rewrite                               | Remove                                  | Add                                                       |
| ---------------------------------------------------------------------- | ------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Logo and sage-green identity (redrawn as SVG when source files arrive) | Hero and positioning                  | Placeholder testimonials                | Free Visibility Report (lead magnet)                      |
| Contact details (verify)                                               | "Who we are" as founder-led "About"   | Meghan Bartie from team presentation    | How It Works (Discover → Improve)                         |
| Best commercial photography (after rights check)                       | Service descriptions around outcomes  | Public package prices                   | Service pillars: Visibility, Growth, Automation, Creative |
| Social profiles                                                        | Meta titles and descriptions per page | "Join the Club / special deals"         | Insights (SEO/GEO/AEO/AI articles)                        |
|                                                                        | Terms (reviewed by an attorney)       | Consumer galleries from main navigation | Case study structure (hidden until real)                  |
|                                                                        |                                       | Template portfolio pages                | Organization/Service/FAQ schema, analytics, `tel:` links  |
|                                                                        |                                       |                                         | Client portal sign-in, strategy call booking              |

## 4. New sitemap

```
/                         Home
/how-it-works             Discover · Audit · Strategise · Implement · Measure · Improve
/services                 Overview of the four pillars
  /services/visibility    SEO · GEO · AEO · AI search · Google visibility · website optimisation
  /services/growth        Lead generation · Google Ads · LinkedIn networking · conversion
  /services/automation    AI agents · workflow automation · business systems · reporting
  /services/creative      Photography · videography · design · content · social
/visibility-report        Free Visibility Report (form → generated report)
/visibility-report/[token] Report page (shareable, unguessable link)
/work                     Work & results (case studies appear only when real and permissioned)
/insights, /insights/[slug]  Articles
/about                    Founder-led, Dylan only
/contact                  Form · report CTA · call booking · details
/book                     Book a visibility review / strategy call
/proposal/[token]         Proposal view and acceptance (not linked publicly)
/legal/{privacy,terms,cookies}
/login                    Sign in (workspace and portal)
/workspace/*              Mea Creo operating workspace (staff)
/portal/*                 Client portal
```

## 5. Feature map

See [ARCHITECTURE.md](ARCHITECTURE.md) for how these fit together and
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for delivery status.

| Area                      |  Visitor  |   Client portal   | Workspace |
| ------------------------- | :-------: | :---------------: | :-------: |
| Positioning website       |    ✅     |                   |           |
| Visibility report         |    ✅     |     ✅ (own)      |    ✅     |
| Booking                   |    ✅     |        ✅         |    ✅     |
| Proposals and acceptance  | ✅ (link) |                   |    ✅     |
| Dashboard                 |           |        ✅         |    ✅     |
| Clients and Client Brain  |           |                   |    ✅     |
| Leads and pipeline        |           |                   |    ✅     |
| Tasks, projects           |           | ✅ (visible work) |    ✅     |
| Approvals                 |           |        ✅         |    ✅     |
| Documents                 |           |        ✅         |    ✅     |
| Reports                   |           |        ✅         |    ✅     |
| Billing and payments      |           |        ✅         |    ✅     |
| Run Engine and agents     |           |                   |    ✅     |
| Opportunities and upsells |           |   ✅ (curated)    |    ✅     |
| AI assistant              |           |        ✅         |           |
| Settings and integrations |           |   ✅ (members)    |    ✅     |

## 6. Risks

| Risk                                                          | Mitigation                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SEO loss when leaving Wix                                     | Redirect map ([MIGRATION.md](MIGRATION.md)), same domain, sitemap submission, 30-day monitoring |
| Overclaiming (rankings, AI citations, results)                | Copy rules, Quality Control agent checks, no metrics without verified source                    |
| Legal/privacy exposure (POPIA) from lead capture and outreach | Consent capture, unsubscribe, approval gates, no scraping of personal data                      |
| Platform terms (LinkedIn automation)                          | Assisted workflows only unless an approved API grants the capability                            |
| AI cost overruns                                              | Budgets per client and globally, caching, approval for expensive runs                           |
| Single operator (Dylan) as bottleneck                         | Approval queues, clear work queues, automation of safe steps                                    |
| Integration credentials not yet available                     | Mock adapters, "Requires configuration" status, feature flags                                   |
| Portfolio image rights (people in photos)                     | Only publish images Dylan confirms have consent                                                 |

## 7. Cost considerations

The architecture keeps fixed costs low: one web app, one database and object storage. AI
spend is metered and budgeted. Detailed, clearly labelled estimates are in
[COSTS.md](COSTS.md).
