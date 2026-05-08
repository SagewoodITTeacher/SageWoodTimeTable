import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "../ui";

describe("ClearAssignments confirmation", () => {
  it("disables the confirm button until 'CLEAR' is typed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Clear all assignments"
        message="Type CLEAR to confirm clearing all assignments for 2026-05-07."
        confirmLabel="Clear"
        variant="destructive"
        requireTypedConfirmation="CLEAR"
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /clear/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByRole("textbox");
    await user.type(input, "CLEAR");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("keeps the confirm button disabled when the typed string is wrong", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Clear all assignments"
        message="Type CLEAR to confirm."
        confirmLabel="Clear"
        variant="destructive"
        requireTypedConfirmation="CLEAR"
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /clear/i });
    await user.type(screen.getByRole("textbox"), "clear");
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "X");
    expect(confirmButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
