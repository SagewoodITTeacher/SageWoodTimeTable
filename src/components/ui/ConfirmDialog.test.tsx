import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title, message, and confirm/cancel buttons", () => {
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        title="Delete venue"
        message="This cannot be undone."
      />
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Delete venue");
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("calls onConfirm when Confirm is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="X"
        message="Y"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={onCancel}
        onConfirm={() => {}}
        title="X"
        message="Y"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm until requireTypedConfirmation matches exactly", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Bulk clear"
        message="Type CLEAR to continue"
        requireTypedConfirmation="CLEAR"
        variant="destructive"
      />
    );
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toBeDisabled();
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "clear");
    expect(confirm).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "CLEAR");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("destructive variant gives the Confirm button red styling", () => {
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        title="X"
        message="Y"
        variant="destructive"
      />
    );
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm.className).toMatch(/curro-red|bg-red/);
  });
});
