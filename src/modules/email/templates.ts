import { siteConfig } from "@/config/site";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Minimal, accessible branded layout that renders well in every mail client. */
export function layout(input: {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const body = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escape(p)}</p>`)
    .join("");
  const cta = input.cta
    ? `<p style="margin:24px 0"><a href="${escape(input.cta.url)}" style="background:#4a6b58;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${escape(input.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f4f1ec;font-family:Helvetica,Arial,sans-serif;color:#191717">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 24px;font-weight:700;letter-spacing:0.02em;color:#4a6b58">${escape(siteConfig.name)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escape(input.heading)}</h1>
${body}${cta}
<p style="margin:32px 0 0;font-size:12px;color:#6b6560;line-height:1.5">${escape(input.footerNote ?? `${siteConfig.legalName} · ${siteConfig.contact.locality}, ${siteConfig.contact.country}`)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

function build(
  heading: string,
  paragraphs: string[],
  cta?: { label: string; url: string },
  subject = heading,
): RenderedEmail {
  const text = [
    heading,
    "",
    ...paragraphs,
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    "",
    `— ${siteConfig.name}`,
  ].join("\n");
  return { subject, text, html: layout({ heading, paragraphs, cta }) };
}

export const emailTemplates = {
  auditReady: (p: { name: string; company: string; url: string }) =>
    build(
      "Your Visibility Report is ready",
      [
        `Hi ${p.name},`,
        `Your initial visibility snapshot for ${p.company} is ready. It shows what is happening, why it matters and what we'd do next, across search, AI discoverability, content and conversion.`,
        "If you'd like to talk it through, you can book a free visibility review from the report page.",
      ],
      { label: "View your report", url: p.url },
    ),
  bookingConfirmed: (p: {
    name: string;
    when: string;
    type: string;
    meetingUrl?: string;
    manageUrl: string;
  }) =>
    build(
      "Your call is booked",
      [
        `Hi ${p.name},`,
        `Your ${p.type} is confirmed for ${p.when}.`,
        p.meetingUrl
          ? `Join here: ${p.meetingUrl}`
          : "We'll send the meeting link before the call.",
        "We'll review your website before we speak so the time is useful.",
      ],
      { label: "View booking", url: p.manageUrl },
    ),
  proposalSent: (p: { name: string; company: string; url: string }) =>
    build(
      `Your proposal from ${siteConfig.name}`,
      [
        `Hi ${p.name},`,
        `Thank you for your time. Your proposal for ${p.company} is ready to review. You can accept it online when you're ready, or reply with any questions.`,
      ],
      { label: "Review proposal", url: p.url },
    ),
  proposalAccepted: (p: { company: string; url: string }) =>
    build("Proposal accepted", [`${p.company} accepted their proposal. Onboarding has started.`], {
      label: "Open client",
      url: p.url,
    }),
  welcome: (p: { name: string; company: string; url: string }) =>
    build(
      `Welcome to your ${siteConfig.name} workspace`,
      [
        `Hi ${p.name},`,
        `Your workspace for ${p.company} is ready. It's where you'll see what we're working on, approve work, view reports and upload files.`,
        "Set your password using the link below. It expires in 7 days.",
      ],
      { label: "Set up your account", url: p.url },
    ),
  invitation: (p: { name: string; inviter: string; organisation: string; url: string }) =>
    build(
      `You've been invited to ${p.organisation}`,
      [
        `Hi ${p.name},`,
        `${p.inviter} invited you to the ${p.organisation} workspace on ${siteConfig.name}.`,
        "The link expires in 7 days.",
      ],
      { label: "Accept invitation", url: p.url },
    ),
  passwordReset: (p: { name: string; url: string }) =>
    build(
      "Reset your password",
      [
        `Hi ${p.name},`,
        "We received a request to reset your password. The link expires in one hour.",
        "If this wasn't you, you can ignore this email.",
      ],
      { label: "Reset password", url: p.url },
    ),
  paymentReceived: (p: { name: string; amount: string; invoice: string; url: string }) =>
    build(
      "Payment received, thank you",
      [`Hi ${p.name},`, `We've received ${p.amount} for invoice ${p.invoice}.`],
      { label: "View billing", url: p.url },
    ),
  paymentFailed: (p: { name: string; invoice: string; url: string }) =>
    build(
      "Your payment didn't go through",
      [
        `Hi ${p.name},`,
        `The payment for invoice ${p.invoice} was not successful. Please try again or use another payment method.`,
      ],
      { label: "Pay invoice", url: p.url },
    ),
  invoiceIssued: (p: { name: string; invoice: string; amount: string; due: string; url: string }) =>
    build(
      `Invoice ${p.invoice}`,
      [`Hi ${p.name},`, `Invoice ${p.invoice} for ${p.amount} is due on ${p.due}.`],
      { label: "View and pay", url: p.url },
    ),
  invoiceOverdue: (p: { name: string; invoice: string; amount: string; url: string }) =>
    build(
      `Invoice ${p.invoice} is overdue`,
      [
        `Hi ${p.name},`,
        `Invoice ${p.invoice} (${p.amount}) is now overdue. If payment isn't received, some automated services may be paused. Your data and reports stay available.`,
      ],
      { label: "Pay now", url: p.url },
    ),
  servicePaused: (p: { name: string; url: string }) =>
    build(
      "Some services are paused",
      [
        `Hi ${p.name},`,
        "Because of an overdue invoice, automated work on your account is paused. Nothing has been deleted, and everything resumes as soon as payment is received.",
      ],
      { label: "View billing", url: p.url },
    ),
  serviceResumed: (p: { name: string; url: string }) =>
    build(
      "Your services have resumed",
      [`Hi ${p.name},`, "Thank you. Payment is confirmed and your services are running again."],
      { label: "Open your workspace", url: p.url },
    ),
  approvalRequested: (p: { name: string; title: string; url: string }) =>
    build(
      "Something needs your approval",
      [`Hi ${p.name},`, `"${p.title}" is ready for your review.`],
      { label: "Review now", url: p.url },
    ),
  reportReady: (p: { name: string; title: string; url: string }) =>
    build(
      "Your report is ready",
      [
        `Hi ${p.name},`,
        `"${p.title}" is ready. It covers what we did, what changed and what happens next.`,
      ],
      { label: "Read report", url: p.url },
    ),
  staffNotification: (p: { title: string; body: string; url: string }) =>
    build(p.title, [p.body], { label: "Open workspace", url: p.url }),
};

export type EmailTemplateName = keyof typeof emailTemplates;
