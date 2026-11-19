import { useSyncExternalStore } from "react";

export const PAGE_IDS = [
  "basic",
  "scientific",
  "programmer",
  "statistics",
  "datecalc",
  "converter",
  "worksheets",
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export const DEFAULT_PAGE: PageId = "basic";

const HASH_PATTERN = /^#\/?([a-z]+)\/?$/;

export function isPageId(value: unknown): value is PageId {
  return typeof value === "string" && (PAGE_IDS as readonly string[]).includes(value);
}

export function parsePage(hash: string): PageId | null {
  const match = HASH_PATTERN.exec(hash);
  return match && isPageId(match[1]) ? match[1] : null;
}

export function readPage(): PageId {
  if (typeof window === "undefined") {
    return DEFAULT_PAGE;
  }
  return parsePage(window.location.hash) ?? DEFAULT_PAGE;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function usePage(): PageId {
  return useSyncExternalStore(subscribe, readPage, () => DEFAULT_PAGE);
}

/**
 * Applies the hash change and resolves once React has committed the new page.
 * View transitions take the "new" snapshot only after this resolves, so the
 * crossfade never exposes an empty frame.
 */
function applyRoute(apply: () => void): Promise<void> {
  apply();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
    window.setTimeout(finish, 150);
  });
}

export function navigate(page: PageId): void {
  if (typeof window === "undefined") {
    return;
  }
  const hash = `#/${page}`;
  if (window.location.hash === hash) {
    return;
  }

  const apply = () => {
    window.location.hash = hash;
  };

  if (typeof document.startViewTransition !== "function") {
    apply();
    return;
  }

  try {
    const transition = document.startViewTransition(() => applyRoute(apply));
    transition.finished.catch(() => undefined);
  } catch {
    apply();
  }
}
