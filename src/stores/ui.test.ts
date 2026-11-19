import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    useUiStore.setState({ overlay: null });
  });

  it("opens and closes overlays", () => {
    useUiStore.getState().openOverlay("settings");
    expect(useUiStore.getState().overlay).toBe("settings");
    useUiStore.getState().closeOverlay();
    expect(useUiStore.getState().overlay).toBeNull();
  });

  it("toggles the active overlay and switches between overlays", () => {
    useUiStore.getState().toggleOverlay("history");
    expect(useUiStore.getState().overlay).toBe("history");

    useUiStore.getState().toggleOverlay("history");
    expect(useUiStore.getState().overlay).toBeNull();

    useUiStore.getState().toggleOverlay("history");
    useUiStore.getState().toggleOverlay("settings");
    expect(useUiStore.getState().overlay).toBe("settings");
  });
});
