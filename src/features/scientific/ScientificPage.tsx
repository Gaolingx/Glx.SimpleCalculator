import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SoftButton,
  SoftSegmentedControl,
  useToast,
  type SegmentedOption,
} from "../../components/ui";
import { isTauriRuntime, type CalcMode } from "../../lib/ipc";
import type { AngleUnit } from "../../lib/settings";
import { useSettingsStore } from "../../stores/settings";
import { CalculatorMenu } from "../shared/CalculatorMenu";
import { useCalculatorSession } from "../shared/useCalculatorSession";
import { Display } from "../basic/Display";
import { MemoryBar } from "../basic/MemoryBar";
import { ScientificKeypad } from "./ScientificKeypad";
import styles from "./ScientificPage.module.css";

const MODE: CalcMode = "scientific";
const ANGLE_UNITS: readonly AngleUnit[] = ["deg", "rad", "grad"];

export function ScientificPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const angleUnit = useSettingsStore((state) => state.settings.angleUnit);
  const update = useSettingsStore((state) => state.update);
  const [scientificNotation, setScientificNotation] = useState(false);
  const {
    view,
    transportError,
    previewNotice,
    menu,
    setMenu,
    clearPulse,
    send,
    copyValue,
    handlePaste,
  } = useCalculatorSession(MODE);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    send({ type: "setAngleUnit", unit: angleUnit });
  }, [angleUnit, send]);

  const angleOptions: SegmentedOption<AngleUnit>[] = ANGLE_UNITS.map((value) => ({
    value,
    label: t(`settings:angle.${value}`),
  }));

  const changeAngle = (unit: AngleUnit) => {
    void update({ angleUnit: unit }).catch(() =>
      showToast(t("errors:INTERNAL"), { variant: "danger" }),
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("scientific:title")}</h1>
      </header>
      <section
        className={styles.calculator}
        aria-label={t("scientific:title")}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <Display
          expression={view.expression}
          value={view.value}
          error={transportError ?? view.error?.code ?? null}
          grouping={grouping}
          memory={view.memories.length > 0}
          notation={scientificNotation ? "scientific" : "auto"}
          onCopy={() => copyValue(view.value)}
          flashToken={clearPulse}
        />
        <MemoryBar memories={view.memories} onCommand={send} />
        <div className={styles.toolbar}>
          <SoftSegmentedControl
            value={angleUnit}
            options={angleOptions}
            onChange={changeAngle}
            ariaLabel={t("scientific:angleUnit")}
            className={styles.angle}
          />
          <SoftButton
            variant="function"
            size="sm"
            className={styles.notation}
            aria-pressed={scientificNotation}
            aria-label={t("scientific:notation.toggle")}
            onClick={() => setScientificNotation((enabled) => !enabled)}
          >
            F-E
          </SoftButton>
        </div>
        <ScientificKeypad onCommand={send} />
        {previewNotice ? (
          <p className={styles.notice} role="status">
            {t("basic:previewNotice")}
          </p>
        ) : null}
      </section>
      <CalculatorMenu
        menu={menu}
        onClose={() => setMenu(null)}
        value={view.value}
        expression={view.expression}
        grouping={grouping}
        onCopyValue={copyValue}
        onPaste={handlePaste}
        onClear={() => send({ type: "clearAll" })}
      />
    </div>
  );
}