import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { PORTAL_NAV } from "@/components/portal/nav-items";
import { Card } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { requireClient } from "@/modules/auth/context";
import { getProgramme } from "@/modules/prospecting/service";

export const metadata: Metadata = { title: "More" };

export default async function PortalMore() {
  const ctx = await requireClient();
  const hasProspects = Boolean(await getProgramme(await getDb(), ctx.organisationId));
  const items = [
    ...PORTAL_NAV.filter(
      (i) =>
        !(i.href === "/portal/billing" && !ctx.can("portal.billing")) &&
        !(i.href === "/portal/prospects" && !hasProspects),
    ),
    { href: "/portal/notifications", label: "Notifications", icon: null },
    { href: "/portal/settings", label: "Account & team", icon: null },
  ];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-ink text-3xl">More</h1>
      <Card>
        <ul className="divide-border divide-y">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="hover:bg-surface-2 block px-5 py-3.5 text-sm">
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <form action={logoutAction}>
        <button className="border-border bg-surface w-full rounded-lg border py-3 text-sm">
          Sign out
        </button>
      </form>
    </div>
  );
}
