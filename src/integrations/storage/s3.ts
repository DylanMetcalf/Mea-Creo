import { AwsClient } from "aws4fetch";
import { health } from "../types";
import { assertStorageKey } from "./local";
import type { StorageProvider, StoredObject } from "./types";

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Any S3-compatible object store: AWS S3, Cloudflare R2, Supabase Storage, MinIO.
 * Uses SigV4 request signing (aws4fetch) instead of the heavy AWS SDK.
 * REQUIRES CONFIGURATION: S3_* environment variables.
 */
export class S3StorageProvider implements StorageProvider {
  readonly kind = "storage" as const;
  readonly provider = "s3";
  readonly isMock = false;
  private readonly client: AwsClient;

  constructor(private readonly config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
      service: "s3",
    });
  }

  private objectUrl(key: string): string {
    assertStorageKey(key);
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    const endpoint = (
      this.config.endpoint ?? `https://s3.${this.config.region}.amazonaws.com`
    ).replace(/\/$/, "");
    // Path-style addressing works across AWS, R2, MinIO and Supabase.
    return `${endpoint}/${this.config.bucket}/${encoded}`;
  }

  async healthCheck() {
    try {
      const endpoint = (
        this.config.endpoint ?? `https://s3.${this.config.region}.amazonaws.com`
      ).replace(/\/$/, "");
      const response = await this.client.fetch(
        `${endpoint}/${this.config.bucket}?list-type=2&max-keys=1`,
        { signal: AbortSignal.timeout(10_000) },
      );
      return response.ok
        ? health(this, "CONNECTED", `Bucket "${this.config.bucket}" reachable.`)
        : health(this, "ERROR", `Bucket check failed with HTTP ${response.status}.`);
    } catch (error) {
      return health(
        this,
        "ERROR",
        `Storage not reachable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const response = await this.client.fetch(this.objectUrl(key), {
      method: "PUT",
      body: body as unknown as BodyInit,
      headers: { "content-type": contentType },
    });
    if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
    return {
      key,
      size: body.byteLength,
      contentType,
      etag: response.headers.get("etag") ?? undefined,
    };
  }

  async headObject(key: string): Promise<StoredObject | null> {
    const response = await this.client.fetch(this.objectUrl(key), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HEAD failed with HTTP ${response.status}`);
    return {
      key,
      size: Number(response.headers.get("content-length") ?? 0),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      etag: response.headers.get("etag") ?? undefined,
    };
  }

  async getObject(key: string) {
    const response = await this.client.fetch(this.objectUrl(key));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET failed with HTTP ${response.status}`);
    return {
      body: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }

  async deleteObject(key: string) {
    const response = await this.client.fetch(this.objectUrl(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404)
      throw new Error(`Delete failed with HTTP ${response.status}`);
  }

  private async presign(
    key: string,
    method: "GET" | "PUT",
    expiresInSeconds: number,
    extra: Record<string, string> = {},
  ) {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    const signed = await this.client.sign(url.toString(), { method, aws: { signQuery: true } });
    return signed.url;
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds: number, filename?: string) {
    return this.presign(
      key,
      "GET",
      expiresInSeconds,
      filename
        ? { "response-content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"` }
        : {},
    );
  }

  async getSignedUploadUrl(key: string, _contentType: string, expiresInSeconds: number) {
    return this.presign(key, "PUT", expiresInSeconds);
  }
}
