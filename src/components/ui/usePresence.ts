import { useEffect, useState } from "react";

// Keep in sync with --duration-fast / --duration-base so the element stays
// mounted until its CSS exit animation finishes.
export const EXIT_FAST_MS = 200;
export const EXIT_BASE_MS = 300;

export interface Presence {
  mounted: boolean;
  closing: boolean;
}

/** Keeps an element mounted while its exit animation plays. */
export function usePresence(open: boolean, exitMs: number): Presence {
  const [mounted, setMounted] = useState(open);
  const closing = mounted && !open;

  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (!closing) {
      return undefined;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [closing, exitMs]);

  return { mounted, closing };
}