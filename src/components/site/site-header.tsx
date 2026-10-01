import { Menu } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";

export const SITE_NAV = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/work", label: "Work" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="border-border/70 bg-paper/90 supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:rounded focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-soft hover:bg-brand-50 hover:text-ink rounded-md px-3 py-2 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="text-muted hover:text-ink px-2 text-sm">
            Client sign in
          </Link>
          <LinkButton href="/visibility-report" size="sm">
            Free Visibility Report
          </LinkButton>
        </div>
        <details className="group relative lg:hidden">
          <summary
            className="hover:bg-brand-50 flex size-10 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </summary>
          <div className="rounded-card border-border bg-surface shadow-raised absolute right-0 mt-2 w-64 border p-2">
            <nav aria-label="Mobile" className="flex flex-col">
              {SITE_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:bg-brand-50 rounded-md px-3 py-2.5 text-sm"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="text-muted hover:bg-brand-50 rounded-md px-3 py-2.5 text-sm"
              >
                Client sign in
              </Link>
              <LinkButton href="/visibility-report" className="mt-2">
                Free Visibility Report
              </LinkButton>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
