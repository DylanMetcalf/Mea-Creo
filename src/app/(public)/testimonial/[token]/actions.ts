"use server";

import { getDb } from "@/db";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { requestMeta } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/auth/rate-limit";
import { notifyStaff } from "@/modules/notifications/service";
import { submitTestimonial, testimonialSubmission } from "@/modules/testimonials/service";

export async function submitTestimonialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const meta = await requestMeta();
    const db = await getDb();
    await enforceRateLimit(db, `testimonial:${meta.ipAddress ?? "unknown"}`, 10, 3600);
    const parsed = parseForm(testimonialSubmission, fd);
    if (!parsed.success) return parsed.state;
    const row = await submitTestimonial(db, String(fd.get("token")), parsed.data);
    await notifyStaff(db, {
      kind: "testimonial.submitted",
      title: `New testimonial from ${row.requestedFrom}`,
      link: "/workspace/testimonials",
    });
    return { ok: true, message: "Thank you! Dylan will see it shortly." };
  }, fd);
}
