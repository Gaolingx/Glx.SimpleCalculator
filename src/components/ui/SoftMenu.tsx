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
import styles from "./SoftMenu.module.css";

export interface SoftMenuItem {
  id: string;
  label: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export interface SoftMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: readonly SoftMenuItem[];
  onClose: () => void;
  label?: string;
}

const VIEWPORT_GAP = 8;
const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled)';

function focusableItems(menu: HTMLElement | null): HTMLButtonElement[] {
  return menu
    ? Array.from(menu.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR))
    : [];
}

export function SoftMenu({ open, x, y, items, onClose, label }: SoftMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ left: x, top: y });
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const menu = menuRef.current;
    if (!menu) {
      setPosition({ left: x, top: y });
      return;
    }
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(
        VIEWPORT_GAP,
        Math.min(x, window.innerWidth - width - VIEWPORT_GAP),
      ),
      top: Math.max(
        VIEWPORT_GAP,
        Math.min(y, window.innerHeight - height - VIEWPORT_GAP),
      ),
    });
  }, [open, x, y, items.length]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previous = document.activeElement as HTMLElement | null;
    const menu = menuRef.current;
    (focusableItems(menu)[0] ?? menu)?.focus();

    const handlePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    const handleViewportChange = () => onCloseRef.current();

    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("keydown", handleKey, true);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const buttons = focusableItems(menuRef.current);
    if (buttons.length === 0) {
      return;
    }
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (event.key === "End") {
      next = buttons.length - 1;
    } else if (event.key === "ArrowDown") {
      next = index < 0 || index === buttons.length - 1 ? 0 : index + 1;
    } else if (event.key === "ArrowUp") {
      next = index <= 0 ? buttons.length - 1 : index - 1;
    }
    buttons[next].focus();
  };

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className={styles.menu}
      style={{ left: position.left, top: position.top }}
      onKeyDown={handleMenuKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={item.disabled}
          className={cx(styles.item, item.danger && styles.danger)}
          onClick={() => {
            item.onSelect();
            onCloseRef.current();
          }}
        >
          <span className={styles.label}>{item.label}</span>
          {item.shortcut ? (
            <span className={styles.shortcut}>{item.shortcut}</span>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}
