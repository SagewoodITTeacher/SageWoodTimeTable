import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("does not render when open is false", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with role, aria-modal, and aria-labelledby pointing at the title", () => {
    render(
      <Modal open onClose={() => {}} title="Edit Teacher">
        <p>body</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent("Edit Teacher");
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X">
        <p>body</p>
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close on Escape when dismissOnEscape is false", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X" dismissOnEscape={false}>
        <p>body</p>
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus to the first focusable element on open", () => {
    render(
      <Modal open onClose={() => {}} title="X">
        <button>Inside</button>
      </Modal>
    );
    expect(screen.getByRole("button", { name: /Inside/ })).toBe(
      document.activeElement
    );
  });

  it("restores focus to the previously focused element on close", async () => {
    const Trigger = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="X">
            <button onClick={() => setOpen(false)}>close</button>
          </Modal>
        </>
      );
    };
    render(<Trigger />);
    const opener = screen.getByRole("button", { name: "open" });
    opener.focus();
    await userEvent.click(opener);
    expect(screen.getByRole("button", { name: "close" })).toBe(
      document.activeElement
    );
    await userEvent.keyboard("{Escape}");
    expect(opener).toBe(document.activeElement);
  });

  it("closes on backdrop mousedown by default", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X">
        <p>body</p>
      </Modal>
    );
    const backdrop = screen.getByRole("dialog").parentElement!;
    await userEvent.pointer({ keys: "[MouseLeft>]", target: backdrop });
    await userEvent.pointer({ keys: "[/MouseLeft]", target: backdrop });
    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close on backdrop when dismissOnBackdrop is false", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="X" dismissOnBackdrop={false}>
        <p>body</p>
      </Modal>
    );
    const backdrop = screen.getByRole("dialog").parentElement!;
    await userEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });
});
