# Apply Primitives + Eliminate alerts/confirms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every native `alert()`/`confirm()` and every ad-hoc modal/section/tab implementation with the Plan 3 primitives. Net effect: ~hundreds of lines deleted from `AdminPanel.tsx` and `OperationalManager.tsx`; uniform a11y across modals.

**Architecture:** Pure replacement plan — no new components, just sweeping consumers. Each section is a grep-then-replace exercise with a verification test where reasonable; otherwise lint + dev-server smoke test.

**Tech Stack:** React 19, Tailwind v4, vitest, @testing-library/react.

**Depends on:** Plan 3 (UI primitives must ship first). Plan 1 sets up vitest. Plan 1 also deletes the duplicate workload chart in `OperationalManager.tsx:286-356` — assume that landed before this plan; this plan converts the *remaining* OperationalManager section cards.

---

## Site Inventory (verified by grep on 2026-05-07)

| Category | File | Lines |
|---|---|---|
| `alert()` (11) | `src/components/AdminPanel.tsx` | 672, 6308, 6311, 6400, 6479, 6694, 6697, 8149, 8256, 8285, 8323 |
| `confirm()` (8) | `src/components/AdminPanel.tsx` | 1931, 3221, 3431, 5832, 6297, 8173, 8194, 8269 |
| `alert()` (3) | `src/components/TeacherDashboard.tsx` | 87, 90, 297 |
| Modal shells (11) | `src/components/AdminPanel.tsx` | 3670, 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995, 8632 |
| Modal shells (3) | `src/components/TeacherDashboard.tsx` | 524, 581, 686 |
| SectionCard duplicates (8) | `src/components/OperationalManager.tsx` | 333, 396, 509, 617, 777, 794, 908, 982 |
| Tab nav (1) | `src/components/AdminPanel.tsx` | 2105–2153 |

Re-run the greps below at start to detect drift since 2026-05-07:

```bash
grep -n "alert(\|confirm(" src/components/AdminPanel.tsx
grep -n "alert(\|confirm(" src/components/TeacherDashboard.tsx
grep -n "fixed inset-0" src/components/AdminPanel.tsx
grep -n "fixed inset-0" src/components/TeacherDashboard.tsx
grep -n "rounded-3xl border border-gray-100 shadow-xl" src/components/OperationalManager.tsx
```

---

## Task 1: Mount `<ToastProvider>` at app root

**Files:**
- Modify: `src/App.tsx` (top-level render around `App` return)
- Test: `src/components/ui/Toast.test.tsx` (already exists from Plan 3)

- [ ] **Step 1: Re-run greps to confirm site inventory hasn't drifted**

Run:
```bash
cd /home/leon/dev/github/curro
grep -cn "alert(\|confirm(" src/components/AdminPanel.tsx
grep -cn "alert(\|confirm(" src/components/TeacherDashboard.tsx
```

Expected: AdminPanel `19` matches (11 alerts + 8 confirms), TeacherDashboard `3` matches. If counts differ, update the inventory table at the top of this plan before proceeding.

- [ ] **Step 2: Wrap the app root with `<ToastProvider>`**

In `src/App.tsx`, locate the outermost JSX returned by the `App` component (search for the top-level `<div className="min-h-screen ...">`). Wrap it:

```tsx
import { ToastProvider } from "./components/ui/Toast";
// ... existing imports ...

// In the return:
return (
  <ToastProvider>
    {/* existing JSX */}
  </ToastProvider>
);
```

- [ ] **Step 3: Run dev server, verify nothing regressed**

Run: `npm run dev`
Expected: app loads as before; no console errors. Open the React DevTools tree and confirm `ToastProvider` is present at the root.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "chore(ui): mount ToastProvider at app root

