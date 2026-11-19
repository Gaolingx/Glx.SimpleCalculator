// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TEXT_SCALE_MAX,
  applyUiScale,
  installUiScaleSync,
  normalizeTextScale,
  syncUiScale,
} from "./uiScale";

afterEach(() => {
  document.documentElement.style.removeProperty("--ui-scale");
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