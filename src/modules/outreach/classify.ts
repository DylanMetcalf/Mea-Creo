import type { ResponseClass } from "@/db/schema";

export interface Classification {
  class: ResponseClass;
  reason: string;
  nextAction: string;
}

const RULES: [ResponseClass, RegExp, string][] = [
  [
    "opt_out",
    /\b(unsubscribe|opt[ -]?out|remove (me|us)|take (me|us) off|stop (emailing|contacting|messaging)|do not (contact|email)|don'?t (contact|email|message)|no thanks|not interested,? (please )?(remove|stop))\b/i,
    "Asked not to be contacted",
  ],
  [
    "out_of_office",
    /\b(out of (the )?office|on leave|annual leave|automatic reply|auto-?reply|away until|currently away|back on)\b/i,
    "Automatic out-of-office reply",
  ],
  [
    "wrong_person",
    /\b(wrong person|not the right person|no longer (with|at)|left the company|not my department|try contacting|speak to (our|my))\b/i,
    "Says they're not the right contact",
  ],
  [
    "not_interested",
    /\b(not interested|no need|we('re| are) (sorted|covered|happy)|already have (an?|someone)|not (right )?now|not at this (time|stage))\b/i,
    "Not interested",
  ],
  [
    "wants_proposal",
    /\b(proposal|quote|quotation|pricing|price list|costing|send (me|us) (a|your) (quote|proposal))\b/i,
    "Asked for a proposal or pricing",
  ],
  [
    "wants_call",
    /\b(call|chat|meet|meeting|zoom|teams|talk|available (on|at)|diary|calendar|schedule)\b/i,
    "Wants to talk",
  ],
  [
    "needs_information",
    /\b(more info|more information|tell me more|how (does|do|much)|what (does|do|would)|can you explain|which services|examples?|portfolio)\b|\?/i,
    "Asked a question",
  ],
  [
    "interested",
    /\b(yes|sure|please (send|do)|go ahead|sounds (good|great|interesting)|interested|keen|happy to)\b/i,
    "Interested",
  ],
  ["positive", /\b(thanks|thank you|appreciate|great|helpful)\b/i, "Positive reply"],
];

const SPAM =
  /\b(guest post|backlinks?|crypto|bitcoin|casino|seo services for your|we can rank your|loan offer)\b/i;

const NEXT: Record<ResponseClass, string> = {
  opt_out: "Suppressed: no further outreach on any channel.",
  out_of_office: "Try again after they're back. No action until then.",
  wrong_person: "Find the right contact and ask permission again.",
  not_interested: "Close politely. No further outreach.",
  wants_proposal: "Prepare a proposal (or book a call first to scope it).",
  wants_call: "Send the booking link.",
  needs_information: "Answer their question.",
  interested: "Send the observations / Visibility Report and offer a call.",
  positive: "Reply and offer a next step.",
  unclear: "Read and decide.",
  spam: "Ignore.",
  other: "Read and decide.",
};

/**
 * Rules-based reply classification (handoff §27). Order matters: an opt-out wins over
 * everything, so "no thanks, please remove me" is never treated as a lead.
 * Dylan can always correct the class on the lead page.
 */
export function classifyResponse(text: string): Classification {
  const t = text.trim();
  if (!t) return { class: "unclear", reason: "Empty message", nextAction: NEXT.unclear };
  if (SPAM.test(t))
    return { class: "spam", reason: "Looks like unsolicited sales spam", nextAction: NEXT.spam };
  for (const [cls, re, reason] of RULES)
    if (re.test(t)) return { class: cls, reason, nextAction: NEXT[cls] };
  return { class: "unclear", reason: "No clear intent", nextAction: NEXT.unclear };
}

export function nextActionFor(cls: ResponseClass): string {
  return NEXT[cls];
}
