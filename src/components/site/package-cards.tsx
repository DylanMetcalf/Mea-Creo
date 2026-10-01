import { Check } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatRand, type PublicPackage } from "@/modules/website/packages";

/** Package cards with the approved prices. `compact` shows the first few inclusions only. */
export function PackageCards({
  packages,
  compact = false,
}: {
  packages: PublicPackage[];
  compact?: boolean;
}) {
  const monthly = packages.filter(
    (p) => p.slug !== "package-foundation" && p.slug !== "package-custom",
  );
  const foundation = packages.find((p) => p.slug === "package-foundation");
  const custom = packages.find((p) => p.slug === "package-custom");
  return (
    <div className="space-y-6">
      {foundation && (
        <div className="rounded-card border-brand-700 bg-brand-950 text-brand-50 flex flex-col gap-6 border p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-brand-300 text-xs font-semibold tracking-[0.14em] uppercase">
              Start here
            </p>
            <h3 className="font-display mt-1 text-3xl text-white">{foundation.name}</h3>
            <p className="text-brand-100 mt-2">{foundation.summary}</p>
            {!compact && (
              <ul className="text-brand-50 mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {foundation.includes.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="text-brand-300 mt-0.5 size-4 shrink-0" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0">
            {foundation.priceMinor && (
              <p className="font-display text-4xl text-white">
                {formatRand(foundation.priceMinor)}{" "}
                <span className="text-brand-300 text-base">once-off</span>
              </p>
            )}
            <LinkButton href="/book" variant="inverse" className="mt-4">
              Talk about a Foundation
            </LinkButton>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {monthly.map((p) => (
          <article
            key={p.slug}
            className={cn(
              "rounded-card bg-surface shadow-card flex flex-col border p-6",
              p.slug === "package-growth"
                ? "border-brand-600 ring-brand-600 ring-1"
                : "border-border",
            )}
          >
            {p.slug === "package-growth" && (
              <p className="text-brand-700 mb-2 text-xs font-semibold tracking-wide uppercase">
                Most clients
              </p>
            )}
            <h3 className="font-display text-2xl">{p.name}</h3>
            <p className="text-muted mt-1 text-sm">{p.summary}</p>
            {p.priceMinor && (
              <p className="mt-5">
                <span className="font-display text-4xl">{formatRand(p.priceMinor)}</span>
                <span className="text-muted text-sm"> / month</span>
              </p>
            )}
            <ul className="text-ink-soft mt-5 space-y-2 text-sm">
              {(compact ? p.includes.slice(0, 5) : p.includes).map((i) => (
                <li key={i} className="flex gap-2">
                  <Check className="text-brand-600 mt-0.5 size-4 shrink-0" aria-hidden /> {i}
                </li>
              ))}
              {compact && p.includes.length > 5 && <li className="text-muted pl-6">and more</li>}
            </ul>
          </article>
        ))}
      </div>
      {custom && (
        <div className="rounded-card border-border bg-surface flex flex-col gap-4 border p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <h3 className="font-display text-2xl">{custom.name}</h3>
            <p className="text-muted mt-1 text-sm">{custom.description}</p>
          </div>
          <LinkButton href="/book" variant="secondary">
            Request a quotation
          </LinkButton>
        </div>
      )}
      <p className="text-muted text-sm">
        Prices in South African rand. Mea Creo is not VAT registered, so the price shown is the
        price you pay.
      </p>
    </div>
  );
}
