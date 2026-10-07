"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { PortfolioPhoto } from "@/content/portfolio";

/** Masonry gallery with a keyboard-friendly lightbox (← → Esc). */
export function Gallery({ photos, altPrefix }: { photos: PortfolioPhoto[]; altPrefix: string }) {
  const alt = (_: PortfolioPhoto, i: number) => `${altPrefix} ${i + 1}`;
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, close, step]);

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 [&>*]:mb-3">
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            onClick={() => setOpen(i)}
            className="group block w-full break-inside-avoid overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Open ${alt(p, i)}`}
          >
            <Image
              src={p.src}
              alt={alt(p, i)}
              width={p.width}
              height={p.height}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-4 motion-safe:animate-[rise_.2s_var(--ease-out)]"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <Image
            src={photos[open].src}
            alt={alt(photos[open], open)}
            width={photos[open].width}
            height={photos[open].height}
            sizes="100vw"
            className="max-h-[88vh] w-auto max-w-full rounded-lg object-contain"
            priority
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute left-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute right-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"
          >
            <ChevronRight className="size-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70 tabular-nums">
            {open + 1} / {photos.length}
          </p>
        </div>
      )}
    </>
  );
}
