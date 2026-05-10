import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  hideClose?: boolean;
  children: ReactNode;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  hideClose = false,
  children,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const content = contentRef.current;
    const panel = panelRef.current;
    const firstFocusable = content?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable ?? panel)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const nodes = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const focusables: HTMLElement[] = [];
      nodes.forEach((el) => {
        if (!el.hasAttribute("disabled")) {
          focusables.push(el);
        }
      });
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, dismissOnEscape, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (!dismissOnBackdrop) {
          return;
        }
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "bg-slate-900 w-full rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh] outline-none border border-white/5",
          SIZE_CLASS[size]
        )}
      >
        <div className="bg-white/[0.02] p-6 text-white flex items-center justify-between border-b border-white/5">
          <h3 id={titleId} className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">
            {title}
          </h3>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-2 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10 hover:text-indigo-400"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div ref={contentRef} className="flex-1 overflow-auto p-8 text-slate-300">{children}</div>
      </div>
    </div>,
    document.body
  );
}
