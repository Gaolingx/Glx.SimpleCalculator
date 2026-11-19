import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { cx } from "./cx";
import styles from "./SoftInput.module.css";

export interface SoftInputProps extends ComponentPropsWithRef<"input"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  endAdornment?: ReactNode;
}

export function SoftInput({
  label,
  hint,
  error,
  endAdornment,
  id,
  className,
  disabled,
  ...rest
}: SoftInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div
      className={cx(styles.field, disabled && styles.disabled, error ? styles.invalid : undefined, className)}
    >
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className={styles.control}>
        <input
          id={inputId}
          className={styles.input}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {endAdornment ? <span className={styles.adornment}>{endAdornment}</span> : null}
      </div>
      {error ? (
        <span id={errorId} className={styles.errorText}>
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
