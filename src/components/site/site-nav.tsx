"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";

/** Desktop navigation with a sliding underline and the current page marked. */
export function SiteNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/nav relative rounded-lg px-3.5 py-2 text-[0.92rem] transition-colors duration-200",
              active ? "text-ink font-medium" : "text-ink-soft hover:text-ink",
            )}
          >
            {item.label}
            <span
              aria-hidden
              className={cn(
                "bg-signal absolute inset-x-3.5 -bottom-0.5 h-[2px] origin-left rounded-full transition-transform duration-300 ease-out",
                active ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

/** Full-screen mobile menu. Closes on navigation and on Escape; locks page scroll while open. */
export function MobileMenu({
  items,
  children,
}: {
  items: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="border-border bg-surface/80 shadow-card flex size-11 items-center justify-center rounded-xl border"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="border-border/70 bg-paper fixed inset-x-0 top-[72px] bottom-0 z-50 overflow-y-auto border-t px-4 pt-2 pb-10 motion-safe:animate-[rise_.25s_var(--ease-out)]"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                className="font-display border-border/70 aria-[current=page]:text-brand-700 flex items-center justify-between border-b py-4 text-[1.35rem]"
              >
                {item.label}
                <ArrowRight className="text-subtle size-4" aria-hidden />
              </Link>
            ))}
          </nav>
          {children}
        </div>
      )}
    </div>
  );
}
