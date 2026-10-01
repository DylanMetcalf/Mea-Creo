import type { Channel, leads, ProspectBrief } from "@/db/schema";
import { checkQuality, type QualityIssue } from "@/agents/quality";

type Lead = typeof leads.$inferSelect;

export type OutreachPurpose =
  "consent_request" | "follow_up" | "booking_link" | "information" | "reply";

export interface Sender {
  name: string;
  title: string;
}

export interface ComposedMessage {
  subject: string | null;
  body: string;
  rationale: string;
}

const firstName = (lead: Lead) => {
  const n = lead.contactName?.trim().split(/\s+/)[0];
  return n && !/^(mr|mrs|ms|dr|prof)\.?$/i.test(n) ? n : null;
};

/** The single most useful, specific observation we can make, or null if we have none. */
export function bestObservation(lead: Lead, brief: ProspectBrief | null): string | null {
  const b = brief ?? lead.brief;
  const pick = [
    ...(b?.leadGenerationOpportunities ?? []),
    ...(b?.seoOpportunities ?? []),
    ...(b?.aeoOpportunities ?? []),
    ...(b?.geoOpportunities ?? []),
    ...(b?.contentOpportunities ?? []),
  ][0];
  if (!pick) return null;
  // Opportunities are stored as "Title: what to do"; the title alone reads naturally.
  return pick.split(": ")[0].replace(/\.$/, "");
}

/**
 * Rules-based drafts in Dylan's voice: short, specific, human, no hype. The first
 * message to someone who hasn't agreed to hear from us only asks permission
 * (POPIA s69): one useful observation, one question, an easy way to say no.
 */
export function composeOutreach(
  lead: Lead,
  purpose: OutreachPurpose,
  channel: Channel,
  sender: Sender,
  opts: { bookingUrl?: string; reportUrl?: string } = {},
): ComposedMessage {
  const name = firstName(lead);
  const hi = name ? `Hi ${name},` : "Hi,";
  const obs = bestObservation(lead, lead.brief);
  const sector = lead.industry ? lead.industry.toLowerCase() : null;
  const signOff =
    channel === "email"
      ? `\n\nKind regards,\n${sender.name}\n${sender.title}`
      : `\n\n${sender.name.split(" ")[0]}`;
  const why = lead.brief?.whyContact ?? lead.outreachAngle ?? "Target-sector business.";

  switch (purpose) {
    case "consent_request": {
      const opener = obs
        ? `I was looking at ${lead.company}'s website and noticed something that may be costing you enquiries: ${obs.charAt(0).toLowerCase()}${obs.slice(1)}.`
        : `I came across ${lead.company}${sector ? ` while looking at ${sector} businesses` : ""} and had a look at how easy you are to find and choose online.`;
      const body = [
        hi,
        "",
        opener,
        "",
        `I help ${sector ? `${sector} and other B2B` : "B2B"} businesses become easier to find, understand and choose online. I've put together a few specific observations for ${lead.company} and I'm happy to send them over, no cost and no obligation.`,
        "",
        "Would that be useful? If you'd rather not hear from me, just reply \"no thanks\" and I won't contact you again.",
      ].join("\n");
      return {
        subject: channel === "email" ? `A few observations about ${lead.company}'s website` : null,
        body: body + signOff,
        rationale: `First contact: asks permission before any marketing (POPIA s69). Why them: ${why}`,
      };
    }
    case "follow_up":
      return {
        subject: channel === "email" ? `Following up: ${lead.company}` : null,
        body:
          [
            hi,
            "",
            `${["contact_form", "booking", "visibility_report"].includes(lead.source) ? "Thanks for getting in touch." : "Thanks for your reply."} Here's what stood out for ${lead.company}${obs ? `, starting with the biggest opportunity: ${obs.charAt(0).toLowerCase()}${obs.slice(1)}` : ""}.`,
            ...(opts.reportUrl
              ? ["", `The full Visibility Report is here: ${opts.reportUrl}`]
              : []),
            "",
            "If it would help to talk it through, I'm happy to set up a 30-minute call.",
          ].join("\n") + signOff,
        rationale: "Follow-up to someone who agreed to hear from us.",
      };
    case "booking_link":
      return {
        subject: channel === "email" ? `Booking a time to talk` : null,
        body:
          [
            hi,
            "",
            "Great, thank you. You can pick a 30-minute slot that suits you here:",
            opts.bookingUrl ?? "[booking link]",
            "",
            "Before the call I'll prepare a short review of your current visibility, so the time is useful whatever you decide.",
          ].join("\n") + signOff,
        rationale: "They asked for a call: send the booking link.",
      };
    case "information":
      return {
        subject: channel === "email" ? `More about how we'd help ${lead.company}` : null,
        body:
          [
            hi,
            "",
            "Thanks for asking. In short: I work with a small number of businesses at a time, on visibility (search, AI and Google), lead generation and the systems behind them. Work starts with a Foundation assessment so we're working from evidence, not assumptions.",
            "",
            "[Answer their specific question here.]",
            "",
            "If a short call would be easier, I'm happy to set one up.",
          ].join("\n") + signOff,
        rationale: "They asked for more information. Edit the placeholder before approving.",
      };
    case "reply":
      return {
        subject: channel === "email" ? `Re: ${lead.company}` : null,
        body: [hi, "", "[Your reply]"].join("\n") + signOff,
        rationale: "Reply drafted for editing.",
      };
  }
}

const OUTREACH_BANS: [RegExp, string][] = [
  [/dear (sir|madam|sir\/madam|sirs)|sir\/madam|to whom it may concern/i, "Impersonal greeting"],
  [
    /\bwe are (a|the) (leading|premier|top|best)\b|\bleading (digital|marketing|seo|web)?\s*(agency|provider|company|firm)\b/i,
    "Generic agency claim",
  ],
  [/\b(act now|limited time|don't miss out|last chance|exclusive offer)\b/i, "Pressure tactics"],
];

/** QC for outreach: the general checks plus things that make a message sound like spam. */
export function checkOutreachQuality(
  text: string,
  opts: { firstContact?: boolean } = {},
): {
  passed: boolean;
  issues: QualityIssue[];
} {
  const base = checkQuality(text);
  const issues = [...base.issues];
  for (const [re, rule] of OUTREACH_BANS) {
    const m = text.match(re);
    if (m) issues.push({ severity: "block", rule, detail: `"${m[0]}"` });
  }
  if (/!!|\b[A-Z]{8,}\b/.test(text))
    issues.push({
      severity: "warn",
      rule: "Shouting",
      detail: "Avoid capitals and repeated exclamation marks.",
    });
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 200)
    issues.push({
      severity: "warn",
      rule: "Too long",
      detail: `${words} words; aim for under 150.`,
    });
  if ((text.match(/https?:\/\//g) ?? []).length > 2)
    issues.push({ severity: "warn", rule: "Too many links", detail: "Keep to one or two links." });
  if (opts.firstContact && !/no thanks|not hear from|won't contact|unsubscribe|opt out/i.test(text))
    issues.push({
      severity: "block",
      rule: "No opt-out",
      detail: "A first message must say how to opt out.",
    });
  if (/\[(answer|your reply|booking link)/i.test(text))
    issues.push({
      severity: "block",
      rule: "Placeholder text",
      detail: "Replace the [placeholder] before sending.",
    });
  return { passed: !issues.some((i) => i.severity === "block"), issues };
}
