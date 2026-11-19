import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "./cx";
import styles from "./SoftCombobox.module.css";

export interface ComboboxOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Secondary text shown on the right of the option row. */
  hint?: ReactNode;
  /** Overrides the label used for first-letter typeahead. */
  searchText?: string;
}

export interface SoftComboboxProps<T extends string> {
  value: T;
  options: readonly ComboboxOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  label?: ReactNode;
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const VIEWPORT_GAP = 8;
const MIN_WIDTH = 180;

function searchable<T extends string>(option: ComboboxOption<T>): string {
  return option.searchText ?? (typeof option.label === "string" ? option.label : option.value);
}

export function SoftCombobox<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  label,
  placeholder,
  disabled = false,
  className,
  id,
}: SoftComboboxProps<T>) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const listId = `${triggerId}-listbox`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const [position, setPosition] = useState({ left: 0, top: 0, width: MIN_WIDTH });

  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, MIN_WIDTH);
    const height = list?.getBoundingClientRect().height ?? 0;
    const below = rect.bottom + VIEWPORT_GAP;
    const fitsBelow = below + height <= window.innerHeight - VIEWPORT_GAP;
    const top = fitsBelow
      ? below
      : Math.max(VIEWPORT_GAP, rect.top - VIEWPORT_GAP - height);
    setPosition({
      left: Math.max(VIEWPORT_GAP, Math.min(rect.left, window.innerWidth - width - VIEWPORT_GAP)),
      top,
      width,
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const option = document.getElementById(`${listId}-${activeIndex}`);
    option?.scrollIntoView?.({ block: "nearest" });

    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleScroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleResize = () => setOpen(false);

    document.addEventListener("pointerdown", handlePointer, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, activeIndex, listId]);

  const openList = (index = Math.max(0, selectedIndex)) => {
    if (disabled || options.length === 0) {
      return;
    }
    setActiveIndex(index);
    setOpen(true);
  };

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const select = (index: number) => {
    const option = options[index];
    if (!option) {
      return;
    }
    onChange(option.value);
    close(true);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (open) {
          setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        } else {
          openList();
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (open) {
          setActiveIndex((index) => Math.max(0, index - 1));
        } else {
          openList(Math.max(0, selectedIndex));
        }
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case "Enter":
        if (open) {
          event.preventDefault();
          select(activeIndex);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close(true);
        }
        break;
      case "Tab":
        if (open) {
          close(false);
        }
        break;
      default: {
        if (
          event.key.length !== 1 ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          options.length === 0
        ) {
          return;
        }
        const needle = event.key.toLowerCase();
        const start = open ? activeIndex + 1 : 0;
        const ordered = [...options.slice(start), ...options.slice(0, start)];
        const match = ordered.findIndex((option) =>
          searchable(option).toLowerCase().startsWith(needle),
        );
        if (match === -1) {
          return;
        }
        event.preventDefault();
        const index = (start + match) % options.length;
        setActiveIndex(index);
        if (!open) {
          setOpen(true);
        }
      }
    }
  };

  return (
    <div className={cx(styles.field, className)}>
      {label ? (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        className={styles.trigger}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.value}>
          {selected ? selected.label : (placeholder ?? value)}
        </span>
        <svg
          className={styles.chevron}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className={styles.popup}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
              }}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={cx(
                    styles.option,
                    index === activeIndex && styles.active,
                    option.value === value && styles.selected,
                  )}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => select(index)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint ? (
                    <span className={styles.optionHint}>{option.hint}</span>
                  ) : null}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}