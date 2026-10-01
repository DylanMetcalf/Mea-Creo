"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server component every `intervalMs` while mounted (e.g. waiting for a job). */
export function AutoRefresh({ intervalMs = 2500 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
