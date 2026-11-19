import { fetchUiScale } from "./ipc";
import { normalizeUiZoom } from "./settings";

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

function readStyleNumber(target: HTMLElement, property: string): number {
  const parsed = Number.parseFloat(target.style.getPropertyValue(property));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** The reflow marker follows the product of OS text size and user zoom. */
function applyScaleMarker(target: HTMLElement): void {
  const effective =
    readStyleNumber(target, "--ui-scale") * readStyleNumber(target, "--ui-zoom");
  target.dataset.uiScale = effective >= LARGE_SCALE_THRESHOLD ? "large" : "normal";
}

export function applyUiScale(value: unknown, root?: HTMLElement): number {
  const scale = normalizeTextScale(value);
  const target =
    root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (target) {
    target.style.setProperty("--ui-scale", String(scale));
    applyScaleMarker(target);
  }
  return scale;
}

/** Applies the user's zoom percentage (50–250) on top of the OS text size. */
export function applyUiZoom(value: unknown, root?: HTMLElement): number {
  const zoom = normalizeUiZoom(value) / 100;
  const target =
    root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (target) {
    target.style.setProperty("--ui-zoom", String(zoom));
    applyScaleMarker(target);
  }
  return zoom;
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