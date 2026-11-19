import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  SoftSegmentedControl,
  useToast,
  type SegmentedOption,
} from "../../components/ui";
import { isTauriRuntime, type CalcMode } from "../../lib/ipc";
import {
  WORD_SIZE_BITS,
  formatProgrammerExpression,
  formatProgrammerValue,
  narrowsValue,
} from "../../lib/programmer";
import type { Radix, WordSize } from "../../lib/settings";
import { useSettingsStore } from "../../stores/settings";
import { Display } from "../basic/Display";
import { MemoryBar } from "../basic/MemoryBar";
import { CalculatorMenu } from "../shared/CalculatorMenu";
import { useCalculatorSession } from "../shared/useCalculatorSession";
import { BitGrid } from "./BitGrid";
import { ProgrammerKeypad } from "./ProgrammerKeypad";
import styles from "./ProgrammerPage.module.css";

const MODE: CalcMode = "programmer";
const WORD_SIZES: readonly WordSize[] = ["qword", "dword", "word", "byte"];
const RADIX_ROWS: readonly Radix[] = [
  "hexadecimal",
  "decimal",
  "octal",
  "binary",
];

export function ProgrammerPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const settingsRadix = useSettingsStore((state) => state.settings.radix);
  const settingsWordSize = useSettingsStore((state) => state.settings.wordSize);
  const update = useSettingsStore((state) => state.update);
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

  const programmer = view.programmer;
  const radix = programmer?.radix ?? settingsRadix;
  const wordSize = programmer?.wordSize ?? settingsWordSize;
  const bits = programmer?.bits ?? "0".repeat(WORD_SIZE_BITS[wordSize]);

  useEffect(() => {
    if (isTauriRuntime()) {
      send({ type: "setRadix", radix: settingsRadix });
    }
  }, [send, settingsRadix]);

  useEffect(() => {
    if (isTauriRuntime()) {
      send({ type: "setWordSize", size: settingsWordSize });
    }
  }, [send, settingsWordSize]);

  const notifyError = () => {
    showToast(t("errors:INTERNAL"), { variant: "danger" });
  };

  const changeRadix = (next: Radix) => {
    if (next === radix) {
      return;
    }
    if (settingsRadix === next) {
      send({ type: "setRadix", radix: next });
      return;
    }
    void update({ radix: next }).catch(notifyError);
  };

  const changeWordSize = (next: WordSize) => {
    if (next === wordSize) {
      return;
    }
    const truncated = narrowsValue(programmer?.bits, next);
    if (settingsWordSize === next) {
      send({ type: "setWordSize", size: next });
    } else {
      void update({ wordSize: next }).catch(notifyError);
    }
    if (truncated) {
      showToast(t("programmer:truncated", { bits: WORD_SIZE_BITS[next] }), {
        variant: "warning",
      });
    }
  };

  const wordSizeOptions: SegmentedOption<WordSize>[] = WORD_SIZES.map((value) => ({
    value,
    label: t(`settings:wordSizeOption.${value}`),
  }));

  const valueText = formatProgrammerValue(view.value || "0", radix, grouping);
  const expressionText = formatProgrammerExpression(view.expression, radix, grouping);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("programmer:title")}</h1>
      </header>
      <section
        className={styles.calculator}
        aria-label={t("programmer:title")}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <Display
          expression={view.expression}
          expressionText={expressionText}
          value={view.value}
          valueText={valueText}
          error={transportError ?? view.error?.code ?? null}
          grouping={grouping}
          memory={view.memory !== null}
          onCopy={() => copyValue(view.value)}
          flashToken={clearPulse}
        />
        <MemoryBar hasMemory={view.memory !== null} onCommand={send} />
        <SoftSegmentedControl
          value={wordSize}
          options={wordSizeOptions}
          onChange={changeWordSize}
          ariaLabel={t("programmer:wordSize")}
          className={styles.wordSize}
        />
        <div
          className={styles.radixRows}
          role="radiogroup"
          aria-label={t("programmer:radix")}
        >
          {RADIX_ROWS.map((rowRadix) => {
            const label = t(`settings:radixOption.${rowRadix}`);
            const raw = programmer?.[rowRadix] ?? "0";
            const active = rowRadix === radix;
            return (
              <button
                key={rowRadix}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t("programmer:radixRow", { radix: label })}
                className={styles.radixRow}
                data-active={active}
                onClick={() => changeRadix(rowRadix)}
              >
                <span className={styles.radixTag}>{label}</span>
                <span className={styles.radixValue}>
                  {formatProgrammerValue(raw, rowRadix, grouping)}
                </span>
              </button>
            );
          })}
        </div>
        <BitGrid bits={bits} onToggle={(bit) => send({ type: "toggleBit", bit })} />
        <ProgrammerKeypad radix={radix} onCommand={send} />
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
        formatDisplay={(text) => formatProgrammerValue(text, radix, grouping)}
      />
    </div>
  );
}