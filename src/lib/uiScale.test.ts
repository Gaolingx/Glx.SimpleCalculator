// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TEXT_SCALE_MAX,
  applyUiScale,
  applyUiZoom,
  installUiScaleSync,
  normalizeTextScale,
  syncUiScale,
} from "./uiScale";

afterEach(() => {
  document.documentElement.style.removeProperty("--ui-scale");
  document.documentElement.style.removeProperty("--ui-zoom");
  delete document.documentElement.dataset.uiScale;
});

describe("ui scale", () => {
  it("normalizes to the supported 100–150% range", () => {
    expect(normalizeTextScale(1.25)).toBe(1.25);
    expect(normalizeTextScale(0.8)).toBe(1);
    expect(normalizeTextScale(2.25)).toBe(TEXT_SCALE_MAX);
    expect(normalizeTextScale(Number.NaN)).toBe(1);
    expect(normalizeTextScale("1.25")).toBe(1);
  });

  it("writes the CSS variable and the reflow marker", () => {
    expect(applyUiScale(1.5)).toBe(1.5);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.5");
    expect(document.documentElement.dataset.uiScale).toBe("large");

    applyUiScale(1);
    expect(document.documentElement.dataset.uiScale).toBe("normal");
  });

  it("applies user zoom on top of the OS text scale", () => {
    applyUiScale(1);
    expect(applyUiZoom(150)).toBe(1.5);
    expect(document.documentElement.style.getPropertyValue("--ui-zoom")).toBe("1.5");
    expect(document.documentElement.dataset.uiScale).toBe("large");

    applyUiZoom(137);
    expect(document.documentElement.style.getPropertyValue("--ui-zoom")).toBe("1.37");

    applyUiZoom(50);
    expect(document.documentElement.dataset.uiScale).toBe("normal");

    applyUiZoom(999);
    expect(document.documentElement.style.getPropertyValue("--ui-zoom")).toBe("2.5");
  });

  it("marks the compact layout as large when text scale and zoom combine", () => {
    applyUiScale(1);
    applyUiZoom(100);
    expect(document.documentElement.dataset.uiScale).toBe("normal");

    applyUiScale(1.25);
    expect(document.documentElement.dataset.uiScale).toBe("large");

    applyUiScale(1);
    applyUiZoom(125);
    expect(document.documentElement.dataset.uiScale).toBe("large");
  });

  it("keeps the current scale when the bridge fails", async () => {
    expect(
      await syncUiScale(async () => {
        throw new Error("ipc down");
      }),
    ).toBe(1);

    applyUiScale(1.25);
    const applied = await syncUiScale(async () => {
      throw new Error("ipc down");
    });
    expect(applied).toBe(1.25);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.25");
  });

  it("applies the bridge value", async () => {
    await syncUiScale(async () => ({ textScale: 1.25 }));
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.25");
    expect(document.documentElement.dataset.uiScale).toBe("large");
  });

  it("re-reads the preference on focus and uninstalls the listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const uninstall = installUiScaleSync();

    expect(add).toHaveBeenCalledWith("focus", expect.any(Function));
    uninstall();
    expect(remove).toHaveBeenCalledWith("focus", expect.any(Function));

    add.mockRestore();
    remove.mockRestore();
  });
});