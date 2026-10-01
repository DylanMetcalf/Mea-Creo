import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { handlePaymentWebhook } from "@/modules/billing/service";

export const dynamic = "force-dynamic";

/**
 * Payment provider notifications (Payfast ITN, mock). The body is verified by the
 * active adapter (signature, source and amount checks) before anything changes.
 * Always answers 200 for verified-or-rejected notifications so providers don't retry
 * forged requests; genuine processing failures return 500 so they are retried.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/webhooks/payments/[provider]">,
) {
  const { provider } = await params;
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return new NextResponse("Too large", { status: 413 });
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => (headers[k] = v));
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  try {
    const result = await handlePaymentWebhook(await getDb(), provider, {
      rawBody,
      headers,
      sourceIp,
    });
    return NextResponse.json({ ok: result.ok });
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : error, provider },
      "payment webhook failed",
    );
    return new NextResponse("Error", { status: 500 });
  }
}
