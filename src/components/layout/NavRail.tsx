import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { navigate, type PageId } from "../../app/router";
import { useUiStore } from "../../stores/ui";
import { SoftTooltip } from "../ui";
import { cx } from "../ui/cx";
import styles from "./NavRail.module.css";
import {
  BasicIcon,
  ConverterIcon,
  DateCalcIcon,
  HistoryIcon,
  ProgrammerIcon,
  ScientificIcon,
  SettingsIcon,
  StatisticsIcon,
  WorksheetsIcon,
  type AppIconProps,
} from "./icons";

interface NavItem {
  id: PageId;
  labelKey: string;
  Icon: ComponentType<AppIconProps>;
}

const PRIMARY_ITEMS: readonly NavItem[] = [
  { id: "basic", labelKey: "menu:nav.basic", Icon: BasicIcon },
  { id: "scientific", labelKey: "menu:nav.scientific", Icon: ScientificIcon },
  { id: "programmer", labelKey: "menu:nav.programmer", Icon: ProgrammerIcon },
  { id: "statistics", labelKey: "menu:nav.statistics", Icon: StatisticsIcon },
  { id: "datecalc", labelKey: "menu:nav.datecalc", Icon: DateCalcIcon },
  { id: "converter", labelKey: "menu:nav.converter", Icon: ConverterIcon },
  { id: "worksheets", labelKey: "menu:nav.worksheets", Icon: WorksheetsIcon },
];

export function NavRail({ page }: { page: PageId }) {
  const { t } = useTranslation();
  const overlay = useUiStore((state) => state.overlay);
  const toggleOverlay = useUiStore((state) => state.toggleOverlay);

  return (
    <nav className={styles.rail} aria-label={t("navigation")}>
      <div className={styles.group}>
        {PRIMARY_ITEMS.map(({ id, labelKey, Icon }, index) => {
          const label = t(labelKey);
          const active = page === id;
          return (
            <div key={id} className={index === 4 ? styles.groupBreak : undefined}>
              <SoftTooltip content={label} placement="right">
                <button
                  type="button"
                  className={cx(styles.item, active && styles.active)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon />
                </button>
              </SoftTooltip>
            </div>
          );
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.group}>
        <SoftTooltip content={t("menu:history")} placement="right">
          <button
            type="button"
            className={cx(styles.item, overlay === "history" && styles.active)}
            aria-label={t("menu:history")}
            aria-pressed={overlay === "history"}
            onClick={() => toggleOverlay("history")}
          >
            <HistoryIcon />
          </button>
        </SoftTooltip>
        <SoftTooltip content={t("menu:settings")} placement="right">
          <button
            type="button"
            className={cx(styles.item, overlay === "settings" && styles.active)}
            aria-label={t("menu:settings")}
            aria-pressed={overlay === "settings"}
            onClick={() => toggleOverlay("settings")}
          >
            <SettingsIcon />
          </button>
        </SoftTooltip>
      </div>
    </nav>
  );
}
