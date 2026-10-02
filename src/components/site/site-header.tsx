import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { MobileMenu, SiteNav } from "./site-nav";

export const SITE_NAV = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/work", label: "Work" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="border-border/60 bg-paper/80 supports-[backdrop-filter]:bg-paper/65 sticky top-0 z-40 border-b backdrop-blur-xl backdrop-saturate-150">
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:h-20 lg:px-8">
        <Logo />
        <SiteNav items={SITE_NAV} />
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-ink-soft hover:text-ink rounded-md px-2 py-1 text-sm transition-colors"
          >
            Client sign in
          </Link>
          <LinkButton href="/book" variant="cta">
            Book a strategy call
            <ArrowRight
              className="size-4 transition-transform group-hover/btn:translate-x-0.5"
              aria-hidden
            />
          </LinkButton>
        </div>
        <MobileMenu items={SITE_NAV}>
          <div className="mt-8 grid gap-3">
            <LinkButton href="/book" variant="cta" size="lg">
              Book a strategy call
            </LinkButton>
            <LinkButton href="/visibility-report" variant="secondary" size="lg">
              Get a free Visibility Report
            </LinkButton>
            <Link href="/login" className="text-muted mt-2 py-2 text-center text-sm">
              Client sign in
            </Link>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
