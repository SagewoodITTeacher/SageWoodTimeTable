import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Demo({ kind }: { kind: "success" | "error" | "info" }) {
  const toast = useToast();
  return (
    <button onClick={() => toast[kind]("hello world")}>fire</button>
  );
}

describe("Toast", () => {
  it("renders a success toast with role=status", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo kind="success" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    const t = screen.getByRole("status");
    expect(t).toHaveTextContent("hello world");
  });

  it("renders an error toast with role=alert", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo kind="error" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("hello world");
  });

  it("auto-dismisses after default duration (success: 4s)", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Demo kind="success" />
        </ToastProvider>
      );
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
      expect(screen.getByRole("status")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4001);
      });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("error toast lasts 6 seconds by default", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Demo kind="error" />
        </ToastProvider>
      );
      fireEvent.click(screen.getByRole("button", { name: "fire" }));
      act(() => {
        vi.advanceTimersByTime(4001);
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(2001);
      });
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("manual dismiss button removes the toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Demo kind="info" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    const dismiss = screen.getByRole("button", { name: /dismiss notification/i });
    await user.click(dismiss);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("throws when useToast is called outside provider", () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Demo kind="info" />)).toThrow(
        /ToastProvider/
      );
    } finally {
      console.error = orig;
    }
  });
});
