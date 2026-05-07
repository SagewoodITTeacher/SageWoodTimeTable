# UI Primitives Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five reusable, accessible UI primitives (Modal, Toast, ConfirmDialog, SectionCard, Tabs) used to deduplicate ~12 modal sites, 19 alert/confirm calls, and 7 SectionCard duplicates in subsequent plans.

**Architecture:** New `src/components/ui/` directory. Each primitive: one component file + one test file + colocated styles via Tailwind. ToastProvider mounts at `App.tsx` root. All components are headless-first (no business state); consumers control open/data.

**Tech Stack:** React 19, Tailwind v4, lucide-react, vitest, @testing-library/react, @testing-library/user-event. Depends on Plan 1 (test infra setup).

**Depends on:** Plan 1 (vitest/RTL setup, `src/test/setup.ts`, `npm run test`).

---

## Conventions

- All primitives live in `src/components/ui/`. Index exports from `src/components/ui/index.ts` for ergonomic imports (`import { Modal, useToast } from '@/components/ui'`).
- Use `clsx` (already in deps `package.json:17`) + `tailwind-merge` (`package.json:27`) for class composition. Helper at `src/components/ui/cn.ts`.
- Tailwind classes use brand tokens (`curro-blue`, `curro-red`, `bg-gray`, `text-dark`, `text-muted`) defined in `src/index.css:8-14`. Do not hardcode hex.
- Radius: keep `rounded-2xl` for now. Plan 7 introduces `--radius-card` / `--radius-button` tokens that consumers will swap in via search-and-replace.
- Repo currently has no git history (`Is a git repository: false` per environment). The `git commit` steps below are advisory; if `git init` has been run by the time you execute, follow them. Otherwise, skip the commit steps.

## Files Created

| Path | Purpose |
|---|---|
| `src/components/ui/cn.ts` | `cn()` helper combining `clsx` + `tailwind-merge`. |
| `src/components/ui/Modal.tsx` | Headless dialog with focus trap, Escape, backdrop, restoration. |
| `src/components/ui/Modal.test.tsx` | RTL tests. |
| `src/components/ui/Toast.tsx` | `ToastProvider` + `useToast()` hook + portal queue. |
| `src/components/ui/Toast.test.tsx` | RTL tests. |
| `src/components/ui/ConfirmDialog.tsx` | Modal-based confirmation, optional typed-confirmation. |
| `src/components/ui/ConfirmDialog.test.tsx` | RTL tests. |
| `src/components/ui/SectionCard.tsx` | Variant-coloured card with header. |
| `src/components/ui/SectionCard.test.tsx` | RTL tests. |
| `src/components/ui/Tabs.tsx` | `Tabs` + `TabButton` with `tablist`/`tab` roles + arrow keys. |
| `src/components/ui/Tabs.test.tsx` | RTL tests. |
| `src/components/ui/index.ts` | Barrel export. |

No existing files in `src/` are modified by this plan. Plan 4 wires these primitives into the existing panels.

---

## Task 1: `cn()` helper

**Files:**
- Create: `src/components/ui/cn.ts`

- [ ] **Step 1: Create the helper**

```ts
// src/components/ui/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds (no new code paths invoked).

- [ ] **Step 3: Commit (if in git)**

```bash
git add src/components/ui/cn.ts
git commit -m "feat(ui): add cn() class-name helper"
```

---

## Task 2: `<Modal>` — failing tests for core a11y

**Files:**
- Create: `src/components/ui/Modal.test.tsx`

- [ ] **Step 1: Write failing tests for dialog roles, title, and Escape**

```tsx
// src/components/ui/Modal.test.tsx
import { describe, it, expect, vi } from "vitest";
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
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test -- src/components/ui/Modal.test.tsx --run`
Expected: FAIL with `Cannot find module './Modal'` or `Modal is not defined`.

---

## Task 3: `<Modal>` — implement core

**Files:**
- Create: `src/components/ui/Modal.tsx`

- [ ] **Step 1: Implement minimal Modal**

```tsx
// src/components/ui/Modal.tsx
import { useEffect, useId, useRef } from "react";
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
  children: React.ReactNode;
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
  children,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Track focus before open so we can restore it on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Focus first focusable element in the panel on open.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (firstFocusable ?? panel).focus();
  }, [open]);

  // Escape to close + focus trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (!dismissOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "bg-white w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] outline-none",
          SIZE_CLASS[size]
        )}
      >
        <div className="bg-curro-blue p-6 text-white flex items-center justify-between border-b-4 border-curro-red">
          <h3 id={titleId} className="text-lg font-black leading-tight">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/Modal.test.tsx --run`
Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Modal.tsx src/components/ui/Modal.test.tsx
git commit -m "feat(ui): add Modal primitive with role=dialog, Escape, focus trap"
```

