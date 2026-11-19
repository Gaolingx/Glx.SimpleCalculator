import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SoftButton,
  SoftDialog,
  SoftInput,
  SoftSegmentedControl,
  SoftSwitch,
  useToast,
  type SegmentedOption,
} from "../../components/ui";
import { isValidHistoryLimit } from "../../lib";
import { toIpcError, type ErrorCode } from "../../lib/ipc";
import type { AngleUnit, Radix, WordSize } from "../../lib/settings";
import type { ThemeSetting } from "../../lib/theme";
import type { AppLanguage } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import styles from "./SettingsSheet.module.css";

const THEME_VALUES: readonly ThemeSetting[] = ["light", "dark", "system"];
const LANGUAGE_VALUES: readonly AppLanguage[] = ["zh-CN", "en-US"];
const ANGLE_VALUES: readonly AngleUnit[] = ["deg", "rad", "grad"];
const WORD_SIZE_VALUES: readonly WordSize[] = ["qword", "dword", "word", "byte"];
const RADIX_VALUES: readonly Radix[] = ["hexadecimal", "decimal", "octal", "binary"];

export function SettingsSheet() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const open = useUiStore((state) => state.overlay === "settings");
  const closeOverlay = useUiStore((state) => state.closeOverlay);
  const settings = useSettingsStore((state) => state.settings);
  const saving = useSettingsStore((state) => state.saving);
  const error = useSettingsStore((state) => state.error);
  const update = useSettingsStore((state) => state.update);
  const reset = useSettingsStore((state) => state.reset);

  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const limitValue = limitDraft ?? String(settings.historyLimit);

  const notifyError = (cause: unknown) => {
    const code: ErrorCode = toIpcError(cause).code;
    showToast(t(`errors:${code}`), { variant: "danger" });
  };

  const change = (patch: Parameters<typeof update>[0]) => {
    void update(patch).catch(notifyError);
  };

  const commitLimit = () => {
    const text = limitValue.trim();
    const value = Number(text);
    if (text === "" || !isValidHistoryLimit(value)) {
      setLimitError(t("settings:historyLimitInvalid"));
      return;
    }
    setLimitError(null);
    setLimitDraft(null);
    change({ historyLimit: value });
  };

  const handleReset = () => {
    void reset()
      .then(() => showToast(t("settings:resetDone"), { variant: "success" }))
      .catch(notifyError);
  };

  const themeOptions: SegmentedOption<ThemeSetting>[] = THEME_VALUES.map((value) => ({
    value,
    label: t(`theme.${value}`),
  }));
  const languageOptions: SegmentedOption<AppLanguage>[] = LANGUAGE_VALUES.map((value) => ({
    value,
    label: t(`language.${value}`),
  }));
  const angleOptions: SegmentedOption<AngleUnit>[] = ANGLE_VALUES.map((value) => ({
    value,
    label: t(`settings:angle.${value}`),
  }));
  const wordSizeOptions: SegmentedOption<WordSize>[] = WORD_SIZE_VALUES.map((value) => ({
    value,
    label: t(`settings:wordSizeOption.${value}`),
  }));
  const radixOptions: SegmentedOption<Radix>[] = RADIX_VALUES.map((value) => ({
    value,
    label: t(`settings:radixOption.${value}`),
  }));

  return (
    <SoftDialog
      open={open}
      onClose={closeOverlay}
      title={t("settings:title")}
      footer={
        <SoftButton variant="ghost" fullWidth onClick={closeOverlay}>
          {t("close")}
        </SoftButton>
      }
    >
      <div className={styles.sections}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("settings:appearance")}</h3>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("theme.label")}</span>
            <SoftSegmentedControl
              value={settings.theme}
              options={themeOptions}
              onChange={(value) => change({ theme: value })}
              ariaLabel={t("theme.label")}
              disabled={saving}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("language.label")}</span>
            <SoftSegmentedControl
              value={settings.language}
              options={languageOptions}
              onChange={(value) => change({ language: value })}
              ariaLabel={t("language.label")}
              disabled={saving}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("settings:general")}</h3>
          <SoftSwitch
            checked={settings.grouping}
            onChange={(checked) => change({ grouping: checked })}
            label={t("settings:grouping")}
            hint={t("settings:groupingHint")}
            disabled={saving}
          />
          <SoftSwitch
            checked={settings.historyEnabled}
            onChange={(checked) => change({ historyEnabled: checked })}
            label={t("settings:historyEnabled")}
            hint={t("settings:historyEnabledHint")}
            disabled={saving}
          />
          <SoftInput
            label={t("settings:historyLimit")}
            hint={t("settings:historyLimitHint")}
            error={limitError ?? undefined}
            value={limitValue}
            inputMode="numeric"
            maxLength={4}
            disabled={saving || !settings.historyEnabled}
            onChange={(event) => {
              setLimitDraft(event.target.value);
              setLimitError(null);
            }}
            onBlur={commitLimit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitLimit();
              }
            }}
          />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("settings:defaults")}</h3>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("settings:angleUnit")}</span>
            <SoftSegmentedControl
              value={settings.angleUnit}
              options={angleOptions}
              onChange={(value) => change({ angleUnit: value })}
              ariaLabel={t("settings:angleUnit")}
              disabled={saving}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("settings:wordSize")}</span>
            <SoftSegmentedControl
              value={settings.wordSize}
              options={wordSizeOptions}
              onChange={(value) => change({ wordSize: value })}
              ariaLabel={t("settings:wordSize")}
              disabled={saving}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("settings:radix")}</span>
            <SoftSegmentedControl
              value={settings.radix}
              options={radixOptions}
              onChange={(value) => change({ radix: value })}
              ariaLabel={t("settings:radix")}
              disabled={saving}
            />
          </div>
        </section>

        {error ? (
          <p className={styles.error} role="alert">
            {t(`errors:${error.code}`)}
          </p>
        ) : null}

        <SoftButton variant="danger" fullWidth disabled={saving} onClick={handleReset}>
          {t("settings:resetDefaults")}
        </SoftButton>
      </div>
    </SoftDialog>
  );
}
