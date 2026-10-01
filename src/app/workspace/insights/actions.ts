"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkQuality } from "@/agents/quality";
import { getDb } from "@/db";
import {
  CASE_STUDY_TYPES,
  caseStudies,
  CONTENT_STATUSES,
  INSIGHT_CATEGORIES,
  insights,
} from "@/db/schema";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { slugify } from "@/lib/ids";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";

const insightSchema = z.object({
  title: z.string().trim().min(5).max(160),
  slug: optionalText(120),
  summary: z.string().trim().min(10, "Write a short summary.").max(400),
  body: z.string().min(50, "The article is too short.").max(60_000),
  category: z.enum(INSIGHT_CATEGORIES),
  authorName: z.string().trim().min(2).max(80),
  status: z.enum(CONTENT_STATUSES),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  faq: z.string().max(10_000).optional(),
});

/** "Q: … / A: …" pairs, one blank line between pairs. */
function parseFaq(text = "") {
  return text
    .split(/\n\s*\n/)
    .map((block) => {
      const q = block.match(/^Q:\s*(.+)$/im)?.[1]?.trim();
      const a = block.match(/^A:\s*([\s\S]+)$/im)?.[1]?.trim();
      return q && a ? { question: q, answer: a } : null;
    })
    .filter((x): x is { question: string; answer: string } => !!x);
}

export async function saveInsightAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("content.write");
    const parsed = parseForm(insightSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.status === "published") {
      const qc = checkQuality([d.title, d.summary, d.body].join("\n")).issues.filter(
        (i) => i.severity === "block",
      );
      if (qc.length)
        return {
          ok: false,
          message: `Can't publish yet: ${qc.map((i) => `${i.rule} (${i.detail})`).join("; ")}.`,
          values: Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
        };
    }
    const db = await getDb();
    const id = String(formData.get("insightId") ?? "");
    const words = d.body.split(/\s+/).length;
    const values = {
      title: d.title,
      slug: slugify(d.slug || d.title).slice(0, 100),
      summary: d.summary,
      body: d.body,
      category: d.category,
      authorName: d.authorName,
      status: d.status,
      seoTitle: d.seoTitle ?? null,
      seoDescription: d.seoDescription ?? null,
      faq: parseFaq(d.faq),
      readingMinutes: Math.max(1, Math.round(words / 220)),
    };
    if (id) {
      const [before] = await db
        .select({ publishedAt: insights.publishedAt })
        .from(insights)
        .where(eq(insights.id, id));
      await db
        .update(insights)
        .set({
          ...values,
          publishedAt:
            d.status === "published" ? (before?.publishedAt ?? new Date()) : before?.publishedAt,
        })
        .where(eq(insights.id, id));
    } else {
      const [row] = await db
        .insert(insights)
        .values({ ...values, publishedAt: d.status === "published" ? new Date() : null })
        .returning({ id: insights.id });
      createdId = row.id;
    }
    await logActivity(db, userActor(ctx.user), {
      action: "insight.saved",
      summary: `Saved article "${d.title}" (${d.status})`,
    });
    revalidatePath("/insights");
    refresh();
    return { ok: true, message: d.status === "published" ? "Published." : "Saved." };
  }, formData);
  if (createdId) redirect(`/workspace/insights/${createdId}`);
  return state;
}

const caseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  clientName: z.string().trim().min(2).max(120),
  type: z.enum(CASE_STUDY_TYPES),
  industry: optionalText(120),
  summary: z.string().trim().min(10).max(600),
  challenge: optionalText(3000),
  strategy: optionalText(3000),
  workCompleted: optionalText(3000),
  timeline: optionalText(300),
  status: z.enum(CONTENT_STATUSES),
  clientPermission: z.string().optional(),
  outcomes: z.string().max(4000).optional(),
});

/** One outcome per line: "Label | Value | Source | verified". Unverified outcomes stay private. */
function parseOutcomes(text = "") {
  return text
    .split("\n")
    .map((l) => l.split("|").map((p) => p.trim()))
    .filter((p) => p[0] && p[1])
    .map(([label, value, source, verified]) => ({
      label,
      value,
      source: source || undefined,
      verified: /^(yes|verified|true)$/i.test(verified ?? ""),
    }));
}

export async function saveCaseStudyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("content.write");
    const parsed = parseForm(caseSchema, formData);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const permission = d.clientPermission === "on";
    if (d.status === "published" && !permission)
      return { ok: false, message: "Confirm the client agreed to be featured before publishing." };
    const db = await getDb();
    const id = String(formData.get("caseStudyId") ?? "");
    const { outcomes, ...rest } = d;
    const values = {
      ...rest,
      outcomes: parseOutcomes(outcomes),
      clientPermission: permission,
      slug: slugify(`${d.clientName}-${d.title}`).slice(0, 100),
    };
    if (id) await db.update(caseStudies).set(values).where(eq(caseStudies.id, id));
    else
      createdId = (await db.insert(caseStudies).values(values).returning({ id: caseStudies.id }))[0]
        .id;
    await logActivity(db, userActor(ctx.user), {
      action: "case_study.saved",
      summary: `Saved case study "${d.title}" (${d.status})`,
    });
    revalidatePath("/work");
    refresh();
    return { ok: true, message: "Saved. Outcomes show publicly only when marked verified." };
  }, formData);
  if (createdId) redirect(`/workspace/insights/work/${createdId}`);
  return state;
}
