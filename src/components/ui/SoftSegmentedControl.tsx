import type { CSSProperties, ReactNode } from "react";

import { cx } from "./cx";
import styles from "./SoftSegmentedControl.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SoftSegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

type SegmentStyle = CSSProperties & {
  "--segment-count": number;
  "--segment-index": number;
};

export function SoftSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: SoftSegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const style: SegmentStyle = {
    "--segment-count": options.length,
    "--segment-index": activeIndex,
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.group, disabled && styles.disabled, className)}
      style={style}
    >
      <span className={styles.indicator} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          className={cx(styles.segment, option.value === value && styles.active)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
