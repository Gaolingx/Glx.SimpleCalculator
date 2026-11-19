import { useEffect, type ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { HistoryDrawer } from "../components/layout/HistoryDrawer";
import { NavRail } from "../components/layout/NavRail";
import { TitleBar } from "../components/layout/TitleBar";
import { BasicPage } from "../features/basic/BasicPage";
import { ConverterPage } from "../features/converter/ConverterPage";
import { DateCalcPage } from "../features/datecalc/DateCalcPage";
import { ShortcutsSheet } from "../features/help/ShortcutsSheet";
import { ProgrammerPage } from "../features/programmer/ProgrammerPage";
import { ScientificPage } from "../features/scientific/ScientificPage";
import { SettingsSheet } from "../features/settings/SettingsSheet";
import { StatisticsPage } from "../features/statistics/StatisticsPage";
import { WorksheetsPage } from "../features/worksheets/WorksheetsPage";
import type { CalcMode } from "../lib/ipc";
import { useUiStore } from "../stores/ui";
import { navigate, usePage, type PageId } from "./router";
import styles from "./AppShell.module.css";

const PAGES: Record<PageId, ComponentType> = {
  basic: BasicPage,
  scientific: ScientificPage,
  programmer: ProgrammerPage,
  statistics: StatisticsPage,
  datecalc: DateCalcPage,
  converter: ConverterPage,
  worksheets: WorksheetsPage,
};

const MODE_BY_PAGE: Record<PageId, CalcMode> = {
  basic: "basic",
  scientific: "scientific",
  programmer: "programmer",
  statistics: "statistics",
  datecalc: "dateCalc",
  converter: "converter",
  worksheets: "worksheets",
};

export function AppShell() {
  const { t } = useTranslation();
  const page = usePage();
  const overlay = useUiStore((state) => state.overlay);
  const toggleOverlay = useUiStore((state) => state.toggleOverlay);
  const Page = PAGES[page];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        toggleOverlay("history");
        return;
      }
      if (
        event.key === "F1" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        toggleOverlay("help");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleOverlay]);

  return (
    <div className={styles.shell}>
      <a
        className={styles.skipLink}
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            document.getElementById("main-content")?.focus();
          }
        }}
      >
        {t("skipToContent")}
      </a>
      <TitleBar />
      <div className={styles.body}>
        <NavRail page={page} />
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <Page />
        </main>
      </div>
      {overlay === "history" ? (
        <HistoryDrawer mode={MODE_BY_PAGE[page]} onNavigate={navigate} />
      ) : null}
      <SettingsSheet />
      <ShortcutsSheet />
    </div>
  );
}
