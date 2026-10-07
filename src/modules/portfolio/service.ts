import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { portfolioLinks } from "@/db/schema";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_PHOTOS } from "@/content/portfolio";
import { randomToken } from "@/lib/ids";

export async function createPortfolioLink(
  db: DbOrTx,
  input: {
    label: string;
    message?: string;
    categories: string[];
    expiresInDays: number | null;
    userId: string;
  },
) {
  const categories = input.categories.filter((c) => c in PORTFOLIO_CATEGORIES);
  const [row] = await db
    .insert(portfolioLinks)
    .values({
      token: randomToken(18),
      label: input.label,
      message: input.message || null,
      categories: categories.length ? categories : Object.keys(PORTFOLIO_CATEGORIES),
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 86400_000)
        : null,
      createdById: input.userId,
    })
    .returning();
  return row;
}

export async function listPortfolioLinks(db: DbOrTx) {
  return db.select().from(portfolioLinks).orderBy(desc(portfolioLinks.createdAt)).limit(100);
}

export async function revokePortfolioLink(db: DbOrTx, id: string) {
  await db.update(portfolioLinks).set({ revokedAt: new Date() }).where(eq(portfolioLinks.id, id));
}

/** Resolves a share token to its photos, or null if unknown, revoked or expired. Counts the view. */
export async function openPortfolioLink(db: DbOrTx, token: string, countView = true) {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const [link] = await db
    .select()
    .from(portfolioLinks)
    .where(eq(portfolioLinks.token, token))
    .limit(1);
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) return null;
  if (countView)
    await db
      .update(portfolioLinks)
      .set({ viewCount: sql`${portfolioLinks.viewCount} + 1`, lastViewedAt: new Date() })
      .where(and(eq(portfolioLinks.id, link.id)));
  const photos = PORTFOLIO_PHOTOS.filter((p) => link.categories.includes(p.category));
  return { link, photos };
}
