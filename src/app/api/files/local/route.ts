import { NextResponse } from "next/server";
import { LocalStorageProvider, verifyLocalSignature } from "@/integrations/storage/local";

export const dynamic = "force-dynamic";

/** Serves locally stored files for signed, unexpired URLs only (issued after authorisation). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires") ?? 0);
  const sig = url.searchParams.get("sig") ?? "";
  const name = url.searchParams.get("name") ?? key.split("/").pop() ?? "file";
  if (!verifyLocalSignature(key, expires, sig))
    return new NextResponse("Link expired or invalid.", { status: 403 });
  const object = await new LocalStorageProvider().readObject(key);
  if (!object) return new NextResponse("Not found.", { status: 404 });
  const inline =
    object.contentType === "application/pdf" ||
    (object.contentType.startsWith("image/") && object.contentType !== "image/svg+xml");
  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "content-type": object.contentType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\w.\- ]/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
