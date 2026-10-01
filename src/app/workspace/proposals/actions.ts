"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { proposals } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { fromMajor, isCurrency } from "@/lib/money";
import { userActor } from "@/modules/activity/log";
import { requireStaff } from "@/modules/auth/context";
import {
  addProposalItem,
  getProposal,
  proposalEditSchema,
  removeProposalItem,
  sendProposal,
  updateProposal,
} from "@/modules/proposals/service";

const minor = (value: FormDataEntryValue | null, currency: string) => {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  return cleaned ? fromMajor(cleaned, isCurrency(currency) ? currency : "ZAR").amountMinor : 0;
};

export async function saveProposalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireStaff("proposals.write");
    const parsed = parseForm(proposalEditSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const id = String(formData.get("proposalId"));
    const data = await getProposal(db, id);
    if (!data) throw new AppError("NOT_FOUND");
    const c = data.proposal.currency;
    const itemPrices = data.items.map((i) => ({
      id: i.id,
      setupMinor: minor(formData.get(`item.${i.id}.setup`), c),
      monthlyMinor: minor(formData.get(`item.${i.id}.monthly`), c),
      oneOffMinor: minor(formData.get(`item.${i.id}.oneoff`), c),
      optional: formData.get(`item.${i.id}.optional`) === "on",
    }));
    await updateProposal(db, id, parsed.data, itemPrices);
    refresh();
    return { ok: true, message: "Saved." };
  }, formData);
}

export async function addItemAction(formData: FormData): Promise<void> {
  await requireStaff("proposals.write");
  const db = await getDb();
  const id = String(formData.get("proposalId"));
  const [p] = await db
    .select({ currency: proposals.currency, status: proposals.status })
    .from(proposals)
    .where(eq(proposals.id, id));
  if (!p || p.status === "accepted")
    throw new AppError("CONFLICT", { userMessage: "This proposal can't be changed." });
  await addProposalItem(db, id, String(formData.get("serviceId")), p.currency);
  refresh();
}

export async function removeItemAction(itemId: string, formData: FormData): Promise<void> {
  await requireStaff("proposals.write");
  const db = await getDb();
  const id = String(formData.get("proposalId"));
  const [p] = await db
    .select({ status: proposals.status })
    .from(proposals)
    .where(eq(proposals.id, id));
  if (!p || p.status === "accepted")
    throw new AppError("CONFLICT", { userMessage: "This proposal can't be changed." });
  await removeProposalItem(db, id, itemId);
  refresh();
}

export async function sendProposalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireStaff("proposals.send");
    await sendProposal(await getDb(), String(formData.get("proposalId")), userActor(ctx.user));
    refresh();
    return { ok: true, message: "Sent. The client receives an email with a secure link." };
  }, formData);
}
