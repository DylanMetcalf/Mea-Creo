import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { clients, documents } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { type Actor, logActivity } from "@/modules/activity/log";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Stores a client's logo, normalised to a trimmed PNG (max 800px wide) so it renders the
 * same in the workspace, portal, emails and PDFs. SVG is refused: it can carry scripts.
 */
export async function setClientLogo(
  db: DbOrTx,
  organisationId: string,
  file: File,
  actor: Actor & { userId?: string },
): Promise<void> {
  if (!LOGO_TYPES.includes(file.type))
    throw new AppError("VALIDATION", { userMessage: "Upload the logo as a PNG, JPG or WebP." });
  if (file.size > MAX_LOGO_BYTES)
    throw new AppError("VALIDATION", { userMessage: "Logos can be up to 5 MB." });
  const storage = resolveIntegration("storage");
  if (!storage.available)
    throw new AppError("INTEGRATION_NOT_CONNECTED", {
      userMessage: "File storage isn't configured yet.",
    });
  const sharp = (await import("sharp")).default;
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await file.arrayBuffer()))
      .trim({ threshold: 4 })
      .resize({ width: 800, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    throw new AppError("VALIDATION", { userMessage: "We couldn't read that image." });
  }
  const id = uuidv7();
  const key = `orgs/${organisationId}/brand/${id}/logo.png`;
  await storage.adapter.putObject(key, new Uint8Array(png), "image/png");
  await db.insert(documents).values({
    id,
    groupId: id,
    organisationId,
    name: "Logo.png",
    category: "logo",
    storageKey: key,
    contentType: "image/png",
    sizeBytes: png.byteLength,
    checksum: createHash("sha256").update(png).digest("hex"),
    uploadedById: actor.userId,
    visibility: "client",
    description: "Company logo",
  });
  await db
    .update(clients)
    .set({ logoDocumentId: id })
    .where(eq(clients.organisationId, organisationId));
  await logActivity(db, actor, {
    organisationId,
    action: "client.logo_updated",
    summary: "Updated the company logo",
    entityType: "document",
    entityId: id,
  });
}

/** The logo bytes for an organisation, or null. Callers authorise access first. */
export async function getClientLogo(
  db: DbOrTx,
  organisationId: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  const [row] = await db
    .select({ key: documents.storageKey })
    .from(clients)
    .innerJoin(documents, eq(documents.id, clients.logoDocumentId))
    .where(eq(clients.organisationId, organisationId))
    .limit(1);
  if (!row) return null;
  const storage = resolveIntegration("storage");
  if (!storage.available) return null;
  try {
    return await storage.adapter.getObject(row.key);
  } catch {
    return null;
  }
}