---

## Task 4: `<Modal>` — focus management tests

**Files:**
- Modify: `src/components/ui/Modal.test.tsx`

- [ ] **Step 1: Add tests for focus on open + restoration on close + backdrop click**

Append to `src/components/ui/Modal.test.tsx` inside the `describe("Modal", ...)` block:

```tsx
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
      const [open, setOpen] = (require("react") as typeof import("react")).useState(false);
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
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/Modal.test.tsx --run`
Expected: 8 tests PASS. If focus restoration fails, the `useEffect` cleanup ordering needs to schedule `previouslyFocused.current?.focus()` after React unmounts — verify the `[open]` dep array runs the cleanup when `open` flips to false.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Modal.test.tsx
git commit -m "test(ui): cover Modal focus mgmt and backdrop dismissal"
```

---

## Task 5: `<ToastProvider>` + `useToast()` — failing tests

**Files:**
- Create: `src/components/ui/Toast.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/ui/Toast.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Demo({ kind }: { kind: "success" | "error" | "info" }) {
  const toast = useToast();
  return (
    <button onClick={() => toast[kind]("hello world")}>fire</button>
  );
}

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders a success toast with role=status", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Demo kind="error" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getByRole("alert")).toHaveTextContent("hello world");
  });

  it("auto-dismisses after default duration (success: 4s)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Demo kind="success" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("error toast lasts 6 seconds by default", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Demo kind="error" />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "fire" }));
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("manual dismiss button removes the toast", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test -- src/components/ui/Toast.test.tsx --run`
Expected: FAIL with module not found.

---

## Task 6: `<ToastProvider>` + `useToast()` — implement

**Files:**
- Create: `src/components/ui/Toast.tsx`

- [ ] **Step 1: Implement provider, hook, queue, and portal renderer**

```tsx
// src/components/ui/Toast.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "./cn";

export type ToastKind = "success" | "error" | "info";

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
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

const KIND_STYLES: Record<ToastKind, { bg: string; icon: React.ReactNode; role: "status" | "alert" }> = {
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
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
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

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (msg, opts) => push("success", msg, opts),
      error: (msg, opts) => push("error", msg, opts),
      info: (msg, opts) => push("info", msg, opts),
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
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/Toast.test.tsx --run`
Expected: 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Toast.tsx src/components/ui/Toast.test.tsx
git commit -m "feat(ui): add ToastProvider + useToast() with role=status/alert"
```

---

## Task 7: `<ConfirmDialog>` — failing tests

**Files:**
- Create: `src/components/ui/ConfirmDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/ui/ConfirmDialog.test.tsx
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
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- src/components/ui/ConfirmDialog.test.tsx --run`
Expected: FAIL.

---

## Task 8: `<ConfirmDialog>` — implement

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`

- [ ] **Step 1: Implement on top of `<Modal>`**

```tsx
// src/components/ui/ConfirmDialog.tsx
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { cn } from "./cn";

export interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
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

  // Reset typed value whenever dialog opens.
  useEffect(() => {
    if (open) setTyped("");
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
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/ConfirmDialog.test.tsx --run`
Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/ConfirmDialog.test.tsx
git commit -m "feat(ui): add ConfirmDialog with optional typed-confirmation gate"
```

---

## Task 9: `<SectionCard>` — failing tests

**Files:**
- Create: `src/components/ui/SectionCard.test.tsx`

The duplicated pattern is the "section header card with coloured banner + title + icon" used at `OperationalManager.tsx:288-301, 430-443, 545-555, 687-699` (and at least 3 more). It looks like:

```tsx
<div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-X">
  <div className="bg-curro-red p-6 text-white flex items-center justify-between border-b-4 border-red-800">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-xl font-black uppercase tracking-tight leading-tight">Title</h3>
        <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-0.5">Subtitle</p>
      </div>
    </div>
    <div className="text-right">{/* headerActions */}</div>
  </div>
  <div>{/* children */}</div>
</div>
```

`<SectionCard>` parameterizes the variant colour, title, optional subtitle, icon, and headerActions.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/ui/SectionCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShieldAlert } from "lucide-react";
import { SectionCard } from "./SectionCard";

describe("SectionCard", () => {
  it("renders title and children", () => {
    render(
      <SectionCard variant="red" title="Incidents">
        <p>body</p>
      </SectionCard>
    );
    expect(screen.getByRole("heading", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <SectionCard variant="emerald" title="Stats" subtitle="Last 24h">
        <p />
      </SectionCard>
    );
    expect(screen.getByText("Last 24h")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <SectionCard variant="red" title="X" icon={<ShieldAlert data-testid="icn" />}>
        <p />
      </SectionCard>
    );
    expect(screen.getByTestId("icn")).toBeInTheDocument();
  });

  it("renders headerActions in the right rail", () => {
    render(
      <SectionCard
        variant="blue"
        title="X"
        headerActions={<span data-testid="hdr">2 PENDING</span>}
      >
        <p />
      </SectionCard>
    );
    expect(screen.getByTestId("hdr")).toHaveTextContent("2 PENDING");
  });

  it("applies the variant class to the header", () => {
    const { container } = render(
      <SectionCard variant="emerald" title="X">
        <p />
      </SectionCard>
    );
    const header = container.querySelector("header")!;
    expect(header.className).toMatch(/emerald/);
  });

  it("uses a heading element so screen readers can navigate by headings", () => {
    render(
      <SectionCard variant="red" title="Heading">
        <p />
      </SectionCard>
    );
    expect(screen.getByRole("heading", { name: "Heading" }).tagName).toBe("H2");
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- src/components/ui/SectionCard.test.tsx --run`
Expected: FAIL.

---

## Task 10: `<SectionCard>` — implement

**Files:**
- Create: `src/components/ui/SectionCard.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/ui/SectionCard.tsx
import { cn } from "./cn";

export type SectionCardVariant = "emerald" | "red" | "blue" | "amber" | "zinc";

interface VariantStyle {
  header: string;
  border: string;
  iconBg: string;
}

const VARIANTS: Record<SectionCardVariant, VariantStyle> = {
  emerald: {
    header: "bg-emerald-600 text-white",
    border: "border-b-4 border-emerald-800",
    iconBg: "bg-white/15",
  },
  red: {
    header: "bg-curro-red text-white",
    border: "border-b-4 border-red-800",
    iconBg: "bg-white/10",
  },
  blue: {
    header: "bg-curro-blue text-white",
    border: "border-b-4 border-blue-900",
    iconBg: "bg-white/10",
  },
  amber: {
    header: "bg-amber-500 text-white",
    border: "border-b-4 border-amber-700",
    iconBg: "bg-white/15",
  },
  zinc: {
    header: "bg-zinc-900 text-white",
    border: "border-b-4 border-zinc-700",
    iconBg: "bg-white/10",
  },
};

export interface SectionCardProps {
  variant: SectionCardVariant;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function SectionCard({
  variant,
  title,
  subtitle,
  icon,
  headerActions,
  className,
  children,
}: SectionCardProps) {
  const v = VARIANTS[variant];
  return (
    <section
      className={cn(
        "bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "p-6 flex items-center justify-between",
          v.header,
          v.border
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          {icon && (
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                v.iconBg
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight leading-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-white/60 text-[11px] font-black uppercase tracking-widest mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerActions && <div className="shrink-0 ml-4">{headerActions}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/SectionCard.test.tsx --run`
Expected: 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SectionCard.tsx src/components/ui/SectionCard.test.tsx
git commit -m "feat(ui): add SectionCard with emerald/red/blue/amber/zinc variants"
```

---

## Task 11: `<Tabs>` + `<TabButton>` — failing tests

**Files:**
- Create: `src/components/ui/Tabs.test.tsx`

The current AdminPanel tabs (`AdminPanel.tsx:2105-2153`) render seven near-identical buttons with this pattern:

```tsx
<button
  onClick={() => setActiveTab("SUBJECTS")}
  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "SUBJECTS" ? "bg-curro-blue text-white shadow-lg scale-105" : "text-text-muted hover:bg-gray-50"}`}
>
  <BookOpen className="w-4 h-4" />
  Subjects
</button>
```

We replace that with `<Tabs value={activeTab} onValueChange={setActiveTab}>` containing `<TabButton value="SUBJECTS" icon={<BookOpen ... />}>Subjects</TabButton>` × 7.

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/ui/Tabs.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabButton } from "./Tabs";

function Demo({ initial = "a", onChange = () => {} }: { initial?: string; onChange?: (v: string) => void }) {
  return (
    <Tabs value={initial} onValueChange={onChange} aria-label="Demo tabs">
      <TabButton value="a">Alpha</TabButton>
      <TabButton value="b">Beta</TabButton>
      <TabButton value="c">Gamma</TabButton>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders a tablist with three tabs", () => {
    render(<Demo />);
    expect(screen.getByRole("tablist", { name: "Demo tabs" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks the active tab with aria-selected=true and the rest false", () => {
    render(<Demo initial="b" />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onValueChange when a non-active tab is clicked", async () => {
    const onChange = vi.fn();
    render(<Demo initial="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("ArrowRight moves focus to next tab; ArrowLeft moves to previous", async () => {
    render(<Demo initial="a" />);
    const a = screen.getByRole("tab", { name: "Alpha" });
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toBe(document.activeElement);
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
  });

  it("Home jumps to first tab; End to last", async () => {
    render(<Demo initial="b" />);
    const b = screen.getByRole("tab", { name: "Beta" });
    b.focus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toBe(document.activeElement);
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toBe(document.activeElement);
  });

  it("active tab has tabIndex=0; inactive tabs have tabIndex=-1 (roving tabindex)", () => {
    render(<Demo initial="b" />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("tabindex", "-1");
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm run test -- src/components/ui/Tabs.test.tsx --run`
Expected: FAIL.

---

## Task 12: `<Tabs>` + `<TabButton>` — implement

**Files:**
- Create: `src/components/ui/Tabs.tsx`

- [ ] **Step 1: Implement with roving tabindex and arrow-key nav**

```tsx
// src/components/ui/Tabs.tsx
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { cn } from "./cn";

interface TabsContextValue {
  value: string;
  onValueChange: (v: string) => void;
  values: string[];
  registerRef: (value: string, el: HTMLButtonElement | null) => void;
  focusValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
  "aria-label": ariaLabel,
}: TabsProps) {
  const refs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Walk children to capture the order of values for arrow-key nav.
  const values = useMemo(() => {
    const collected: string[] = [];
    Children.forEach(children, (child) => {
      if (
        isValidElement<{ value?: string }>(child) &&
        typeof child.props.value === "string"
      ) {
        collected.push(child.props.value);
      }
    });
    return collected;
  }, [children]);

  const registerRef = useCallback((v: string, el: HTMLButtonElement | null) => {
    if (el) refs.current.set(v, el);
    else refs.current.delete(v);
  }, []);

  const focusValue = useCallback((v: string) => {
    refs.current.get(v)?.focus();
  }, []);

  const ctx = useMemo<TabsContextValue>(
    () => ({ value, onValueChange, values, registerRef, focusValue }),
    [value, onValueChange, values, registerRef, focusValue]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn("flex items-center gap-1", className)}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabButtonProps {
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function TabButton({
  value,
  icon,
  disabled,
  children,
  className,
}: TabButtonProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabButton must be a child of <Tabs>");
  const isActive = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      ref={(el) => ctx.registerRef(value, el)}
      onClick={() => {
        if (!isActive) ctx.onValueChange(value);
      }}
      onKeyDown={(e) => {
        const idx = ctx.values.indexOf(value);
        if (idx < 0) return;
        let nextIdx: number | null = null;
        if (e.key === "ArrowRight") nextIdx = (idx + 1) % ctx.values.length;
        else if (e.key === "ArrowLeft")
          nextIdx = (idx - 1 + ctx.values.length) % ctx.values.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = ctx.values.length - 1;
        if (nextIdx === null) return;
        e.preventDefault();
        const nextValue = ctx.values[nextIdx];
        ctx.focusValue(nextValue);
      }}
      className={cn(
        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50",
        isActive
          ? "bg-curro-blue text-white shadow-lg"
          : "text-text-muted hover:bg-gray-50",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/components/ui/Tabs.test.tsx --run`
Expected: 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Tabs.tsx src/components/ui/Tabs.test.tsx
git commit -m "feat(ui): add Tabs + TabButton with tablist semantics and arrow-key nav"
```

---

## Task 13: Barrel export

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Write the barrel**

```ts
// src/components/ui/index.ts
export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
export { ToastProvider, useToast } from "./Toast";
export type { ToastKind, ToastOptions } from "./Toast";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { SectionCard } from "./SectionCard";
export type { SectionCardProps, SectionCardVariant } from "./SectionCard";
export { Tabs, TabButton } from "./Tabs";
export type { TabsProps, TabButtonProps } from "./Tabs";
export { cn } from "./cn";
```

- [ ] **Step 2: Verify build & full test run**

Run: `npm run build && npm run test -- --run`
Expected: build succeeds, all tests in `src/components/ui/*.test.tsx` PASS (29 tests total).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): add barrel export for primitives"
```

---

## Self-Review Checklist (run before handoff)

- [ ] Every task has actual code (no `// implement` placeholders).
- [ ] Every test in this plan has a matching implementation step that makes it pass.
- [ ] All five primitives are exported from `src/components/ui/index.ts`.
- [ ] No primitive depends on Firebase, the existing panel state, or any cross-cutting context — they are headless and purely presentational/focus-managed.
- [ ] `Tabs` test for arrow-key navigation does NOT change the active value (it changes only focus); confirm the implementation matches the test (it does — `onValueChange` only fires on click/Enter via the click handler. If you want Enter/Space to activate, add `if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ctx.onValueChange(value); }` to the keydown handler — but only after adding a corresponding test).
- [ ] No design-token references that don't exist yet (radius/spacing tokens are introduced in Plan 7; this plan still uses literal `rounded-2xl`/`rounded-3xl`).

---

## What Plan 4 will do with these primitives

(For continuity — do NOT do this work here.)

- Wrap `App.tsx` with `<ToastProvider>`.
- Replace 11 `alert(`s in `AdminPanel.tsx` with `toast.success` / `toast.error`.
- Replace 8 `confirm(`s with `<ConfirmDialog>`. Use `requireTypedConfirmation="CLEAR"` for the bulk-clear at `AdminPanel.tsx:6297`.
- Replace ~12 modal sites in `AdminPanel.tsx` (lines 3670, 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995) and `TeacherDashboard.tsx` (520, 578, 685) with `<Modal>`.
- Replace ~7 SectionCard duplicates in `OperationalManager.tsx` (288-301, 430-443, 545-555, 687-699, plus three more) with `<SectionCard>`.
- Replace AdminPanel tab nav (`AdminPanel.tsx:2105-2153`) with `<Tabs>` + `<TabButton>` × 7.
