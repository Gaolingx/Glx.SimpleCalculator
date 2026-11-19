import { fetchUiScale } from "./ipc";

/**
 * The compact 440px layout reflows at 120% and caps at 150% so the 6-column
 * keypads keep readable labels; Windows allows up to 225%.
 */
export const TEXT_SCALE_MIN = 1;
export const TEXT_SCALE_MAX = 1.5;
export const LARGE_SCALE_THRESHOLD = 1.2;

export function normalizeTextScale(value: unknown): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return (
    Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, numeric)) * 100) / 100
  );
}

export function applyUiScale(value: unknown, root?: HTMLElement): number {
  const scale = normalizeTextScale(value);
  const target =
    root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (target) {
    target.style.setProperty("--ui-scale", String(scale));
    target.dataset.uiScale = scale >= LARGE_SCALE_THRESHOLD ? "large" : "normal";
  }
  return scale;
}

export function currentUiScale(): number {
  if (typeof document === "undefined") {
    return 1;
  }
  return normalizeTextScale(
    Number.parseFloat(document.documentElement.style.getPropertyValue("--ui-scale")),
  );
}

export async function syncUiScale(
  read: () => Promise<{ textScale: number }> = fetchUiScale,
): Promise<number> {
  try {
    const payload = await read();
    return applyUiScale(payload.textScale);
  } catch {
    // A transient bridge failure must not shrink an already-scaled UI.
    return currentUiScale();
  }
}

/** Text size can change while the app is running; re-read when it regains focus. */
export function installUiScaleSync(): () => void {
  const handler = () => {
    void syncUiScale();
  };
  window.addEventListener("focus", handler);
  return () => window.removeEventListener("focus", handler);
}