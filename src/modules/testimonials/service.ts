import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { testimonials } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/ids";

export async function requestTestimonial(
  db: DbOrTx,
  input: { requestedFrom: string; organisationId?: string | null },
) {
  const [row] = await db
    .insert(testimonials)
    .values({
      token: randomToken(18),
      requestedFrom: input.requestedFrom,
      organisationId: input.organisationId ?? null,
    })
    .returning();
  return row;
}

export const testimonialSubmission = z.object({
  quote: z
    .string()
    .trim()
    .min(20, "A sentence or two is perfect.")
    .max(600, "Keep it under 600 characters."),
  name: z.string().trim().min(2, "Your name, please.").max(80),
  role: z.string().trim().min(2, "Your role, please.").max(80),
  company: z.string().trim().max(120).optional(),
  industry: z.string().trim().min(2, "Your industry, please.").max(80),
  attribution: z.enum(["named", "anonymous"]),
  consent: z.literal("on", { error: "Please confirm we may publish your words." }),
});

export async function getTestimonialRequest(db: DbOrTx, token: string) {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const [row] = await db.select().from(testimonials).where(eq(testimonials.token, token)).limit(1);
  return row ?? null;
}

export async function submitTestimonial(
  db: DbOrTx,
  token: string,
  data: z.infer<typeof testimonialSubmission>,
) {
  const row = await getTestimonialRequest(db, token);
  if (!row) throw new AppError("NOT_FOUND");
  if (row.status !== "requested")
    throw new AppError("CONFLICT", { userMessage: "This link has already been used. Thank you!" });
  await db
    .update(testimonials)
    .set({
      quote: data.quote,
      name: data.name,
      role: data.role,
      company: data.company || null,
      industry: data.industry,
      attribution: data.attribution,
      consentAt: new Date(),
      status: "submitted",
    })
    .where(eq(testimonials.id, row.id));
  return row;
}

export async function setTestimonialStatus(db: DbOrTx, id: string, status: "approved" | "hidden") {
  await db
    .update(testimonials)
    .set({ status, approvedAt: status === "approved" ? new Date() : null })
    .where(eq(testimonials.id, id));
}

export async function listTestimonials(db: DbOrTx) {
  return db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(200);
}

/** What the website may show: approved quotes, credited exactly as the client chose. */
export async function publishedTestimonials(db: DbOrTx) {
  const rows = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.status, "approved"))
    .orderBy(asc(testimonials.sortOrder), desc(testimonials.approvedAt))
    .limit(12);
  return rows
    .filter((r) => r.quote && r.consentAt)
    .map((r) => ({
      id: r.id,
      quote: r.quote!,
      credit:
        r.attribution === "named"
          ? [r.name, [r.role, r.company].filter(Boolean).join(", ")].filter(Boolean).join(" · ")
          : `${r.role}, ${r.industry ?? "client"}`,
    }));
}
