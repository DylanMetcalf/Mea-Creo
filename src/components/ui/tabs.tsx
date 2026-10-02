import Link from "next/link";
import { cn } from "./cn";

/** Link-based tabs: each tab is a URL, so tabs are shareable and work without JavaScript. */
export function Tabs({
  tabs,
  active,
  baseHref,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  baseHref: string;
}) {
  return (
    <nav
      aria-label="Sections"
      className="border-border -mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={`${baseHref}${baseHref.includes("?") ? "&" : "?"}tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "border-brand-500 text-ink font-medium"
                    : "text-muted hover:text-ink hover:border-border-strong border-transparent",
                )}
              >
                {tab.label}
                {tab.count ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      isActive ? "bg-brand-100 text-brand-800" : "bg-surface-2 text-muted",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
