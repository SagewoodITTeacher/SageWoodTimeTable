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
import { createPortal } from "react-dom";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "./cn";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
  action?: ToastOptions["action"];
}

interface ToastApi {
  success: (msg: string, opts?: ToastOptions) => void;
  error: (msg: string, opts?: ToastOptions) => void;
  info: (msg: string, opts?: ToastOptions) => void;
  warning: (msg: string, opts?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
  warning: 5000,
};

const KIND_STYLES: Record<
  ToastKind,
  { bg: string; icon: ReactNode; role: "status" | "alert" }
> = {
  success: {
    bg: "bg-emerald-600 text-white",
    icon: <CheckCircle2 className="w-5 h-5" />,
    role: "status",
  },
  info: {
    bg: "bg-curro-blue text-white",
    icon: <Info className="w-5 h-5" />,
    role: "status",
  },
  error: {
    bg: "bg-curro-red text-white",
    icon: <AlertTriangle className="w-5 h-5" />,
    role: "alert",
  },
  warning: {
    bg: "bg-amber-500 text-white",
    icon: <AlertTriangle className="w-5 h-5" />,
    role: "alert",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, opts?: ToastOptions) => {
      const id = ++idRef.current;
      const duration = opts?.duration ?? DEFAULT_DURATION[kind];
      setItems((prev) => [...prev, { id, kind, message, duration, action: opts?.action }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (msg, opts) => push("success", msg, opts),
      error: (msg, opts) => push("error", msg, opts),
      info: (msg, opts) => push("info", msg, opts),
      warning: (msg, opts) => push("warning", msg, opts),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
            {items.map((t) => {
              const style = KIND_STYLES[t.kind];
              return (
                <div
                  key={t.id}
                  role={style.role}
                  className={cn(
                    "pointer-events-auto min-w-[260px] max-w-md rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3",
                    style.bg
                  )}
                >
                  <div className="shrink-0 mt-0.5">{style.icon}</div>
                  <div className="flex-1 text-sm font-semibold leading-snug">
                    {t.message}
                  </div>
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action!.onClick();
                        dismiss(t.id);
                      }}
                      className="text-xs font-black uppercase tracking-widest underline underline-offset-2"
                    >
                      {t.action.label}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(t.id)}
                    className="shrink-0 p-1 rounded-full hover:bg-white/15"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
