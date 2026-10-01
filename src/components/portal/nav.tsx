"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { PORTAL_NAV } from "./nav-items";

const MOBILE = [
  "/portal",
  "/portal/approvals",
  "/portal/reports",
  "/portal/messages",
  "/portal/ask",
];

function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

export function PortalNav({
  badges,
  hideBilling,
}: {
  badges: Record<string, number>;
  hideBilling: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="hidden lg:block">
      <ul className="space-y-0.5">
        {PORTAL_NAV.filter((i) => !(hideBilling && i.href === "/portal/billing")).map(
          ({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  isActive(pathname, href)
                    ? "bg-brand-50 text-brand-800 font-medium"
                    : "text-ink-soft hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{label}</span>
                {badges[href] ? (
                  <span className="bg-clay-600 rounded-full px-1.5 text-[0.7rem] font-semibold text-white">
                    {badges[href]}
                  </span>
                ) : null}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

/** Bottom tab bar on phones; everything else is under "More". */
export function PortalMobileNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Portal"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-6">
        {PORTAL_NAV.filter((i) => MOBILE.includes(i.href)).map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[0.65rem]",
                isActive(pathname, href) ? "text-brand-800" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label === "Ask Mea Creo" ? "Ask" : label}
              {badges[href] ? (
                <span
                  className="bg-clay-600 absolute top-1 right-[25%] size-2 rounded-full"
                  aria-label={`${badges[href]} waiting`}
                />
              ) : null}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/portal/more"
            aria-current={pathname === "/portal/more" ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[0.65rem]",
              pathname === "/portal/more" ? "text-brand-800" : "text-muted",
            )}
          >
            <span
              className="flex size-5 items-center justify-center text-base leading-none"
              aria-hidden
            >
              ⋯
            </span>
            More
          </Link>
        </li>
      </ul>
    </nav>
  );
}
