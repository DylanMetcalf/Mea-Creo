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
        <div className="bg-night edge-glow text-night-text relative isolate flex flex-col gap-8 overflow-hidden rounded-[22px] p-7 sm:p-9 md:flex-row md:items-center md:justify-between">
          <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-75" />
          <div className="max-w-2xl">
            <p className="label-mono text-signal">Start here</p>
            <h3 className="font-display mt-2 text-[2rem] text-white">{foundation.name}</h3>
            <p className="text-night-text/85 mt-2">{foundation.summary}</p>
            {!compact && (
              <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {foundation.includes.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <Check className="text-signal mt-0.5 size-4 shrink-0" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0">
            {foundation.priceMinor && (
              <p className="font-display text-[2.6rem] leading-none text-white tabular-nums">
                {formatRand(foundation.priceMinor)}{" "}
                <span className="text-night-muted font-sans text-base font-normal tracking-normal">
                  once-off
                </span>
              </p>
            )}
            <LinkButton href="/book" variant="inverse" className="mt-5">
              Talk about a Foundation
            </LinkButton>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {monthly.map((p) => (
          <article
            key={p.slug}
            className={cn(
              "relative flex flex-col rounded-[22px] border p-7 transition-[transform,box-shadow] duration-300 hover:-translate-y-1",
              p.slug === "package-growth"
                ? "border-brand-500 bg-surface shadow-raised hover:shadow-lifted ring-brand-500/30 ring-4"
                : "border-border bg-surface shadow-card hover:shadow-raised",
            )}
          >
            {p.slug === "package-growth" && (
              <span className="bg-signal label-mono shadow-glow absolute -top-3 left-7 rounded-full px-3 py-1 text-white">
                Most clients
              </span>
            )}
            <h3 className="font-display text-[1.5rem]">{p.name}</h3>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">{p.summary}</p>
            {p.priceMinor && (
              <p className="border-border/70 mt-6 border-b pb-6">
                <span className="font-display text-[2.4rem] tabular-nums">
                  {formatRand(p.priceMinor)}
                </span>
                <span className="text-muted text-sm"> / month</span>
              </p>
            )}
            <ul className="text-ink-soft mt-6 space-y-2.5 text-sm">
              {(compact ? p.includes.slice(0, 5) : p.includes).map((i) => (
                <li key={i} className="flex gap-2">
                  <Check className="text-brand-500 mt-0.5 size-4 shrink-0" aria-hidden /> {i}
                </li>
              ))}
              {compact && p.includes.length > 5 && <li className="text-muted pl-6">and more</li>}
            </ul>
          </article>
        ))}
      </div>
      {custom && (
        <div className="border-border bg-surface-2 flex flex-col gap-4 rounded-[22px] border border-dashed p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <h3 className="font-display text-[1.5rem]">{custom.name}</h3>
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