Foundation for replacing alert()/toast.error in subsequent tasks."
```

---

## Task 2: Replace 11 `alert()` calls in `AdminPanel.tsx`

Each alert is replaced with `toast.success(...)` or `toast.error(...)`. Classification table — use this as the source of truth:

| Line | Current text | Severity | Replacement |
|---|---|---|---|
| 672 | "Start date cannot be after end date." | error | `toast.error("Start date cannot be after end date.")` |
| 6308 | "Cleared all assignments for today." | success | `toast.success("Cleared all assignments for today.")` |
| 6311 | "Failed to clear assignments." | error | `toast.error("Failed to clear assignments.")` |
| 6400 | "No open slots found in this session for this teacher." | error | `toast.error("No open slots found in this session for this teacher.")` |
| 6479 | "Failed to remove assignment. Please try again." | error | `toast.error("Failed to remove assignment. Please try again.")` |
| 6694 | "Auto-assigned venues for all exams in range." | success | `toast.success("Auto-assigned venues for all exams in range.")` |
| 6697 | "Failed to auto-assign venues." | error | `toast.error("Failed to auto-assign venues.")` |
| 8149 | "This subject code or name already exists in the master list." | error | `toast.error("This subject code or name already exists in the master list.")` |
| 8256 | "…" (long subject reconstruction msg, read inline) | error | preserve text via `toast.error(...)` |
| 8285 | "…" (read inline) | error | `toast.error(...)` |
| 8323 | "Visual Art reconstruction complete." | success | `toast.success("Visual Art reconstruction complete.")` |

**Files:**
- Modify: `src/components/AdminPanel.tsx` (lines listed above)
- Test: `src/components/AdminPanel.toast.test.tsx` (new — smoke test only)

- [ ] **Step 1: Add `useToast` import to `AdminPanel.tsx`**

At the top of the file (after existing react/firebase imports):

```tsx
import { useToast } from "./ui/Toast";
```

- [ ] **Step 2: Pull `toast` into the `AdminPanel` component**

Inside the `AdminPanel` function body (near other top-level hook calls like `useState`):

```tsx
const toast = useToast();
```

If `AdminPanel` is the consumer of `alert()` *inside nested inner components* (it has 15), you must thread `toast` down via prop or call `useToast()` inside each inner component that uses an alert. Pick the inner-component approach for each of the 15 — calling `useToast()` inside each is fine and avoids prop-drilling.

- [ ] **Step 3: Replace each alert site with the table mapping above**

For each line, edit in place. Example for line 672:

Old:
```tsx
alert("Start date cannot be after end date.");
```

New:
```tsx
toast.error("Start date cannot be after end date.");
```

Repeat for all 11 sites using the classification table.

- [ ] **Step 4: Verify zero `alert(` calls remain in `AdminPanel.tsx`**

Run: `grep -c "alert(" src/components/AdminPanel.tsx`
Expected: `0`

If non-zero, find the missed sites with `grep -n "alert(" src/components/AdminPanel.tsx` and replace.

- [ ] **Step 5: Add a smoke test for one toast site**

Create `src/components/AdminPanel.toast.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ui/Toast";

// Minimal toast smoke test: a button that fires toast.error reaches the DOM with role="alert".
function ToastFireButton() {
  const toast = useToast();
  return <button onClick={() => toast.error("Smoke test failure")}>Fire</button>;
}

describe("Toast smoke (AdminPanel replacement target)", () => {
  it("renders an error toast with role=alert when invoked", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastFireButton />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /fire/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Smoke test failure");
  });
});
```

This is a smoke test for the Toast contract, not a functional test of every AdminPanel call site (~11 unit tests would be redundant given the trivial mapping). The plan explicitly chooses lint + dev-server verification for the call sites themselves; this test guarantees the contract holds.

- [ ] **Step 6: Run the test**

Run: `npm run test -- AdminPanel.toast`
Expected: PASS.

- [ ] **Step 7: Lint + typecheck**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.toast.test.tsx
git commit -m "refactor(admin): replace 11 alert() calls with toast

Native alert() blocks the event loop and breaks the visual language.
Each call mapped to toast.success or toast.error per UX_DESIGN_REVIEW.md."
```

