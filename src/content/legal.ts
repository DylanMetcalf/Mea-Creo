/**
 * Legal page drafts. They describe how this platform actually handles data, but they are
 * NOT legal advice. A page shows a visible "draft" notice until the director confirms, in
 * Settings → Company, that its current version has been reviewed. Never mark a page reviewed
 * on someone's behalf.
 */
export type LegalSlug = "popia" | "privacy" | "terms" | "cookies";

export interface LegalDoc {
  slug: LegalSlug;
  title: string;
  description: string;
  /** Last substantive change. Shown on the page. */
  updated: string;
  /**
   * Whether the director has confirmed this version was reviewed. The live flag is in
   * Settings → Company (legal review); this is only the default.
   */
  reviewed: boolean;
  body: string;
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "popia",
    title: "POPIA statement",
    description:
      "How Mea Creo (Pty) Ltd processes personal information under the Protection of Personal Information Act, and your rights.",
    updated: "2026-10-07",
    reviewed: false,
    body: `
This statement explains how **Mea Creo (Pty) Ltd** (registration 2022/626541/07, "Mea Creo", "we") processes personal information in terms of the Protection of Personal Information Act 4 of 2013 ("POPIA"), and the rights you have. It applies to anyone who deals or communicates with Mea Creo: clients, prospective clients, suppliers, people who use our website or client portal, and the people who act for them (each "you").

POPIA gives effect to the constitutional right to privacy. It requires personal information to be processed lawfully, in a reasonable way, for a specific purpose, and with appropriate safeguards.

## Responsible party and Information Officer

- **Responsible party:** Mea Creo (Pty) Ltd, Terram Farm, 58 Tonteldoos Road, Tonteldoos, Dullstroom, Mpumalanga 1111.
- **Information Officer:** Dylan Metcalf, director. Email **dylan@meacreo.co.za**, phone +27 79 889 5569.

## What we collect

- **Identity and contact details:** names, job titles, email addresses, telephone numbers, business and physical addresses, and languages you prefer.
- **Business information:** company name, registration and VAT numbers (from you or the Companies and Intellectual Property Commission (CIPC)), website, industry and the people who make decisions in your business.
- **Engagement information:** enquiries, meeting notes, proposals, approvals, messages, files you upload, invoices and payment records.
- **Website and portal information:** your IP address, browser and device type, pages visited and, only if you agree to analytics cookies, how you use our website (see our Cookie notice).
- **Public information:** information a business publishes about itself on its own website or public business profiles, which we use to prepare Visibility Reports and to decide whether our services may be relevant.

We do not knowingly collect special personal information (such as health, religious or biometric information) or information about children, and we ask you not to send it to us.

## Why we process it, and on what basis

We process personal information only for the purposes below, and only on a basis POPIA allows (section 11):

- **To provide our services and perform our agreement with you** (contract): delivering work, reporting, scheduling meetings, invoicing and support.
- **To take steps you asked for before an agreement** (contract): preparing a Visibility Report, a proposal or a call you booked.
- **To comply with the law** (legal obligation): tax, accounting and company law records, and requests from authorities such as SARS.
- **For our legitimate interests, balanced against your rights:** securing our systems, preventing abuse, improving our services and keeping business records.
- **With your consent:** analytics cookies, and direct marketing by electronic communication (see below). You can withdraw consent at any time.

We only collect what we need for these purposes, and we collect it from you wherever we can. Where we collect it from someone else, such as the CIPC, your public website or a person who referred you, it is because the law allows it or the information is publicly available.

## Direct marketing

We follow section 69 of POPIA. We will only send direct marketing by electronic communication, including email, SMS, WhatsApp, LinkedIn messages and telephone calls, if:

- you are an existing client and the marketing is about similar services, and you were given the chance to object when we collected your details; or
- you have consented. If you have not been in touch with us before, we may contact you **once** to ask for your consent, and we will not contact you again unless you agree.

Every marketing message tells you who it is from and how to opt out. Opting out is free, takes effect immediately, and applies to every channel. We keep a record of your opt-out so that you are not contacted again.

## Automated processing and AI

We use software, including AI models, to analyse public websites, organise work and prepare drafts. A person at Mea Creo reviews client-facing work, and nothing is published or sent on your behalf without the approval set out in your agreement. We do not make decisions about you that have legal or similarly significant effects based solely on automated processing (section 71). Information shared with AI providers is limited to what a task needs.

## Who we share it with

We share personal information only where needed for the purposes above:

- **Operators** that process information on our behalf under written agreements requiring appropriate security (section 21): website and database hosting, email delivery, file storage, payment processing (Payfast), accounting (Xero), calendar and analytics services (Google), and AI model providers.
- **Authorities** where the law requires, such as SARS and the CIPC.
- **Other third parties** only with your agreement.

We do not sell personal information.

## Transfers outside South Africa

Some of our operators store or process information outside South Africa, for example in the European Union or the United States. We only use providers that are subject to laws, binding agreements or corporate rules that provide protection substantially similar to POPIA, or where the transfer is needed to perform our agreement with you (section 72).

## How long we keep it

- Enquiries and prospective clients: up to 24 months after our last contact, unless you become a client.
- Clients: for the duration of our relationship, then for as long as tax, accounting and company law require (generally five years).
- Opt-out records: for as long as needed to respect your opt-out.

After that we delete or de-identify the information.

## How we protect it

We take appropriate, reasonable technical and organisational measures to protect personal information (section 19), including access controls, encryption of sensitive information, hashed passwords, secure connections and logs of administrative actions. If we have reasonable grounds to believe your personal information has been accessed or acquired by an unauthorised person, we will notify you and the Information Regulator as soon as reasonably possible, as section 22 requires.

## Your rights

You have the right to:

- ask whether we hold personal information about you, and request a record of it and of the third parties who have had access to it;
- ask us to correct, update or delete information that is inaccurate, irrelevant, excessive, out of date, incomplete, misleading or unlawfully obtained;
- object to processing based on our legitimate interests, and to direct marketing, at any time;
- withdraw consent at any time. This does not affect processing that already took place, or processing we do on another lawful basis such as our agreement with you or a legal obligation. If we can no longer process information we need to provide a service, we will explain what that means for the service;
- lodge a complaint with the Information Regulator.

To use any of these rights, contact our Information Officer at **dylan@meacreo.co.za**. We will ask you to verify your identity before we release information. Objections, corrections, deletions and opt-outs are free. Requests for access to records are handled under the Promotion of Access to Information Act (PAIA), which may set a prescribed fee; we will tell you in advance if one applies. We may decline access in the circumstances PAIA and POPIA allow, for example where it would disclose another person's information or legally privileged material.

## Keeping your information accurate

Please tell us when your details change so that we can keep our records correct.

## The Information Regulator

If you are not satisfied with how we have handled your personal information, you may complain to the Information Regulator of South Africa: [inforegulator.org.za](https://inforegulator.org.za). We would appreciate the chance to resolve your concern first.

## Changes to this statement

We will update this statement when our processing or the law changes. The date at the top shows when it last changed.
`,
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    description: "How Mea Creo collects, uses and protects personal information under POPIA.",
    updated: "2026-10-07",
    reviewed: false,
    body: `
Mea Creo (Pty) Ltd ("Mea Creo", "we") respects your privacy and processes personal information in line with the Protection of Personal Information Act, 2013 (POPIA). This page is a short summary; our full [POPIA statement](/legal/popia) sets out the detail and your rights.

## Who is responsible

Mea Creo is the responsible party for personal information collected through this website and the Mea Creo client portal. Our Information Officer is Dylan Metcalf, at dylan@meacreo.co.za.

## What we collect

- **When you request a Visibility Report, book a call or contact us:** your name, email, company, website and, if you give them, your phone number, role and message.
- **When you are a client:** contact details of the people who use the portal, files you upload, messages, approvals and billing records.
- **Automatically:** basic technical information such as IP address and browser type, used for security (for example, to stop abuse of our forms) and to keep the service running.

We analyse **public** information on your website to produce the Visibility Report. We do not access private systems without your permission.

## Why we use it

- To provide what you asked for: your report, your call, a reply to your enquiry, or our services.
- To run your client account: work, approvals, reports, meetings and invoices.
- To contact you about your enquiry. We only send direct marketing as POPIA section 69 allows: if you haven't been in touch with us before, we may ask once for your consent, and every message lets you opt out of all channels.
- To meet legal and accounting obligations.

## Automated processing and AI

We use software, including AI models, to analyse websites, prepare drafts and organise work. People at Mea Creo review client-facing work, and nothing is published or sent on your behalf without the approval set out in your agreement. Information sent to AI providers is limited to what the task needs.

## Who we share it with

Service providers who help us operate, under agreements that protect your information: hosting and database providers, email delivery, payment processing (Payfast), accounting (Xero) and AI model providers. Some may process information outside South Africa; where they do, we rely on the safeguards POPIA requires. We do not sell personal information.

## How long we keep it

Enquiries and leads: up to 24 months after our last contact, unless you become a client. Client records: for the duration of the relationship and as long as tax and accounting law requires afterwards.

## Your rights

You may ask to see, correct or delete your personal information, object to processing, or withdraw consent, by contacting us. You may also complain to the Information Regulator of South Africa.

## Security

We protect information with access controls, encryption of sensitive credentials, hashed passwords, and logging of administrative actions. No system is perfectly secure; we will notify you and the Regulator of a breach as POPIA requires.
`,
  },
  {
    slug: "terms",
    title: "Terms of use",
    description: "Terms for using the Mea Creo website, Visibility Report and client portal.",
    updated: "2026-10-02",
    reviewed: false,
    body: `
These terms apply to the Mea Creo website, the free Visibility Report and the client portal. Client services are governed by the proposal or agreement you accept; where it conflicts with these terms, the agreement wins.

## The Visibility Report

The report is an automated analysis of publicly available signals on your website at the time it runs. It is informational, it is not a guarantee of any outcome, and it may not detect everything. Some checks are marked "not yet measured" when they need access we don't have.

## No guarantees of results

Search engines, AI assistants, ad platforms and buyers make their own decisions. We do not guarantee rankings, AI mentions, traffic, leads or revenue. We commit to the work described in your agreement and to honest reporting.

## Your account

Keep your login details private and tell us if you suspect misuse. You are responsible for the people you invite to your portal and for the approvals they give.

## Your content

You keep ownership of the content and files you give us. You confirm you have the right to share them and allow us to use them to provide our services.

## Payments

Fees, payment terms and minimum terms are set in your accepted proposal. Unpaid invoices may lead to automated services being paused after the grace period stated in your agreement. Your data is not deleted because of late payment.

## Acceptable use

Don't misuse the website or portal, attempt to access other clients' information, or use our forms to send spam.

## Liability

To the extent the law allows, our liability is limited to the fees you paid us in the three months before the claim. Nothing in these terms limits rights you have under the Consumer Protection Act where it applies.

## Law

These terms are governed by the laws of South Africa.
`,
  },
  {
    slug: "cookies",
    title: "Cookie notice",
    description: "The cookies this website uses, and the choice you have.",
    updated: "2026-10-07",
    reviewed: false,
    body: `
## Essential cookies (always on)

- **mc_session**: keeps you signed in to the workspace or client portal. Set only when you sign in; HTTP-only and secure; expires after 30 days of inactivity or when you sign out.
- **mc_consent**: remembers your cookie choice for 12 months.
- **mc_theme**: remembers whether you chose light or dark mode.

## Analytics cookies (only if you agree)

If you choose "Accept analytics", we use Google Analytics 4 to understand which pages are useful and how visitors find us, and a first-party cookie (**mc_source**, 90 days) that remembers how you first arrived (for example a search engine or a campaign link), so we can tell which channels bring enquiries. Google Analytics sets its own cookies (**_ga**, **_ga_***), and IP addresses are not stored by Google Analytics 4.

If you choose "Essential only", none of these are set. You can change your choice at any time with the "Cookie settings" link at the bottom of every page.

We do not use advertising or cross-site tracking cookies. See our [POPIA statement](/legal/popia) for how we handle personal information.
`,
  },
];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
