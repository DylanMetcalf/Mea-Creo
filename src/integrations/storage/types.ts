import type { IntegrationAdapter } from "../types";

/**
 * Object storage (S3-compatible: AWS S3, Cloudflare R2, Supabase Storage, MinIO).
 * Files never live in PostgreSQL; the database stores metadata and the object key.
 * Downloads always go through short-lived signed URLs issued after an authorisation check.
 */

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
  etag?: string;
}

export interface StorageProvider extends IntegrationAdapter {
  readonly kind: "storage";
  putObject(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  headObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
  /** Reads an object server-side (logos for documents, small files). Null if missing. */
  getObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  getSignedDownloadUrl(key: string, expiresInSeconds: number, filename?: string): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
}
