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

export function navigate(page: PageId): void {
  const hash = `#/${page}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}
