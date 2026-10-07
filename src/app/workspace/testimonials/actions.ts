"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { requestTestimonial, setTestimonialStatus } from "@/modules/testimonials/service";

export async function requestTestimonialAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("clients.write");
    const parsed = parseForm(
      z.object({
        requestedFrom: z.string().trim().min(2, "Who are you asking?").max(120),
        organisationId: z.string().optional(),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const row = await requestTestimonial(db, {
      requestedFrom: parsed.data.requestedFrom,
      organisationId: parsed.data.organisationId || null,
    });
    await logActivity(db, userActor(ctx.user), {
      action: "testimonial.requested",
      summary: `Requested a testimonial from ${row.requestedFrom}`,
    });
    refresh();
    return { ok: true, message: `Send this link: ${absoluteUrl(`/testimonial/${row.token}`)}` };
  }, fd);
}

export async function testimonialStatusAction(
  id: string,
  status: "approved" | "hidden",
): Promise<void> {
  const ctx = await requireStaff("clients.write");
  const db = await getDb();
  await setTestimonialStatus(db, id, status);
  await logActivity(db, userActor(ctx.user), {
    action: `testimonial.${status}`,
    summary: `${status === "approved" ? "Approved" : "Hid"} a testimonial`,
  });
  refresh();
}
