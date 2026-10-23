import { runAgent } from "@/agents/runtime";
import type { DbOrTx } from "@/db";
import { resolveIntegration } from "@/integrations/registry";

/**
 * The blog assistant. Everything it produces is a draft for a person to review: it never
 * publishes. Without an AI provider it offers only a structural outline template, built
 * from the brief's own words, and says plainly that the writing is still to be done.
 */

export const ASSIST_MODES = [
  "outline",
  "draft",
  "expand",
  "improve",
  "seo",
  "visual_brief",
] as const;
export type AssistMode = (typeof ASSIST_MODES)[number];

export const ASSIST_MODE_LABELS: Record<AssistMode, string> = {
  outline: "Generate an outline",
  draft: "Draft an article from a topic",
  expand: "Expand my notes into an article",
  improve: "Improve this draft",
  seo: "Suggest SEO title, description, internal links and CTA",
  visual_brief: "Write a brief for the featured image",
};

/** Modes that create a new draft article; the rest return suggestions for the editor. */
export const CREATES_ARTICLE: AssistMode[] = ["outline", "draft", "expand"];

export interface AssistBrief {
  mode: AssistMode;
  topic: string;
  audience?: string;
  purpose?: string;
  tone?: string;
  length?: "short" | "medium" | "long";
  cta?: string;
  notes?: string;
  /** The current article text, for improve / seo / visual_brief. */
  existing?: string;
}

export interface AssistResult {
  source: "ai" | "rules";
  title?: string;
  summary?: string;
  body: string;
  costMicroUsd: number;
}

const WORDS = { short: "600-800", medium: "1,000-1,400", long: "1,800-2,400" } as const;

const SYSTEM = `You write for Mea Creo, a South African business that helps companies become easier to find (SEO, AEO, GEO), easier to understand and easier to choose (LinkedIn, social media, photography and video, websites, lead generation, AI automation).
Voice: friendly, plain, specific and honest. Professional without being stiff. South African/British English. No hype, no clichés, no "in today's fast-paced world".
Hard rules:
- Never invent statistics, studies, quotes, client names, results or citations. Where a fact or number would help, write [VERIFY: what to check] instead.
- Never promise rankings, traffic or AI citations.
- Write in Markdown with ## and ### headings and short paragraphs.
- Questions people actually ask make good ### headings; answer them directly in the first sentence.`;

export function aiAvailable(): boolean {
  const ai = resolveIntegration("ai");
  return ai.available && !ai.adapter.isMock;
}

function briefLines(b: AssistBrief): string {
  return [
    `Topic: ${b.topic}`,
    b.audience && `Audience: ${b.audience}`,
    b.purpose && `Purpose: ${b.purpose}`,
    b.tone && `Tone: ${b.tone}`,
    b.cta && `Call to action at the end: ${b.cta}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function prompt(b: AssistBrief): string {
  const len = WORDS[b.length ?? "medium"];
  switch (b.mode) {
    case "outline":
      return `${briefLines(b)}\n\nWrite a detailed outline: a working title on the first line as "# Title", a one-sentence summary on the second line starting "Summary:", then ## and ### headings with 1-2 bullet notes under each on what to say. End with a "## Next step" section for the call to action.`;
    case "draft":
      return `${briefLines(b)}\n\nWrite a complete first draft of about ${len} words. First line "# Title", second line "Summary: <one sentence>", then the article.`;
    case "expand":
      return `${briefLines(b)}\n\nExpand these notes into a structured article of about ${len} words. Keep every point the notes make; don't add facts that aren't in them. First line "# Title", second line "Summary: <one sentence>".\n\nNotes:\n${b.notes ?? ""}`;
    case "improve":
      return `${briefLines(b)}\n\nImprove this draft: clearer structure, plainer language, stronger opening and a clear next step. Keep its facts; mark anything doubtful with [VERIFY: …]. Return the full revised article only.\n\nDraft:\n${b.existing ?? ""}`;
    case "seo":
      return `${briefLines(b)}\n\nFor this article, suggest: an SEO title (under 60 characters), a meta description (140-155 characters), 3-5 internal links to Mea Creo pages chosen from /services/visibility, /services/growth, /services/content, /services/technology, /services/consulting, /pricing, /visibility-report, /book, /contact (give the anchor text and the URL), and one call to action that fits. Use short labelled lines.\n\nArticle:\n${b.existing ?? ""}`;
    case "visual_brief":
      return `${briefLines(b)}\n\nWrite a brief for one featured image for this article: what it should show, composition, mood, Mea Creo's deep green palette, and what to avoid (no fake dashboards, logos or text in the image). Also give alt text under 125 characters.\n\nArticle:\n${b.existing ?? ""}`;
  }
}

/** Without AI: a structural outline from the brief's own words, clearly marked as a template. */
export function outlineTemplate(b: AssistBrief): string {
  const who = b.audience || "your readers";
  return [
    `# ${b.topic}`,
    `Summary: [Write one sentence on what ${who} will get from this article.]`,
    "",
    "> Outline template: AI isn't connected, so this is a structure to write into, not a draft.",
    "",
    `## What ${b.topic.toLowerCase()} means`,
    "- Explain it in one or two plain sentences.",
    "",
    `## Why it matters for ${who}`,
    "- The problem it solves, in their words.",
    "",
    "## How to approach it",
    "- Three to five practical steps.",
    "",
    "## Common questions",
    "### [A question customers actually ask]?",
    "- Answer it directly in the first sentence.",
    "",
    "## Next step",
    `- ${b.cta || "Invite the reader to book a call or request a Visibility Report."}`,
  ].join("\n");
}

/** Splits "# Title" and "Summary:" off the top of generated Markdown. */
export function splitDraft(text: string): { title?: string; summary?: string; body: string } {
  const lines = text
    .replace(/^```(?:markdown)?\n|```$/g, "")
    .trim()
    .split("\n");
  let title: string | undefined;
  let summary: string | undefined;
  if (/^#\s+/.test(lines[0] ?? "")) title = lines.shift()!.replace(/^#\s+/, "").trim();
  while (lines.length && !lines[0].trim()) lines.shift();
  if (/^summary:/i.test(lines[0] ?? ""))
    summary = lines
      .shift()!
      .replace(/^summary:\s*/i, "")
      .trim();
  return { title, summary, body: lines.join("\n").trim() };
}

export async function runBlogAssistant(db: DbOrTx, brief: AssistBrief): Promise<AssistResult> {
  const withAi = aiAvailable();
  if (!withAi && brief.mode !== "outline") throw new Error("AI_UNAVAILABLE");
  const outcome = await runAgent(db, {
    agent: "content",
    action: "write.content_drafts",
    organisationId: null,
    input: { mode: brief.mode, topic: brief.topic.slice(0, 200), length: brief.length },
    prompt: {
      system: SYSTEM,
      user: prompt(brief),
      maxTokens:
        brief.mode === "draft" || brief.mode === "expand" || brief.mode === "improve" ? 4000 : 1500,
    },
    rules: () => (brief.mode === "outline" ? outlineTemplate(brief) : ""),
  });
  if (outcome.status !== "succeeded" || !outcome.text)
    throw new Error(outcome.reason || "The assistant couldn't produce a result.");
  if (!CREATES_ARTICLE.includes(brief.mode))
    return {
      source: outcome.source,
      body: outcome.text.trim(),
      costMicroUsd: outcome.costMicroUsd,
    };
  return {
    source: outcome.source,
    ...splitDraft(outcome.text),
    costMicroUsd: outcome.costMicroUsd,
  };
}
