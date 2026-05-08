import React from "react";
import { ConfirmDialog } from "../../ui";
import { ConfirmState } from "./types";

export function ConfirmFromState({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  if (!state) {
    return null;
  }
  return (
    <ConfirmDialog
      open={state.open}
      onCancel={onClose}
      onConfirm={async () => {
        const action = state.onConfirm;
        onClose();
        await action();
      }}
      title={state.title}
      message={state.message}
      variant={state.variant ?? "default"}
      requireTypedConfirmation={state.requireTyped}
      confirmLabel={state.confirmLabel}
    />
  );
}
