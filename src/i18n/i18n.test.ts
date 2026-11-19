import { beforeEach, describe, expect, it } from "vitest";

import i18n, {
  detectLanguage,
  initI18n,
  resolveInitialLanguage,
  setLanguage,
} from "./index";

const ERROR_CODES = [
  "DIVIDE_BY_ZERO",
  "OVERFLOW",
  "INVALID_INPUT",
  "DOMAIN_ERROR",
  "SYNTAX",
  "UNSUPPORTED",
  "CURRENCY_OFFLINE",
  "UNKNOWN_UNIT",
  "STORAGE_ERROR",
  "NETWORK_ERROR",
  "INTERNAL",
] as const;

describe("i18n", () => {
  beforeEach(async () => {
    await initI18n("zh-CN");
  });

  it("initializes zh-CN by default and switches at runtime", async () => {
    expect(i18n.t("ok")).toBe("确定");
    expect(i18n.t("nav.basic", { ns: "menu" })).toBe("基本");

    await setLanguage("en-US");

    expect(i18n.t("ok")).toBe("OK");
    expect(i18n.t("nav.basic", { ns: "menu" })).toBe("Basic");
  });

  it("translates every error code in both locales", async () => {
    for (const language of ["zh-CN", "en-US"] as const) {
      await setLanguage(language);
      for (const code of ERROR_CODES) {
        const text = i18n.t(`errors:${code}`);
        expect(text).not.toBe(`errors:${code}`);
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("detects languages from the OS locale", () => {
    expect(detectLanguage("en-GB")).toBe("en-US");
    expect(detectLanguage("en")).toBe("en-US");
    expect(detectLanguage("zh-CN")).toBe("zh-CN");
    expect(detectLanguage("fr-FR")).toBe("zh-CN");
    expect(detectLanguage(undefined)).toBe("zh-CN");
  });

  it("prefers a stored language over the OS locale", () => {
    const storage = {
      getItem: () => "en-US",
      setItem: () => undefined,
    };
    expect(resolveInitialLanguage("zh-CN", storage)).toBe("en-US");
  });

  it("ignores an unsupported stored language", () => {
    const storage = {
      getItem: () => "ja-JP",
      setItem: () => undefined,
    };
    expect(resolveInitialLanguage("en-US", storage)).toBe("en-US");
  });
});
