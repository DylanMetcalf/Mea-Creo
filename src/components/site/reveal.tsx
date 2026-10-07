"use client";

import { useEffect } from "react";

/**
 * Scroll reveal for browsers without CSS scroll-driven animations (Safari, and installed
 * apps on iPhone, which use Safari's engine). Content stays visible if this never runs.
 */
export function RevealFallback() {
  useEffect(() => {
    if (CSS.supports("animation-timeline: view()")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const els = Array.from(document.querySelectorAll(".reveal"));
    // Anything already on screen stays put; only content below the fold animates in.
    for (const el of els) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-visible");
      else io.observe(el);
    }
    root.classList.add("reveal-js");
    return () => io.disconnect();
  }, []);
  return null;
}
