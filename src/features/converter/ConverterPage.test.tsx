// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import {
  IpcError,
  type UnitCatalog,
  type UnitConversionInput,
} from "../../lib/ipc";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { useSettingsStore } from "../../stores/settings";
import { ConverterPage } from "./ConverterPage";

const CATALOG: UnitCatalog = {
  categories: [
    {
      id: "currency",
      units: [
        { id: "eur", symbol: "EUR" },
        { id: "usd", symbol: "USD" },
        { id: "cny", symbol: "CNY" },
      ],
    },
    {
      id: "length",
      units: [
        { id: "km", symbol: "km" },
        { id: "m", symbol: "m" },
        { id: "ft", symbol: "ft" },
      ],
    },
    {
      id: "temperature",
      units: [
        { id: "c", symbol: "°C" },
        { id: "f", symbol: "°F" },
        { id: "k", symbol: "K" },
      ],
    },
  ],
};

const CONVERSIONS: Record<string, string> = {
  "km:m": "1000",
  "m:km": "0.001",
  "km:ft": "3280.839895013123",
  "c:f": "32",
  "f:c": "-17.77777777777777777777777778",
};

const backend = vi.hoisted(() => ({
  tauri: true,
  fetchUnitCatalog: vi.fn<() => Promise<UnitCatalog>>(),
  convertUnit: vi.fn<(input: UnitConversionInput) => Promise<string>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    fetchUnitCatalog: backend.fetchUnitCatalog,
    convertUnit: backend.convertUnit,
    copyText: backend.copyText,
  };
});

function resultText(): string {
  return screen.getByTestId("unit-result").textContent ?? "";
}

function valueInput(): HTMLInputElement {
  return screen.getByRole("textbox", {
    name: i18n.t("units:inputValue"),
  }) as HTMLInputElement;
}

function combobox(name: string): HTMLElement {
  return screen.getByRole("combobox", { name });
}

function choose(name: string, option: RegExp) {
  fireEvent.click(combobox(name));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function renderPage() {
  return render(
    <ToastProvider>
      <ConverterPage />
    </ToastProvider>,
  );
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.fetchUnitCatalog.mockReset();
  backend.fetchUnitCatalog.mockResolvedValue(CATALOG);
  backend.convertUnit.mockReset();
  backend.convertUnit.mockImplementation(async (input) => {
    if (input.category === "currency") {
      throw new IpcError("CURRENCY_OFFLINE");
    }
    return CONVERSIONS[`${input.from}:${input.to}`] ?? "0";
  });
  backend.copyText.mockReset();
  backend.copyText.mockResolvedValue(undefined);
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, grouping: true },
    hydrated: true,
    saving: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
});

describe("ConverterPage", () => {
  it("loads the catalog and converts the default pair", async () => {
    renderPage();

    await waitFor(() =>
      expect(backend.convertUnit).toHaveBeenCalledWith({
        category: "length",
        value: "1",
        from: "km",
        to: "m",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("1,000"));
    expect(screen.getByTestId("unit-formula").textContent).toContain("km");
  });

  it("recomputes when the target unit changes", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:to"), /英尺/);

    await waitFor(() =>
      expect(backend.convertUnit).toHaveBeenLastCalledWith({
        category: "length",
        value: "1",
        from: "km",
        to: "ft",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("3,280.83989501"));
  });

  it("swaps the source and target units", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    fireEvent.click(screen.getByRole("button", { name: i18n.t("units:swap") }));

    await waitFor(() =>
      expect(backend.convertUnit).toHaveBeenLastCalledWith({
        category: "length",
        value: "1",
        from: "m",
        to: "km",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("0.001"));
  });

  it("resets unit pairs when the category changes", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:category"), /温度/);

    await waitFor(() =>
      expect(backend.convertUnit).toHaveBeenLastCalledWith({
        category: "temperature",
        value: "1",
        from: "c",
        to: "f",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("32"));
  });

  it("shows the localized error and hint when currency rates are offline", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:category"), /汇率/);

    await waitFor(() =>
      expect(resultText()).toBe(i18n.t("errors:CURRENCY_OFFLINE")),
    );
    expect(screen.getByText(i18n.t("units:currencyHint"))).toBeTruthy();
    const copyButton = screen.getByRole("button", {
      name: i18n.t("common:copy"),
    }) as HTMLButtonElement;
    expect(copyButton.disabled).toBe(true);
  });

  it("clears the result when the input is empty", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    fireEvent.change(valueInput(), { target: { value: "" } });
    await waitFor(() => expect(resultText()).toBe("—"));
  });

  it("copies the raw converted value", async () => {
    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    fireEvent.click(screen.getByRole("button", { name: i18n.t("common:copy") }));
    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("1000"));
  });

  it("keeps the page usable when preview mode has no backend", async () => {
    backend.tauri = false;
    renderPage();

    expect(await screen.findByText(i18n.t("basic:previewNotice"))).toBeTruthy();
    expect(backend.fetchUnitCatalog).not.toHaveBeenCalled();
  });
});