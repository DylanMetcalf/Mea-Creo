"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { suppressions } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { logActivity, userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import { linkedinPath, normaliseEmail, normalisePhoneDigits } from "@/modules/outreach/identifiers";
import { getPlatformOrganisation } from "@/modules/settings/service";

const schema = z.object({
  kind: z.enum(["email", "phone", "linkedin", "domain"]),
  identifier: z.string().trim().min(3, "Enter the address, number, profile or domain.").max(300),
});

/** Adds someone to the do-not-contact list without a lead record (e.g. an opt-out by phone). */
export async function addSuppressionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("leads.write");
    const parsed = parseForm(schema, formData);
    if (!parsed.success) return parsed.state;
    const { kind, identifier: raw } = parsed.data;
    const identifier =
      kind === "email"
        ? normaliseEmail(raw)
        : kind === "phone"
          ? normalisePhoneDigits(raw)
          : kind === "linkedin"
            ? linkedinPath(raw)
            : raw
                .toLowerCase()
                .replace(/^https?:\/\//, "")
                .replace(/^www\./, "")
                .split("/")[0];
    if (!identifier)
      return {
        ok: false,
        fieldErrors: { identifier: ["That doesn't look like a LinkedIn profile URL."] },
      };
    const db = await getDb();
    await db
      .insert(suppressions)
      .values({ kind, identifier, reason: "manual", source: "Mea Creo", createdById: ctx.user.id })
      .onConflictDoNothing();
    const platform = await getPlatformOrganisation(db);
    await logActivity(db, userActor(ctx.user), {
      organisationId: platform.id,
      action: "outreach.suppressed",
      summary: `Added a ${kind} to the do-not-contact list`,
    });
    refresh();
    return { ok: true, message: "Added. No outreach will go to them." };
  }, formData);
}
