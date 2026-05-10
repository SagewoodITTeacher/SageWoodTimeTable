import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { cn } from "./cn";

export interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  requireTypedConfirmation?: string;
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  requireTypedConfirmation,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
    }
  }, [open]);

  const requiresType = Boolean(requireTypedConfirmation);
  const isConfirmEnabled = !requiresType || typed === requireTypedConfirmation;

  const confirmClass =
    variant === "destructive"
      ? "bg-rose-600 hover:bg-rose-500 text-white disabled:bg-rose-900/50 border border-rose-500/30"
      : "bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-900/50 border border-indigo-500/30";

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-6">
        <div className="text-sm text-slate-100 leading-relaxed font-medium">{message}</div>
        {requiresType && (
          <div className="space-y-2">
            <label
              htmlFor="confirm-typed-input"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"
            >
              Verify identity: Type "{requireTypedConfirmation}"
            </label>
            <input
              id="confirm-typed-input"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-white/5 px-4 py-3 text-sm font-mono text-indigo-400 placeholder:text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95",
              confirmClass
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
