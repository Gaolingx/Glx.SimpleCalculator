// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SoftMenu, type SoftMenuItem } from "./SoftMenu";

function items(overrides: Partial<SoftMenuItem> = {}): SoftMenuItem[] {
  return [
    { id: "copy", label: "复制", shortcut: "Ctrl+C", onSelect: vi.fn(), ...overrides },
    { id: "paste", label: "粘贴", onSelect: vi.fn() },
    { id: "clear", label: "清除", danger: true, onSelect: vi.fn() },
  ];
}

function renderMenu(menuItems = items(), onClose = vi.fn()) {
  render(
    <SoftMenu
      open
      x={20}
      y={30}
      items={menuItems}
      onClose={onClose}
      label="测试菜单"
    />,
  );
  return { menuItems, onClose };
}

afterEach(() => {
  cleanup();
});

describe("SoftMenu", () => {
  it("renders items and focuses the first one", () => {
    renderMenu();

    const menu = screen.getByRole("menu", { name: "测试菜单" });
    expect(menu).toBeTruthy();
    const first = screen.getByRole("menuitem", { name: /复制/ });
    expect(document.activeElement).toBe(first);
  });

  it("selects an item and then closes", () => {
    const { menuItems, onClose } = renderMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "粘贴" }));

    expect(menuItems[1].onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("skips disabled items while navigating with the keyboard", () => {
    const menuItems = items();
    menuItems[0] = { ...menuItems[0], disabled: true };
    renderMenu(menuItems);

    const firstEnabled = screen.getByRole("menuitem", { name: "粘贴" });
    expect(document.activeElement).toBe(firstEnabled);

    fireEvent.keyDown(firstEnabled, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "清除" }));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(firstEnabled);
  });

  it("closes on Escape and Tab", () => {
    const { onClose } = renderMenu();
    const active = document.activeElement!;

    fireEvent.keyDown(active, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(active, { key: "Tab" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes when clicking outside", () => {
    const { onClose } = renderMenu();

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when the menu list itself scrolls", () => {
    const { onClose } = renderMenu();
    const menu = screen.getByRole("menu", { name: "测试菜单" });

    fireEvent.scroll(menu);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the page scrolls", () => {
    const { onClose } = renderMenu();

    fireEvent.scroll(window);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
