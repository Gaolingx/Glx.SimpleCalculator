import { describe, expect, it } from "vitest";

import {
  THEME_STORAGE_KEY,
  parseThemeSetting,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("parseThemeSetting", () => {
  it("accepts known values", () => {
    expect(parseThemeSetting("light")).toBe("light");
    expect(parseThemeSetting("dark")).toBe("dark");
    expect(parseThemeSetting("system")).toBe("system");
  });

  it("falls back to system for unknown values", () => {
    expect(parseThemeSetting(null)).toBe("system");
    expect(parseThemeSetting("sepia")).toBe("system");
    expect(parseThemeSetting(1)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("resolves explicit settings", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS preference for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("theme storage", () => {
  it("reads a stored setting", () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
  });

  it("defaults to system when missing or invalid", () => {
    expect(readStoredTheme(memoryStorage())).toBe("system");
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "blue" }))).toBe("system");
  });

  it("writes the setting", () => {
    const storage = memoryStorage();
    writeStoredTheme("light", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("survives unavailable storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readStoredTheme(broken)).toBe("system");
    expect(() => writeStoredTheme("dark", broken)).not.toThrow();
  });
});
