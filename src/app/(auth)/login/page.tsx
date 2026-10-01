import { inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DEMO_ACCOUNTS } from "@/db/seed/demo";
import { demoModeEnabled } from "@/db/seed/ensure";
import { getAuthContext } from "@/modules/auth/context";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.kind === "staff" ? "/workspace" : "/portal");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  let demo: { label: string; email: string; password: string; note: string }[] = [];
  if (demoModeEnabled()) {
    const db = await getDb();
    const existing = await db
      .select({ email: users.email })
      .from(users)
      .where(
        inArray(
          users.email,
          Object.values(DEMO_ACCOUNTS).map((a) => a.email),
        ),
      );
    if (existing.length) {
      demo = [
        { label: "Founder (Dylan)", ...DEMO_ACCOUNTS.founder, note: "Full workspace" },
        { label: "Client: Harbourline", ...DEMO_ACCOUNTS.clientA, note: "Healthy client portal" },
        {
          label: "Client: Veldt",
          ...DEMO_ACCOUNTS.clientB,
          note: "Overdue invoice, paused services",
        },
      ];
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-muted mt-1 mb-6 text-sm">For Mea Creo clients and team members.</p>
        <LoginForm next={next} />
        <div className="mt-6 flex justify-between text-sm">
          <Link href="/forgot-password" className="text-brand-700 hover:underline">
            Forgot your password?
          </Link>
          <Link href="/" className="text-muted hover:text-ink">
            Back to website
          </Link>
        </div>
      </Card>
      {demo.length > 0 && (
        <Card className="border-dashed p-5">
          <p className="text-sm font-semibold">Demo accounts</p>
          <p className="text-muted mt-1 text-xs">
            This installation contains fictional demo data. These accounts don&apos;t exist in
            production.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {demo.map((d) => (
              <li key={d.email} className="bg-surface-2 rounded-lg px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{d.label}</span>
                  <span className="text-muted text-xs">{d.note}</span>
                </div>
                <div className="text-ink-soft mt-0.5 font-mono text-xs">
                  {d.email} · {d.password}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
