// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import {
  IpcError,
  type WorksheetCatalog,
  type WorksheetId,
  type WorksheetResult,
} from "../../lib/ipc";
import { WorksheetsPage } from "./WorksheetsPage";

const CATALOG: WorksheetCatalog = {
  worksheets: [
    {
      id: "mortgage",
      fields: [
        { id: "principal", kind: "decimal", min: "0.01", max: "1000000000000", defaultValue: "1000000" },
        { id: "annualRate", kind: "decimal", min: "0", max: "100", defaultValue: "4.2" },
        { id: "years", kind: "integer", min: "1", max: "50", defaultValue: "30" },
      ],
      results: [
        { id: "monthlyPayment", kind: "money" },
        { id: "totalPayment", kind: "money" },
        { id: "totalInterest", kind: "money" },
      ],
    },
    {
      id: "fuel",
      fields: [
        { id: "distance", kind: "decimal", min: "0.01", max: "10000000", defaultValue: "500" },
        { id: "consumption", kind: "decimal", min: "0.01", max: "100", defaultValue: "7.5" },
        { id: "pricePerLiter", kind: "decimal", min: "0", max: "1000000", defaultValue: "7.5" },
      ],
      results: [
        { id: "totalFuel", kind: "decimal" },
        { id: "totalCost", kind: "money" },
        { id: "mpgUs", kind: "decimal" },
        { id: "mpgUk", kind: "decimal" },
      ],
    },
    {
      id: "lease",
      fields: [
        { id: "price", kind: "decimal", min: "0.01", max: "1000000000000", defaultValue: "300000" },
        { id: "residual", kind: "decimal", min: "0", max: "1000000000000", defaultValue: "150000" },
        { id: "months", kind: "integer", min: "1", max: "120", defaultValue: "36" },
        { id: "apr", kind: "decimal", min: "0", max: "100", defaultValue: "5" },
        { id: "taxRate", kind: "decimal", min: "0", max: "100", defaultValue: "0" },
      ],
      results: [
        { id: "monthlyPayment", kind: "money" },
        { id: "totalCost", kind: "money" },
        { id: "rentCharge", kind: "money" },
      ],
    },
  ],
};

const MORTGAGE_RESULT: WorksheetResult = {
  values: [
    { id: "monthlyPayment", value: "4890.17" },
    { id: "totalPayment", value: "1760461.2" },
    { id: "totalInterest", value: "760461.2" },
  ],
};

const FUEL_RESULT: WorksheetResult = {
  values: [
    { id: "totalFuel", value: "37.5" },
    { id: "totalCost", value: "281.25" },
    { id: "mpgUs", value: "31.36" },
    { id: "mpgUk", value: "37.66" },
  ],
};

const LEASE_RESULT: WorksheetResult = {
  values: [
    { id: "monthlyPayment", value: "5104.17" },
    { id: "totalCost", value: "183750.12" },
    { id: "rentCharge", value: "33750" },
  ],
};

const backend = vi.hoisted(() => ({
  tauri: true,
  fetchWorksheetCatalog: vi.fn<() => Promise<WorksheetCatalog>>(),
  computeWorksheet:
    vi.fn<(sheet: WorksheetId, inputs: Record<string, string>) => Promise<WorksheetResult>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    fetchWorksheetCatalog: backend.fetchWorksheetCatalog,
    computeWorksheet: backend.computeWorksheet,
    copyText: backend.copyText,
  };
});

function renderPage() {
  return render(
    <ToastProvider>
      <WorksheetsPage />
    </ToastProvider>,
  );
}

