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
      ? "bg-curro-red hover:bg-red-700 text-white disabled:bg-red-300"
      : "bg-curro-blue hover:bg-blue-800 text-white disabled:bg-blue-300";

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        <div className="text-sm text-text-dark">{message}</div>
        {requiresType && (
          <div className="space-y-1">
            <label
              htmlFor="confirm-typed-input"
              className="text-[11px] font-black uppercase tracking-widest text-text-muted"
            >
              Type "{requireTypedConfirmation}" to confirm
            </label>
            <input
              id="confirm-typed-input"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-bold text-text-dark hover:bg-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed",
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
