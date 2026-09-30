/**
 * Liveness probe for load balancers and uptime monitoring. Deliberately reveals
 * nothing about configuration; integration health is an authenticated admin view.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