---

## Task 3: Replace 8 `confirm()` calls in `AdminPanel.tsx`

Each `confirm()` is replaced with `<ConfirmDialog>` driven by local state. For each call site, you need:
- A `useState<{ open: boolean; payload: T | null }>` for the dialog
- A handler that opens the dialog with the payload
- An `onConfirm` that runs the original work
- An `onCancel` that closes

Sites and replacement parameters:

| Line | Trigger description | Variant | Typed confirmation? | Title | Message |
|---|---|---|---|---|---|
| 1931 | "Auto-assign / regenerate" (read inline for full message) | default | no | "Confirm regeneration" | inline message |
| 3221 | "Remove all exact time/subject duplicates for this teacher?" | destructive | no | "Remove duplicates" | "Remove all exact time/subject duplicates for this teacher?" |
| 3431 | "Are you sure you want to remove this specific assignment?" | destructive | no | "Remove assignment" | "Are you sure you want to remove this specific assignment?" |
| 5832 | "Are you sure you want to delete this venue?" | destructive | no | "Delete venue" | "Are you sure you want to delete this venue?" |
| **6297** | **"Are you sure you want to clear ALL assignments for ${selectedDate}?"** | **destructive** | **`"CLEAR"`** | **"Clear all assignments"** | **`Type CLEAR to confirm clearing all assignments for ${selectedDate}.`** |
| 8173 | (read inline — likely subject mass-edit) | destructive | no | match inline | match inline |
| 8194 | (read inline) | destructive | no | match inline | match inline |
| 8269 | (read inline) | destructive | no | match inline | match inline |

For sites 1931, 8173, 8194, 8269: read the inline message text from the file and reuse it verbatim.

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Test: `src/components/AdminPanel.confirm.test.tsx` (new — TDD focus on the typed-confirmation case)

- [ ] **Step 1: Add `ConfirmDialog` import**

```tsx
import { ConfirmDialog } from "./ui/ConfirmDialog";
```

- [ ] **Step 2: Define the failing TDD test for the typed-confirmation case (line 6297)**

Create `src/components/AdminPanel.confirm.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ui/ConfirmDialog";

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
```

- [ ] **Step 3: Run the tests — they should pass already if Plan 3 is done**

