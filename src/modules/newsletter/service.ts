import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { NEWSLETTER_TOPICS, type NewsletterTopic, newsletterSubscribers } from "@/db/schema";
import { randomToken } from "@/lib/ids";

export const NEWSLETTER_CONSENT_TEXT =
  "I'd like to receive Mea Creo's newsletter by email. I can unsubscribe at any time with the link in every email.";

export const TOPIC_LABELS: Record<NewsletterTopic, string> = {
  search_visibility: "Search & AI visibility (SEO, AEO, GEO)",
  linkedin: "LinkedIn",
  lead_generation: "Lead generation",
  social_media: "Social media",
  photo_video: "Photography & video",
  automation: "AI & automation",
};

export const subscribeSchema = z.object({
  email: z.email("Please enter a valid email address."),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
  topics: z.array(z.enum(NEWSLETTER_TOPICS)).default([]),
  consent: z.literal("on", { error: "Please tick the box to confirm you'd like the newsletter." }),
  source: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
});

/**
 * Adds or re-subscribes an address with fresh consent. Returns nothing about whether the
 * address was already known, so the form can't be used to discover subscribers.
 */
export async function subscribe(db: DbOrTx, input: z.infer<typeof subscribeSchema>): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);
  if (existing) {
    await db
      .update(newsletterSubscribers)
      .set({
        status: "subscribed",
        name: input.name ?? existing.name,
        topics: input.topics.length ? input.topics : existing.topics,
        consentAt: now,
        consentText: NEWSLETTER_CONSENT_TEXT,
        source: input.source ?? existing.source,
        unsubscribedAt: null,
      })
      .where(eq(newsletterSubscribers.id, existing.id));
    return;
  }
  await db.insert(newsletterSubscribers).values({
    email,
    name: input.name,
    topics: input.topics,
    status: "subscribed",
    consentAt: now,
    consentText: NEWSLETTER_CONSENT_TEXT,
    source: input.source,
    unsubscribeToken: randomToken(24),
  });
}

/** One-click unsubscribe. Returns false for an unknown or malformed token. */
export async function unsubscribe(db: DbOrTx, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false;
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.unsubscribeToken, token))
    .returning({ id: newsletterSubscribers.id });
  return Boolean(row);
}

export async function listSubscribers(db: DbOrTx) {
  return db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
}

/** CSV of current subscribers only: unsubscribed addresses must never be mailed. */
export function subscribersCsv(rows: (typeof newsletterSubscribers.$inferSelect)[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [["email", "name", "topics", "consent_at", "source"].join(",")];
  for (const r of rows.filter((r) => r.status === "subscribed"))
    lines.push(
      [
        r.email,
        r.name ?? "",
        r.topics.map((t) => TOPIC_LABELS[t]).join("; "),
        r.consentAt.toISOString(),
        r.source ?? "",
      ]
        .map(esc)
        .join(","),
    );
  return lines.join("\n");
}
