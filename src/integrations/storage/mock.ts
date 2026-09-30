import { createHash } from "node:crypto";
import { health } from "../types";
import type { StorageProvider, StoredObject } from "./types";

export class MockStorageProvider implements StorageProvider {
  readonly kind = "storage" as const;
  readonly provider = "mock";
  readonly isMock = true;
  private readonly objects = new Map<string, StoredObject & { body: Uint8Array }>();

  constructor(private readonly baseUrl = "http://localhost:3000/dev/mock-storage") {}

  async healthCheck() {
    return health(this, "CONNECTED", "Mock storage. Files are kept in memory only.");
  }

  async putObject(key: string, body: Uint8Array, contentType: string) {
    assertKey(key);
    const etag = createHash("md5").update(body).digest("hex");
    const stored = { key, size: body.byteLength, contentType, etag, body };
    this.objects.set(key, stored);
    return { key, size: stored.size, contentType, etag };
  }

  async headObject(key: string) {
    const found = this.objects.get(key);
    if (!found) return null;
    return { key: found.key, size: found.size, contentType: found.contentType, etag: found.etag };
  }

  async deleteObject(key: string) {
    this.objects.delete(key);
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number) {
    assertKey(key);
    const expires = Date.now() + expiresInSeconds * 1000;
    return `${this.baseUrl}/${encodeURIComponent(key)}?expires=${expires}`;
  }

  async getSignedUploadUrl(key: string, _contentType: string, expiresInSeconds: number) {
    return this.getSignedDownloadUrl(key, expiresInSeconds);
  }
}

/** Object keys are generated server-side; reject anything resembling path traversal. */
function assertKey(key: string) {
  if (!key || key.startsWith("/") || key.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}
