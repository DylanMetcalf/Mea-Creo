/**
 * Legal page drafts. They describe how this platform actually handles data, but they are
 * NOT legal advice and must be reviewed by a qualified South African attorney before launch.
 * While `reviewed` is false, the pages show a visible "draft" notice.
 */
export interface LegalDoc {
  slug: "privacy" | "terms" | "cookies";
  title: string;
  description: string;
  reviewed: boolean;
  body: string;
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy policy",
    description: "How Mea Creo collects, uses and protects personal information under POPIA.",
    reviewed: false,
    body: `
Mea Creo (Pty) Ltd ("Mea Creo", "we") respects your privacy and processes personal information in line with the Protection of Personal Information Act, 2013 (POPIA).

## Who is responsible

Mea Creo is the responsible party for personal information collected through this website and the Mea Creo client portal. Our Information Officer is Dylan Metcalf, contactable at the email address on our Contact page.

## What we collect

- **When you request a Visibility Report, book a call or contact us:** your name, email, company, website and, if you give them, your phone number, role and message.
- **When you are a client:** contact details of the people who use the portal, files you upload, messages, approvals and billing records.
- **Automatically:** basic technical information such as IP address and browser type, used for security (for example, to stop abuse of our forms) and to keep the service running.

We analyse **public** information on your website to produce the Visibility Report. We do not access private systems without your permission.

## Why we use it

- To provide what you asked for: your report, your call, a reply to your enquiry, or our services.
- To run your client account: work, approvals, reports, meetings and invoices.
- To contact you about your enquiry. We only send marketing emails if you opted in, and every marketing email lets you unsubscribe.
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
    description: "The cookies this website uses.",
    reviewed: false,
    body: `
## Essential cookies

- **mc_session**: keeps you signed in to the workspace or client portal. It is set only when you sign in, is HTTP-only and secure, and expires after 30 days of inactivity or when you sign out.

## Analytics

Analytics are not enabled yet. If we add them, we will update this notice and ask for consent where required.

We do not use advertising or cross-site tracking cookies.
`,
  },
];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
