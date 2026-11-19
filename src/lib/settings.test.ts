import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  isValidHistoryLimit,
  isValidUiZoom,
  mergeSettings,
  normalizeSettings,
  settingsEqual,
} from "./settings";

describe("normalizeSettings", () => {
  it("returns defaults for missing or malformed payloads", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values", () => {
    const settings = normalizeSettings({
      theme: "dark",
      language: "en-US",
      grouping: false,
      angleUnit: "rad",
      wordSize: "byte",
      radix: "hexadecimal",
      historyEnabled: false,
      historyLimit: 800,
      uiZoom: 150,
    });
    expect(settings).toEqual({
      theme: "dark",
      language: "en-US",
      grouping: false,
      angleUnit: "rad",
      wordSize: "byte",
      radix: "hexadecimal",
      historyEnabled: false,
      historyLimit: 800,
      uiZoom: 150,
    });
  });

  it("replaces unknown enum values with defaults", () => {
    const settings = normalizeSettings({
      theme: "sepia",
      language: "fr-FR",
      angleUnit: "turns",
      wordSize: "huge",
      radix: "base7",
    });
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(settings.angleUnit).toBe(DEFAULT_SETTINGS.angleUnit);
    expect(settings.wordSize).toBe(DEFAULT_SETTINGS.wordSize);
    expect(settings.radix).toBe(DEFAULT_SETTINGS.radix);
  });

  it("clamps the history limit into the documented range", () => {
    expect(normalizeSettings({ historyLimit: 1 }).historyLimit).toBe(HISTORY_LIMIT_MIN);
    expect(normalizeSettings({ historyLimit: 99_999 }).historyLimit).toBe(HISTORY_LIMIT_MAX);
    expect(normalizeSettings({ historyLimit: 333.6 }).historyLimit).toBe(334);
    expect(normalizeSettings({ historyLimit: "many" }).historyLimit).toBe(
      DEFAULT_SETTINGS.historyLimit,
    );
  });

  it("clamps the UI zoom into the documented range", () => {
    expect(normalizeSettings({ uiZoom: 10 }).uiZoom).toBe(UI_ZOOM_MIN);
    expect(normalizeSettings({ uiZoom: 999 }).uiZoom).toBe(UI_ZOOM_MAX);
    expect(normalizeSettings({ uiZoom: 137.6 }).uiZoom).toBe(138);
    expect(normalizeSettings({ uiZoom: "big" }).uiZoom).toBe(
      DEFAULT_SETTINGS.uiZoom,
    );
  });
});

describe("settings helpers", () => {
  it("merges partial patches without losing siblings", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { grouping: false });
    expect(merged.grouping).toBe(false);
    expect(merged.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(merged.language).toBe(DEFAULT_SETTINGS.language);
  });

  it("compares complete settings values", () => {
    expect(settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toBe(true);
    expect(settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, radix: "binary" })).toBe(
      false,
    );
  });

  it("validates history limits", () => {
    expect(isValidHistoryLimit(HISTORY_LIMIT_MIN)).toBe(true);
    expect(isValidHistoryLimit(HISTORY_LIMIT_MAX)).toBe(true);
    expect(isValidHistoryLimit(HISTORY_LIMIT_MIN - 1)).toBe(false);
    expect(isValidHistoryLimit(555.5)).toBe(false);
  });

  it("validates UI zoom percentages", () => {
    expect(isValidUiZoom(UI_ZOOM_MIN)).toBe(true);
    expect(isValidUiZoom(UI_ZOOM_MAX)).toBe(true);
    expect(isValidUiZoom(137)).toBe(true);
    expect(isValidUiZoom(UI_ZOOM_MIN - 1)).toBe(false);
    expect(isValidUiZoom(UI_ZOOM_MAX + 1)).toBe(false);
    expect(isValidUiZoom(150.5)).toBe(false);
  });
});
