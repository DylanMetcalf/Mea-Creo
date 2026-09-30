import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hmacSha256, safeEqual } from "@/lib/crypto";
import { health } from "../types";
import type { StorageProvider, StoredObject } from "./types";

function signingSecret(): string {
  return process.env.AUTH_SECRET ?? "mea-creo-development-only-signing-secret";
}

export function signLocalUrl(key: string, expires: number): string {
  return hmacSha256(signingSecret(), `${key}:${expires}`);
}

export function verifyLocalSignature(key: string, expires: number, signature: string): boolean {
  return expires > Date.now() && safeEqual(signLocalUrl(key, expires), signature);
}

/** Validates server-generated object keys: no traversal, no absolute paths. */
export function assertStorageKey(key: string): void {
  if (
    !key ||
    key.length > 500 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.split("/").some((p) => p === ".." || p === "." || p === "")
  ) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

/**
 * Stores files on the local disk (development, demo and single-server installs).
 * Downloads go through /api/files/local with an HMAC-signed, expiring URL that is only
 * issued after the application has authorised the request.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly kind = "storage" as const;
  readonly provider = "local";
  readonly isMock = false;

  constructor(
    private readonly baseDir = path.join(process.cwd(), ".data", "uploads"),
    private readonly baseUrl = "",
  ) {}

  private resolve(key: string): string {
    assertStorageKey(key);
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(path.resolve(this.baseDir) + path.sep))
      throw new Error("Storage key escapes base directory");
    return full;
  }

  async healthCheck() {
    try {
      await mkdir(this.baseDir, { recursive: true });
      return health(
        this,
        "CONNECTED",
        `Files are stored on this server's disk (${path.relative(process.cwd(), this.baseDir)}). Use S3-compatible storage in production.`,
      );
    } catch (error) {
      return health(this, "ERROR", `Cannot write to the upload folder: ${String(error)}`);
    }
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    await writeFile(`${full}.meta.json`, JSON.stringify({ contentType }));
    return {
      key,
      size: body.byteLength,
      contentType,
      etag: createHash("md5").update(body).digest("hex"),
    };
  }

  async headObject(key: string): Promise<StoredObject | null> {
    const full = this.resolve(key);
    try {
      const info = await stat(full);
      const meta = JSON.parse(await readFile(`${full}.meta.json`, "utf8")) as {
        contentType: string;
      };
      return { key, size: info.size, contentType: meta.contentType };
    } catch {
      return null;
    }
  }

  async readObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const full = this.resolve(key);
    try {
      const [body, meta] = await Promise.all([
        readFile(full),
        readFile(`${full}.meta.json`, "utf8"),
      ]);
      return { body, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string) {
    const full = this.resolve(key);
    await rm(full, { force: true });
    await rm(`${full}.meta.json`, { force: true });
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number, filename?: string) {
    assertStorageKey(key);
    const expires = Date.now() + expiresInSeconds * 1000;
    const params = new URLSearchParams({
      key,
      expires: String(expires),
      sig: signLocalUrl(key, expires),
    });
    if (filename) params.set("name", filename);
    return `${this.baseUrl}/api/files/local?${params}`;
  }

  async getSignedUploadUrl(): Promise<string> {
    throw new Error("Local storage accepts uploads through the application only.");
  }
}
