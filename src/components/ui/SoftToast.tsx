import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { cx } from "./cx";
import styles from "./SoftToast.module.css";

export type ToastVariant = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastApi {
  showToast: (message: string, options?: ToastOptions) => void;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [
      ...current,
      {
        id,
        message,
        variant: options?.variant ?? "info",
        duration: options?.duration ?? 3000,
      },
    ]);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (toast.duration <= 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <div role="status" aria-live="polite" className={cx(styles.toast, styles[toast.variant])}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.close}
        aria-label={t("dismiss")}
        onClick={() => onDismiss(toast.id)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2 2l8 8M10 2l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
