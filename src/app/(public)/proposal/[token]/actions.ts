"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { requestMeta } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/auth/rate-limit";
import { startCheckout } from "@/modules/billing/service";
import {
  acceptanceSchema,
  acceptProposal,
  declineProposal,
  getProposalByToken,
} from "@/modules/proposals/service";

export async function acceptProposalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const token = String(formData.get("token"));
    const meta = await requestMeta();
    const db = await getDb();
    await enforceRateLimit(db, `proposal-accept:${meta.ipAddress ?? "unknown"}`, 10, 3600);
    const parsed = parseForm(acceptanceSchema, formData);
    if (!parsed.success) return parsed.state;
    await acceptProposal(db, token, parsed.data, meta.ipAddress);
    refresh();
    return { ok: true };
  }, formData);
}

export async function declineProposalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const db = await getDb();
    await declineProposal(
      db,
      String(formData.get("token")),
      String(formData.get("reason") ?? "").slice(0, 500) || undefined,
    );
    refresh();
    return { ok: true, message: "Thank you for letting us know." };
  }, formData);
}

/** Starts checkout for the accepted proposal's first invoice. The token is the credential. */
export async function payProposalInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const token = String(formData.get("token"));
    const db = await getDb();
    const data = await getProposalByToken(db, token);
    if (!data?.proposal.organisationId || data.proposal.status !== "accepted")
      throw new AppError("NOT_FOUND");
    const { proposal } = data;
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.organisationId, proposal.organisationId!),
          inArray(invoices.status, ["open", "overdue"]),
        ),
      )
      .limit(1);
    if (!invoice) return { ok: false, message: "There's nothing to pay right now." };
    const redirect = await startCheckout(db, {
      organisationId: proposal.organisationId!,
      invoiceId: invoice.id,
      customer: {
        email: proposal.acceptedByEmail ?? proposal.contactEmail ?? "",
        name: proposal.acceptedByName ?? proposal.contactName ?? proposal.companyName,
      },
      returnPath: `/proposal/${token}`,
    });
    return { ok: true, data: { checkout: redirect } };
  }, formData);
}
