// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import i18n, { initI18n } from "../../i18n";
import { useUiStore } from "../../stores/ui";
import { ShortcutsSheet } from "./ShortcutsSheet";

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  useUiStore.setState({ overlay: "help" });
});

afterEach(() => {
  cleanup();
});

describe("ShortcutsSheet", () => {
  it("lists shortcuts and closes on Escape", () => {
    render(<ShortcutsSheet />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(i18n.t("help:title"))).toBeTruthy();
    expect(screen.getByText(i18n.t("help:copy"))).toBeTruthy();
    expect(screen.getByText("Ctrl+C")).toBeTruthy();
    expect(screen.getByText("F1")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(useUiStore.getState().overlay).toBeNull();
  });

  it("renders nothing while closed", () => {
    useUiStore.setState({ overlay: null });
    render(<ShortcutsSheet />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});