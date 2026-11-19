// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import {
  IpcError,
  type CurrencyStatus,
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

const OFFLINE_STATUS: CurrencyStatus = {
  source: "ECB",
  base: "EUR",
  date: null,
  fetchedAt: null,
  stale: true,
  available: false,
  refreshFailed: false,
};

const ONLINE_STATUS: CurrencyStatus = {
  source: "ECB",
  base: "EUR",
  date: "2026-11-18",
  fetchedAt: 1_763_500_800_000,
  stale: false,
  available: true,
  refreshFailed: false,
};

const backend = vi.hoisted(() => ({
  tauri: true,
  fetchUnitCatalog: vi.fn<() => Promise<UnitCatalog>>(),
  convertUnit: vi.fn<(input: UnitConversionInput) => Promise<string>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
  fetchCurrencyStatus: vi.fn<() => Promise<CurrencyStatus>>(),
  refreshCurrency: vi.fn<() => Promise<CurrencyStatus>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    fetchUnitCatalog: backend.fetchUnitCatalog,
    convertUnit: backend.convertUnit,
    copyText: backend.copyText,
    fetchCurrencyStatus: backend.fetchCurrencyStatus,
    refreshCurrency: backend.refreshCurrency,
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
  backend.fetchCurrencyStatus.mockReset();
  backend.fetchCurrencyStatus.mockResolvedValue({ ...OFFLINE_STATUS });
  backend.refreshCurrency.mockReset();
  backend.refreshCurrency.mockResolvedValue({ ...OFFLINE_STATUS });
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

  it("shows the ECB source and converts with cached rates", async () => {
    backend.fetchCurrencyStatus.mockResolvedValue({ ...ONLINE_STATUS });
    backend.convertUnit.mockImplementation(async (input) => {
      if (input.category === "currency") {
        return "1.1585";
      }
      return CONVERSIONS[`${input.from}:${input.to}`] ?? "0";
    });

    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:category"), /汇率/);

    await waitFor(() =>
      expect(backend.convertUnit).toHaveBeenLastCalledWith({
        category: "currency",
        value: "1",
        from: "eur",
        to: "usd",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("1.1585"));
    expect(screen.getByTestId("currency-rate-bar").textContent).toContain(
      "2026-11-18",
    );
  });

  it("refreshes rates and recomputes the currency result", async () => {
    let online = false;
    backend.convertUnit.mockImplementation(async (input) => {
      if (input.category === "currency") {
        if (!online) {
          throw new IpcError("CURRENCY_OFFLINE");
        }
        return "1.1585";
      }
      return CONVERSIONS[`${input.from}:${input.to}`] ?? "0";
    });
    backend.refreshCurrency.mockImplementation(async () => {
      online = true;
      return { ...ONLINE_STATUS };
    });

    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:category"), /汇率/);
    await waitFor(() =>
      expect(resultText()).toBe(i18n.t("errors:CURRENCY_OFFLINE")),
    );

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("units:refreshRates") }),
    );

    await waitFor(() => expect(backend.refreshCurrency).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(resultText()).toBe("1.1585"));
    expect(screen.getByTestId("currency-rate-bar").textContent).toContain(
      "2026-11-18",
    );
  });

  it("keeps cached rates when a refresh fails", async () => {
    backend.fetchCurrencyStatus.mockResolvedValue({ ...ONLINE_STATUS });
    backend.convertUnit.mockImplementation(async (input) =>
      input.category === "currency"
        ? "1.1585"
        : (CONVERSIONS[`${input.from}:${input.to}`] ?? "0"),
    );
    backend.refreshCurrency.mockRejectedValue(new IpcError("NETWORK_ERROR"));

    renderPage();
    await waitFor(() => expect(resultText()).toBe("1,000"));

    choose(i18n.t("units:category"), /汇率/);
    await waitFor(() => expect(resultText()).toBe("1.1585"));

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("units:refreshRates") }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("units:refreshFailed", { date: "2026-11-18" })),
      ).toBeTruthy(),
    );
    expect(resultText()).toBe("1.1585");
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
    expect(backend.fetchCurrencyStatus).not.toHaveBeenCalled();
  });
});