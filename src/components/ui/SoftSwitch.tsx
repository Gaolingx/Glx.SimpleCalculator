import { useId, type ReactNode } from "react";

import { cx } from "./cx";
import styles from "./SoftSwitch.module.css";

export interface SoftSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
}

export function SoftSwitch({
  checked,
  onChange,
  label,
  hint,
  ariaLabel,
  disabled = false,
}: SoftSwitchProps) {
  const id = useId();
  const labelId = label ? `${id}-label` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-label={label ? undefined : ariaLabel}
      aria-describedby={hintId}
      disabled={disabled}
      className={cx(styles.switch, checked && styles.on)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  );

  if (!label && !hint) {
    return control;
  }

  return (
    <div className={cx(styles.field, disabled && styles.disabled)}>
      <div className={styles.text}>
        {label ? (
          <span id={labelId} className={styles.label}>
            {label}
          </span>
        ) : null}
        {hint ? (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </div>
      {control}
    </div>
  );
}
