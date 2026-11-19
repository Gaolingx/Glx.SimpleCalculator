import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE, PAGE_IDS, isPageId, parsePage } from "./router";

describe("parsePage", () => {
  it("accepts canonical hash routes", () => {
    for (const page of PAGE_IDS) {
      expect(parsePage(`#/${page}`)).toBe(page);
      expect(parsePage(`#${page}`)).toBe(page);
      expect(parsePage(`#/${page}/`)).toBe(page);
    }
  });

  it("rejects empty or unknown routes", () => {
    expect(parsePage("")).toBeNull();
    expect(parsePage("#")).toBeNull();
    expect(parsePage("#/")).toBeNull();
    expect(parsePage("#/settings")).toBeNull();
    expect(parsePage("#/basic/extra")).toBeNull();
  });
});

describe("isPageId", () => {
  it("recognizes known pages only", () => {
    expect(isPageId("basic")).toBe(true);
    expect(isPageId("worksheets")).toBe(true);
    expect(isPageId("history")).toBe(false);
    expect(isPageId(DEFAULT_PAGE)).toBe(true);
  });
});