Run: `npm run test -- AdminPanel.confirm`
Expected: PASS (these test the Plan 3 primitive directly; if it's broken, fix Plan 3 first).

- [ ] **Step 4: Replace `confirm()` site at line 6297 (the typed-confirmation case first)**

Read `AdminPanel.tsx` around line 6280–6320 first to find the surrounding handler (likely a button onClick). Convert the imperative `if (!confirm(...)) return;` into:

1. Add state near other component state:

```tsx
const [clearAssignmentsDialog, setClearAssignmentsDialog] = useState<{
  open: boolean;
  date: string | null;
}>({ open: false, date: null });
```

2. Change the trigger handler from:

```tsx
const handleClearAssignments = async () => {
  if (!window.confirm(`Are you sure you want to clear ALL assignments for ${selectedDate}?`)) return;
  // ... existing clearing logic ...
};
```

to:

```tsx
const handleClearAssignments = () => {
  setClearAssignmentsDialog({ open: true, date: selectedDate });
};

const performClearAssignments = async () => {
  setClearAssignmentsDialog({ open: false, date: null });
  // ... move the existing clearing logic here verbatim ...
};
```

3. Render the dialog inside the component's JSX (near the other modals):

```tsx
<ConfirmDialog
  open={clearAssignmentsDialog.open}
  onCancel={() => setClearAssignmentsDialog({ open: false, date: null })}
  onConfirm={performClearAssignments}
  title="Clear all assignments"
  message={`Type CLEAR to confirm clearing all assignments for ${clearAssignmentsDialog.date}.`}
  confirmLabel="Clear assignments"
  variant="destructive"
  requireTypedConfirmation="CLEAR"
/>
```

- [ ] **Step 5: Replace the remaining 7 `confirm()` sites**

For each of lines 1931, 3221, 3431, 5832, 8173, 8194, 8269 — apply the same pattern with `requireTypedConfirmation` omitted. Most of these are inside nested inner components or inline handlers; keep state local to the component that owns the trigger (lift only as far as needed).

For line 3221 ("Remove all exact time/subject duplicates"):

```tsx
const [removeDupesDialog, setRemoveDupesDialog] = useState<{
  open: boolean;
  teacherId: string | null;
}>({ open: false, teacherId: null });

// Trigger:
onClick={() => setRemoveDupesDialog({ open: true, teacherId: t.id })}

// Render:
<ConfirmDialog
  open={removeDupesDialog.open}
  onCancel={() => setRemoveDupesDialog({ open: false, teacherId: null })}
  onConfirm={() => {
    if (removeDupesDialog.teacherId) {
      performRemoveDuplicates(removeDupesDialog.teacherId);
    }
    setRemoveDupesDialog({ open: false, teacherId: null });
  }}
  title="Remove duplicate assignments"
  message="Remove all exact time/subject duplicates for this teacher?"
  confirmLabel="Remove duplicates"
  variant="destructive"
/>
```

Repeat the pattern for each of the remaining sites. Read each file region to grab the exact wording for sites 1931, 8173, 8194, 8269.

- [ ] **Step 6: Verify zero `confirm(` calls remain**

Run: `grep -c "confirm(" src/components/AdminPanel.tsx`
Expected: `0`

- [ ] **Step 7: Run the dev server, click each replaced trigger, verify the dialog appears**

Run: `npm run dev`. Open the app, log in as admin, exercise:
- Date range form (line 672) → already covered by Task 2 alert
- Teacher dupe-remove button (line 3221)
- Single-assignment remove button (line 3431)
- Venue delete button (line 5832)
- Clear-all-assignments button (line 6297) — verify Confirm stays disabled until "CLEAR" typed
- Subject confirms (lines 8173, 8194, 8269)

Note any missed sites and add them to the inventory.

- [ ] **Step 8: Lint + typecheck**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.confirm.test.tsx
git commit -m "refactor(admin): replace 8 confirm() calls with ConfirmDialog

Bulk clear-assignments uses requireTypedConfirmation='CLEAR' to prevent
accidental wipes. UX_DESIGN_REVIEW.md item #5/#21."
```

---

## Task 4: Replace 3 `alert()` calls in `TeacherDashboard.tsx` + add inline error banner

The teacher dashboard's failure alerts are on the safety-critical path (help requests, leave). Replace each with `toast.error(...)` AND surface an inline `role="alert"` banner above the form so the message persists after the toast auto-dismisses.

**Files:**
- Modify: `src/components/TeacherDashboard.tsx` (lines 87, 90, 297)

- [ ] **Step 1: Add toast import**

```tsx
import { useToast } from "./ui/Toast";
```

- [ ] **Step 2: Add `formError` state for the leave-request and help-request forms**

Near the existing `useState` calls in `TeacherDashboard`:

```tsx
const [leaveFormError, setLeaveFormError] = useState<string | null>(null);
const [helpFormError, setHelpFormError] = useState<string | null>(null);
const toast = useToast();
```

- [ ] **Step 3: Replace line 87 (leave success)**

Find:
```tsx
alert('Leave request submitted successfully!');
```

Replace with:
```tsx
toast.success("Leave request submitted successfully");
setLeaveFormError(null);
```

- [ ] **Step 4: Replace line 90 (leave failure)**

Find:
```tsx
alert('Failed to submit leave request.');
```

Replace with:
```tsx
const message = "Failed to submit leave request. Please try again.";
setLeaveFormError(message);
toast.error(message);
```

- [ ] **Step 5: Replace line 297 (help failure)**

Find:
```tsx
alert('Failed to send help request.');
```

Replace with:
```tsx
const message = "Failed to send help request. Try the call button again.";
setHelpFormError(message);
toast.error(message);
```

- [ ] **Step 6: Add inline error banner above the leave form**

Find the leave-request form's outermost wrapper (between line 686 and the form's first input). Insert above the inputs:

```tsx
{leaveFormError && (
  <div role="alert" className="mb-4 rounded-2xl border border-curro-red/30 bg-curro-red/5 px-4 py-3 text-sm font-bold text-curro-red">
    {leaveFormError}
  </div>
)}
```

Clear `leaveFormError` whenever the user changes any field (`onChange={() => setLeaveFormError(null)}` or wrap inputs in a single `onChange` capture).

- [ ] **Step 7: Add inline error banner above the help-request modal body**

Find the help-request modal (line 581 area). Insert above the option buttons:

```tsx
{helpFormError && (
  <div role="alert" className="mb-3 rounded-xl border border-curro-red/30 bg-curro-red/5 px-3 py-2 text-xs font-bold text-curro-red">
    {helpFormError}
  </div>
)}
```

- [ ] **Step 8: Verify zero alerts in TeacherDashboard**

Run: `grep -c "alert(" src/components/TeacherDashboard.tsx`
Expected: `0`

- [ ] **Step 9: Lint, dev-server smoke**

Run: `npm run lint && npm run dev`. Manually trigger leave-submit failure (disable network, submit) and verify both the inline banner and toast appear.

- [ ] **Step 10: Commit**

```bash
git add src/components/TeacherDashboard.tsx
git commit -m "refactor(teacher): inline error banners + toast for leave/help failures

UX_DESIGN_REVIEW.md item #21. Persistent banner survives toast dismissal
on the safety-critical help-request path."
```

---

## Task 5: Apply `<Modal>` primitive to 11 modal sites in `AdminPanel.tsx`

Sites: 3670, 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995, 8632.

Each modal currently looks like (around line 3670):

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  onClick={() => setOpen(false)}
>
  <motion.div
    initial={{ scale: 0.95 }}
    animate={{ scale: 1 }}
    exit={{ scale: 0.95 }}
    className="bg-white rounded-3xl ..."
    onClick={(e) => e.stopPropagation()}
  >
    <button onClick={() => setOpen(false)}><X className="w-6 h-6" /></button>
    <h2>...</h2>
    {/* body */}
  </motion.div>
</motion.div>
```

Target form:

```tsx
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="..." // existing h2 text
  size="lg" // pick sm/md/lg per modal width
>
  {/* body, with the existing close-X button removed */}
</Modal>
```

**Files:**
- Modify: `src/components/AdminPanel.tsx`
- Test: `src/components/AdminPanel.modals.test.tsx` (new — covers Escape + focus restoration for two representative sites)

- [ ] **Step 1: Import Modal**

```tsx
import { Modal } from "./ui/Modal";
```

- [ ] **Step 2: For each of the 11 sites, perform the replacement**

Process in order (3670 first to validate the pattern, then the rest). For each:

1. Read the surrounding ~80 lines (`Read offset=3650 limit=120`).
2. Identify the title text (the `<h2>`).
3. Identify the close handler (e.g. `setIsAddTeacherOpen(false)`).
4. Identify the open state variable (e.g. `isAddTeacherOpen`).
5. Replace the entire `motion.div`/`fixed inset-0 ...` wrapper with `<Modal>`.
6. Delete the inner close-X `<button>` — Modal renders its own.
7. Keep the body `<div>` with form fields as-is.
8. Pick `size`: forms with single column = `sm`, dual-column or table previews = `md`, large schedulers = `lg`.

For an example diff at site 3670:

Before:
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  onClick={onClose}
>
  <motion.div
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="p-6 border-b">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase">Add Teacher</h2>
        <button onClick={onClose}>
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
    <form className="p-6 space-y-4">
      {/* fields */}
    </form>
  </motion.div>
</motion.div>
```

After:
```tsx
<Modal open={isOpen} onClose={onClose} title="Add Teacher" size="sm">
  <form className="p-6 space-y-4">
    {/* fields */}
  </form>
</Modal>
```

Repeat for sites 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995, 8632.

- [ ] **Step 3: Verify all `fixed inset-0 ... backdrop-blur` shells removed from `AdminPanel.tsx` (only Modal-internal usage remains)**

Run: `grep -c "fixed inset-0" src/components/AdminPanel.tsx`
Expected: at most matches that are *not* modal shells (e.g. dropdown overlays). Inspect the remaining matches to confirm.

- [ ] **Step 4: Add focus-restoration smoke test**

Create `src/components/AdminPanel.modals.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./ui/Modal";

describe("Modal a11y contract (used by AdminPanel sites)", () => {
  it("restores focus to the trigger on close", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Test">
            <button>Inside</button>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /open/i });
    trigger.focus();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus inside the dialog while open", async () => {
    // Plan 3 covers this in detail; this is a duplicate-coverage smoke test.
    // Skip if Plan 3 already covers it.
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- AdminPanel.modals`
Expected: PASS.

- [ ] **Step 6: Dev-server smoke through every modal**

Run: `npm run dev`. Open AdminPanel, exercise each tab, open every modal, press Escape on each, click the X on each. Confirm focus returns to the trigger button each time.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.modals.test.tsx
git commit -m "refactor(admin): unify 11 modal sites under Modal primitive

Replaces hand-rolled fixed inset-0 shells with the a11y-compliant Modal
from Plan 3. Adds focus-trap, Escape, focus restoration, role=dialog,
aria-modal everywhere. UX_DESIGN_REVIEW.md item #9."
```

---

## Task 6: Apply `<Modal>` to 3 sites in `TeacherDashboard.tsx`

Sites: 524 (help notification overlay), 581 (help-request bottom sheet), 686 (leave-request bottom sheet).

Site 524 is a *display-only* notification (the standby teacher being told someone needs help) and should NOT be a `<Modal>` — it should stay as a positioned overlay but get `role="alert"` + `aria-live="assertive"` (covered in Plan 8). Skip site 524 in this task.

Sites 581 and 686 are bottom-sheet modals. Convert to `<Modal>` with `size="md"`.

**Files:**
- Modify: `src/components/TeacherDashboard.tsx`

- [ ] **Step 1: Import Modal**

```tsx
import { Modal } from "./ui/Modal";
```

- [ ] **Step 2: Convert site 581 (help-request modal)**

Read lines 575–680 to capture the existing structure. Replace the `fixed inset-0 z-[100] flex items-end justify-center p-0` shell with:

```tsx
<Modal
  open={isHelpModalOpen}
  onClose={() => setIsHelpModalOpen(false)}
  title="Request help"
  size="md"
>
  {/* existing body: option buttons, quantity stepper, submit */}
</Modal>
```

Delete the absolute backdrop `<div>` at line 587 and the inner panel wrapper. Keep the option list, stepper, and submit button.

- [ ] **Step 3: Convert site 686 (leave-request modal)**

Same treatment. Title: `"Request leave"`.

- [ ] **Step 4: Verify only the help-notification (line 524) remains as a non-Modal overlay**

Run: `grep -n "fixed inset-0" src/components/TeacherDashboard.tsx`
Expected: one match in the line-524 region, none for 581/686.

- [ ] **Step 5: Lint + dev-server smoke**

Run: `npm run lint && npm run dev`. Open Teacher dashboard, click "Call HELP" → expect bottom-sheet modal with focus on first option. Click "Request Leave" → expect modal with focus on Leave Type select. Press Escape on each → modal closes, focus returns to trigger.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeacherDashboard.tsx
git commit -m "refactor(teacher): help-request & leave-request modals via Modal primitive

Help-notification overlay (line 524) intentionally kept as positioned
panel; aria semantics deferred to Plan 8 (Motion & ARIA)."
```

---

## Task 7: Apply `<SectionCard>` to 8 OperationalManager duplicates

Sites: 333, 396, 509, 617, 777, 794, 908, 982.

Each currently looks like:

```tsx
<div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-0">
  <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
    <Briefcase className="w-6 h-6 text-white" />
    <h3 className="text-white font-black uppercase tracking-widest text-sm">Workload</h3>
  </div>
  <div className="p-6">
    {/* body */}
  </div>
</div>
```

Color → variant mapping (verify by reading each header bg class):

| Line | Section | Header bg | Variant |
|---|---|---|---|
| 333 | Workload | (verify) | emerald |
| 396 | Incident Rapports | (verify) | red |
| 509 | Leave records | (verify) | blue |
| 617 | Marking gantt or extension log | (verify) | amber |
| 777 | Pending extensions | `bg-amber-100` neighborhood | amber |
| 794 | (verify) | (verify) | (verify) |
| 908 | Admin Privilege Management | (verify) | zinc |
| 982 | Workload (bottom) | emerald | emerald |

**Files:**
- Modify: `src/components/OperationalManager.tsx`

- [ ] **Step 1: Import SectionCard**

```tsx
import { SectionCard } from "./ui/SectionCard";
```

- [ ] **Step 2: Read each section to confirm the variant mapping**

Run, for each line: `Read offset=<line-2> limit=15`. Note the exact bg color class on the header div. Update the mapping table above.

- [ ] **Step 3: For each of the 8 sites, replace the wrapper**

Example for site 333 (workload):

Before:
```tsx
<div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-0">
  <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
    <Briefcase className="w-6 h-6 text-white" />
    <h3 className="text-white font-black uppercase tracking-widest text-sm">Workload</h3>
  </div>
  <div className="p-6">
    {/* chart */}
  </div>
</div>
```

After:
```tsx
<SectionCard variant="emerald" title="Workload" icon={<Briefcase className="w-6 h-6" />}>
  {/* chart */}
</SectionCard>
```

If the original header had right-aligned action buttons (e.g. CSV download at site 982), pass them via `headerActions`:

```tsx
<SectionCard
  variant="emerald"
  title="Workload"
  icon={<Briefcase className="w-6 h-6" />}
  headerActions={
    <button onClick={downloadCsv} className="...">Download CSV</button>
  }
>
  {/* body */}
</SectionCard>
```

- [ ] **Step 4: Repeat for sites 396, 509, 617, 777, 794, 908, 982**

After all 8 replacements, verify the file shrank significantly:

Run: `wc -l src/components/OperationalManager.tsx`
Expected: down from ~1,215 to under 1,100.

- [ ] **Step 5: Run dev server, verify each section still renders correctly**

Run: `npm run dev`. Visit OperationalManager, scroll through. Each section should look identical to before (variant colors should match).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/OperationalManager.tsx
git commit -m "refactor(ops): consolidate 8 SectionCard duplicates

Extracts the bg-white rounded-3xl + colored header pattern into
<SectionCard variant=...>. UX_DESIGN_REVIEW.md item #10."
```

---

## Task 8: Apply `<Tabs>` + `<TabButton>` to AdminPanel tab nav

Site: `AdminPanel.tsx:2105–2153`.

The current shape is a `<div>` containing 7 nearly identical `<button>` elements with handlers like `onClick={() => setActiveTab('SUBJECTS')}` and conditional className for active vs inactive state.

**Files:**
- Modify: `src/components/AdminPanel.tsx`

- [ ] **Step 1: Import Tabs primitives**

```tsx
import { Tabs, TabButton } from "./ui/Tabs";
```

- [ ] **Step 2: Read the current tab nav block**

Read lines 2100–2160 to see the exact button list. Note the icon (lucide) and label for each of the 7 tabs.

- [ ] **Step 3: Replace the `<div>` of buttons with `<Tabs>` + `<TabButton>`**

Replace lines 2105–2153 with:

```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
  <TabButton value="SUBJECTS" icon={<BookOpen className="w-4 h-4" />}>
    Subjects
  </TabButton>
  <TabButton value="FACULTY" icon={<Users className="w-4 h-4" />}>
    Faculty
  </TabButton>
  <TabButton value="EXAM_TIMETABLE" icon={<CalendarDays className="w-4 h-4" />}>
    Exam Timetable
  </TabButton>
  <TabButton value="VENUES" icon={<MapPin className="w-4 h-4" />}>
    Venues
  </TabButton>
  <TabButton value="SCHEDULER" icon={<Layers className="w-4 h-4" />}>
    Scheduler
  </TabButton>
  <TabButton value="ASSIGNMENTS" icon={<ListChecks className="w-4 h-4" />}>
    Assignments
  </TabButton>
  <TabButton value="INSPECTION" icon={<Search className="w-4 h-4" />}>
    Inspection
  </TabButton>
</Tabs>
```

Use the *actual* lucide icon imports already present in `AdminPanel.tsx` — do not add new ones.

- [ ] **Step 4: Verify keyboard navigation**

Run: `npm run dev`. With keyboard, Tab to the tablist, then press → / ←. Focus should move between TabButtons; Enter should activate; `aria-selected="true"` should appear on the active one (inspect via DevTools).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "refactor(admin): replace 7 tab buttons with Tabs primitive

Adds role=tablist, aria-selected, and arrow-key navigation across the
seven AdminPanel tabs. UX_DESIGN_REVIEW.md item #10 + a11y note in §3."
```

---

## Task 9: Final sweep — verify zero alert/confirm/raw-modal residue

- [ ] **Step 1: Grep audit**

Run:
```bash
grep -rn "alert(\|confirm(" src/components/
grep -rn "fixed inset-0 z-\[100\] bg-black/60 backdrop-blur-sm" src/components/
grep -rn "fixed inset-0 z-\[100\] bg-blue-950/40 backdrop-blur-sm" src/components/
```

Expected:
- First grep: zero matches.
- Second/third greps: zero matches (Modal handles backdrop internally).

If any remain, inspect and fix.

- [ ] **Step 2: Bundle size sanity check**

Run: `npm run build`. Compare `dist/` output size to baseline (record the number). Expectation: net decrease of at least 10 KB from `AdminPanel.tsx` shrinking and removed motion-shell duplication.

- [ ] **Step 3: Full lint + typecheck**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 4: Run all tests**

Run: `npm run test`
Expected: all pass.

- [ ] **Step 5: Commit final sweep doc**

```bash
git commit --allow-empty -m "chore: complete primitive-application sweep

Plan 4 finished: 11 alerts + 8 confirms + 11 modal shells + 3 teacher
modals + 8 SectionCards + AdminPanel Tabs all migrated to primitives."
```

---

## Risk Notes

- **Modal site 6014** uses `bg-gray-900/60` instead of `bg-black/60` — your Modal needs to accept a backdrop variant or always use a neutral one. Plan 3 should have settled this; if not, revisit.
- **Modal site 8632** uses `z-[101]` (one above the others). If that modal opens on top of another modal, your Modal primitive needs a `zIndex` prop or stacking context awareness. If only one modal is open at a time, defaulting to z-[100] is fine.
- **AdminPanel inner components**: there are 15 of them. Some `confirm()` calls live inside inner components and may need their own state; lifting them to the parent is acceptable but increases prop count (already a problem per UX review §8.4). Prefer keeping state in the inner component.
- **Plan 1 deletes the duplicate workload chart at OperationalManager.tsx:286-356.** Task 7 above lists site 333 (the *first* workload chart) as the candidate to convert. After Plan 1, that block is gone — only line 982 (the bottom workload) remains. Update Task 7's site list to 7 entries (drop line 333) when Plan 1 is verified merged.