function field(name: string) {
  return screen.getByRole("textbox", { name });
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.fetchWorksheetCatalog.mockReset();
  backend.fetchWorksheetCatalog.mockResolvedValue(CATALOG);
  backend.computeWorksheet.mockReset();
  backend.computeWorksheet.mockImplementation((sheet) => {
    if (sheet === "fuel") {
      return Promise.resolve(FUEL_RESULT);
    }
    if (sheet === "lease") {
      return Promise.resolve(LEASE_RESULT);
    }
    return Promise.resolve(MORTGAGE_RESULT);
  });
  backend.copyText.mockReset();
  backend.copyText.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("WorksheetsPage", () => {
  it("computes the mortgage defaults and formats two-decimal money", async () => {
    renderPage();

    await waitFor(() =>
      expect(backend.computeWorksheet).toHaveBeenCalledWith("mortgage", {
        principal: "1000000",
        annualRate: "4.2",
        years: "30",
      }),
    );
    expect((await screen.findByTestId("worksheet-monthlyPayment")).textContent).toBe(
      "4,890.17",
    );
    expect(screen.getByTestId("worksheet-totalPayment").textContent).toBe("1,760,461.20");
    expect(screen.getByTestId("worksheet-totalInterest").textContent).toBe("760,461.20");
  });

  it("switches to fuel with registry defaults", async () => {
    renderPage();
    await waitFor(() => expect(backend.computeWorksheet).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("radio", { name: i18n.t("worksheets:sheets.fuel.title") }),
    );

    await waitFor(() =>
      expect(backend.computeWorksheet).toHaveBeenLastCalledWith("fuel", {
        distance: "500",
        consumption: "7.5",
        pricePerLiter: "7.5",
      }),
    );
    expect((await screen.findByTestId("worksheet-totalFuel")).textContent).toBe("37.5");
    expect(screen.getByTestId("worksheet-mpgUs").textContent).toBe("31.36");
  });

  it("blocks the backend when a field is locally invalid", async () => {
    renderPage();
    await waitFor(() => expect(backend.computeWorksheet).toHaveBeenCalled());
    backend.computeWorksheet.mockClear();

    fireEvent.change(
      field(i18n.t("worksheets:sheets.mortgage.fields.principal")),
      { target: { value: "0" } },
    );
    expect(
      await screen.findByText(i18n.t("worksheets:fieldMin", { min: "0.01" })),
    ).toBeTruthy();

    fireEvent.change(field(i18n.t("worksheets:sheets.mortgage.fields.years")), {
      target: { value: "30.5" },
    });
    expect(await screen.findByText(i18n.t("worksheets:fieldInteger"))).toBeTruthy();
    expect(backend.computeWorksheet).not.toHaveBeenCalled();
  });

  it("shows a backend field error under the field", async () => {
    backend.computeWorksheet.mockImplementation((sheet) => {
      if (sheet === "lease") {
        return Promise.reject(new IpcError("INVALID_INPUT", ["residual"]));
      }
      return Promise.resolve(MORTGAGE_RESULT);
    });
    renderPage();
    await waitFor(() => expect(backend.computeWorksheet).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("radio", { name: i18n.t("worksheets:sheets.lease.title") }),
    );

    await waitFor(() =>
      expect(screen.getByText(i18n.t("worksheets:fieldInvalid"))).toBeTruthy(),
    );
    expect(
      field(i18n.t("worksheets:sheets.lease.fields.residual")).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  it("shows cross-field rule errors on the offending field", async () => {
    backend.computeWorksheet.mockImplementation((sheet) => {
      if (sheet === "lease") {
        return Promise.reject(new IpcError("INVALID_INPUT", ["residualBelowPrice"]));
      }
      return Promise.resolve(MORTGAGE_RESULT);
    });
    renderPage();
    await waitFor(() => expect(backend.computeWorksheet).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole("radio", { name: i18n.t("worksheets:sheets.lease.title") }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("worksheets:rules.residualBelowPrice")),
      ).toBeTruthy(),
    );
    expect(
      field(i18n.t("worksheets:sheets.lease.fields.residual")).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  it("copies the canonical, ungrouped result", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("worksheet-monthlyPayment").textContent).toBe(
        "4,890.17",
      ),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("worksheets:copyResult", {
          name: i18n.t("worksheets:sheets.mortgage.results.monthlyPayment"),
        }),
      }),
    );

    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("4890.17"));
  });

  it("retries a failed catalog load", async () => {
    backend.fetchWorksheetCatalog.mockRejectedValueOnce(new Error("offline"));
    renderPage();

    expect(await screen.findByText(i18n.t("worksheets:loadFailed"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common:retry") }));

    expect((await screen.findByTestId("worksheet-monthlyPayment")).textContent).toBe(
      "4,890.17",
    );
    expect(backend.fetchWorksheetCatalog).toHaveBeenCalledTimes(2);
  });

  it("keeps preview mode free of backend calls", () => {
    backend.tauri = false;
    renderPage();

    expect(screen.getByText(i18n.t("basic:previewNotice"))).toBeTruthy();
    expect(backend.fetchWorksheetCatalog).not.toHaveBeenCalled();
    expect(backend.computeWorksheet).not.toHaveBeenCalled();
  });
});