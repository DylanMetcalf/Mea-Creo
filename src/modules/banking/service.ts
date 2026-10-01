import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "@/db";
import { settings } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { getPlatformOrganisation } from "@/modules/settings/service";

/**
 * Mea Creo's bank details for EFT payments.
 *
 * Private business information: stored only encrypted (AES-256-GCM with ENCRYPTION_KEY) in
 * the settings table, never in source code, never sent to AI, never on the public site.
 * Read only to render authorised invoices and the signed-in client's billing page.
 */
export const bankDetailsSchema = z.object({
  bank: z.string().trim().min(2, "Enter the bank.").max(80),
  accountHolder: z.string().trim().min(2, "Enter the account holder.").max(120),
  accountType: z.string().trim().max(60),
  branchCode: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Branch code is 4–8 digits."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,16}$/, "Account number is 6–16 digits."),
});
export type BankDetails = z.infer<typeof bankDetailsSchema>;

const KEY = "banking";

export async function getBankDetails(db: DbOrTx): Promise<BankDetails | null> {
  const platform = await getPlatformOrganisation(db);
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.organisationId, platform.id), eq(settings.key, KEY)))
    .limit(1);
  const encrypted = (row?.value as { encrypted?: string } | undefined)?.encrypted;
  if (!encrypted) return null;
  try {
    return bankDetailsSchema.parse(JSON.parse(decryptSecret(encrypted)));
  } catch (error) {
    logger.error({ err: String(error) }, "bank details could not be decrypted");
    return null;
  }
}

export async function setBankDetails(
  db: DbOrTx,
  details: BankDetails,
  updatedById: string,
): Promise<void> {
  const platform = await getPlatformOrganisation(db);
  const value = { encrypted: encryptSecret(JSON.stringify(bankDetailsSchema.parse(details))) };
  await db
    .insert(settings)
    .values({ organisationId: platform.id, key: KEY, value, updatedById })
    .onConflictDoUpdate({
      target: [settings.organisationId, settings.key],
      set: { value, updatedById, updatedAt: new Date() },
    });
}

/** "•••• 1234": safe to show in the workspace. */
export function maskAccountNumber(accountNumber: string): string {
  return `•••• ${accountNumber.slice(-4)}`;
}

/** Lines for an invoice or the client's billing page. */
export function eftLines(details: BankDetails, reference: string): string[] {
  return [
    `Bank: ${details.bank}`,
    `Account holder: ${details.accountHolder}`,
    ...(details.accountType ? [`Account type: ${details.accountType}`] : []),
    `Branch code: ${details.branchCode}`,
    `Account number: ${details.accountNumber}`,
    `Reference: ${reference}`,
  ];
}
