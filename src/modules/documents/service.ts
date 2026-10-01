import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { type DocumentCategory, documents, timelineEntries } from "@/db/schema";
import { resolveIntegration } from "@/integrations/registry";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { type Actor, logActivity } from "@/modules/activity/log";
import { emitEvent } from "@/modules/notifications/service";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Allowed types: documents, spreadsheets, presentations, images, video, design and text files. */
const ALLOWED: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "text/csv": ["csv"],
  "text/plain": ["txt", "md"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/svg+xml": ["svg"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "application/zip": ["zip"],
  "application/postscript": ["eps", "ai"],
};

export function validateUpload(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES)
    return "Files can be up to 25 MB. For larger videos, share a link instead.";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExt = ALLOWED[file.type];
  if (!allowedExt || !allowedExt.includes(ext))
    return "That file type isn't supported. Use PDF, Office documents, images, MP4/MOV video, CSV or ZIP.";
  return null;
}

export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(-120);
  return cleaned || "file";
}

export function categoryFor(contentType: string, requested?: string): DocumentCategory {
  if (requested && requested !== "auto") return requested as DocumentCategory;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

export async function uploadDocument(
  db: DbOrTx,
  input: {
    organisationId: string;
    file: File;
    category?: string;
    visibility: "client" | "internal";
    actor: Actor;
    uploadedById: string;
    byClient: boolean;
    description?: string;
  },
): Promise<string> {
  const problem = validateUpload(input.file);
  if (problem) throw new AppError("VALIDATION", { userMessage: problem });
  const storage = resolveIntegration("storage");
  if (!storage.available)
    throw new AppError("INTEGRATION_NOT_CONNECTED", {
      userMessage: "File storage isn't configured yet.",
    });

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const id = uuidv7();
  const name = safeFileName(input.file.name);
  const key = `orgs/${input.organisationId}/documents/${id}/${name}`;
  await storage.adapter.putObject(key, bytes, input.file.type);

  const [previous] = await db
    .select({ groupId: documents.groupId, version: documents.version })
    .from(documents)
    .where(
      and(
        eq(documents.organisationId, input.organisationId),
        eq(documents.name, input.file.name),
        isNull(documents.archivedAt),
      ),
    )
    .orderBy(desc(documents.version))
    .limit(1);

  await db.insert(documents).values({
    id,
    groupId: previous?.groupId ?? id,
    version: (previous?.version ?? 0) + 1,
    organisationId: input.organisationId,
    name: input.file.name.slice(0, 200),
    category: categoryFor(input.file.type, input.category),
    storageKey: key,
    contentType: input.file.type,
    sizeBytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    uploadedById: input.uploadedById,
    uploadedByClient: input.byClient ? "yes" : "no",
    visibility: input.byClient ? "client" : input.visibility,
    description: input.description,
  });
  await logActivity(db, input.actor, {
    organisationId: input.organisationId,
    action: "document.uploaded",
    summary: `Uploaded ${input.file.name}${previous ? ` (version ${previous.version + 1})` : ""}`,
    entityType: "document",
    entityId: id,
  });
  await emitEvent(db, "document.uploaded", input.organisationId, {
    documentId: id,
    byClient: input.byClient,
  });
  if (input.byClient) {
    await db.insert(timelineEntries).values({
      organisationId: input.organisationId,
      kind: "work",
      title: `File shared: ${input.file.name}`,
      visibility: "client",
    });
  }
  return id;
}

/** Issues a short-lived download URL. Callers must have authorised access to the organisation first. */
export async function documentDownloadUrl(
  db: DbOrTx,
  documentId: string,
  organisationId: string,
  options: { clientOnly: boolean },
): Promise<string> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organisationId, organisationId)))
    .limit(1);
  if (!doc || (options.clientOnly && doc.visibility !== "client")) throw new AppError("NOT_FOUND");
  const storage = resolveIntegration("storage");
  if (!storage.available) throw new AppError("INTEGRATION_NOT_CONNECTED");
  return storage.adapter.getSignedDownloadUrl(doc.storageKey, 300, doc.name);
}

export async function archiveDocument(
  db: DbOrTx,
  documentId: string,
  organisationId: string,
  actor: Actor,
): Promise<void> {
  await db
    .update(documents)
    .set({ archivedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.organisationId, organisationId)));
  await logActivity(db, actor, {
    organisationId,
    action: "document.archived",
    summary: "Archived a document",
    entityType: "document",
    entityId: documentId,
  });
}

export async function listDocuments(
  db: DbOrTx,
  organisationId: string,
  options: { clientOnly: boolean; includeArchived?: boolean },
) {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.organisationId, organisationId))
    .orderBy(desc(documents.createdAt));
  return rows.filter(
    (d) =>
      (options.includeArchived || !d.archivedAt) &&
      (!options.clientOnly || d.visibility === "client"),
  );
}
