# Design Tokens & Typography Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define design tokens once in `index.css`, enforce a 12px minimum body size, restrict `font-black uppercase tracking-widest` to specific roles, normalize border-radius. Net effect: legible typography, predictable visual rhythm, single source for status colors.

**Architecture:** Tailwind v4 `@theme` block as the single source of truth. Class-level changes via grep+sed bulk replace, with manual reconciliation for non-mechanical cases. New `src/styles/STATUS_COLORS.md` documents semantic mapping.

**Tech Stack:** Tailwind CSS v4 (`@tailwindcss/vite`), Vite 6.

---

## Confirmed counts (from grep at plan-write time)

| Metric | Count |
|---|---:|
| `text-[8px]` / `text-[9px]` / `text-[10px]` in `AdminPanel.tsx` | 273 |
| Same in `OperationalManager.tsx` | 79 |
| Same in `TeacherDashboard.tsx` | 25 |
| Same in `WebmasterPanel.tsx` | 12 |
| Same in `App.tsx` | 3 |
| Same in `Login.tsx` | 3 |
| **Total sub-12px instances** | **395** |
| `rounded-[…]` arbitrary radius literals (TeacherDashboard / Login / AdminPanel) | 1 / 1 / 12 |
| `font-mono` / `JetBrains` references (incl. `index.css` 2 lines) | 27 (24 in src code) |

Note: review §1 reported 273 sub-11px instances — that count was AdminPanel-only. Repo-wide is 395.

---

## Task 1: Extend `@theme` with radius, spacing, and typography tokens

**Files:**
- Modify: `src/index.css:4-15`

- [ ] **Step 1: Read current `index.css`**

Open `src/index.css` and confirm the current `@theme` block (lines 4-15) defines only colors and fonts.

- [ ] **Step 2: Add radius, spacing, and font-size tokens**

Replace lines 4-15 with this block (preserve the existing color tokens, append new ones):

```css
@theme {
  --font-sans: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;

  /* Brand colors */
  --color-curro-blue: #00468B;
  --color-curro-red: #E31B23;
  --color-bg-gray: #F4F7F9;
  --color-text-dark: #1A1A1A;
  --color-text-muted: #666666;
  --color-status-green: #28A745;
  --color-status-yellow: #FFC107;

  /* Semantic status (Task 6 references these) */
  --color-success: #28A745;
  --color-success-soft: #DCFCE7;
  --color-warning: #FFC107;
  --color-warning-soft: #FEF3C7;
  --color-danger: #E31B23;
  --color-danger-soft: #FEE2E2;
  --color-info: #00468B;
  --color-info-soft: #DBEAFE;

  /* Border radius scale */
  --radius-chip: 0.5rem;     /* 8px  — pills, badges, small chips */
  --radius-button: 0.75rem;  /* 12px — buttons, inputs */
  --radius-card: 1rem;       /* 16px — section cards, list items */
  --radius-modal: 1.5rem;    /* 24px — modals, hero panels */
  --radius-pill: 9999px;     /* fully rounded */

  /* Font size scale — 12px floor, no smaller body text allowed */
  --text-xs: 0.75rem;     /* 12px — minimum body, label, table cell */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
}
```

Tailwind v4 picks these up automatically:
- `--radius-card` → `rounded-card`, `rounded-card-sm`, etc.
- `--text-xs` overrides the default `text-xs` value (still 12px = same as Tailwind default; this just makes it our token).
- `--color-success` → `bg-success`, `text-success`, etc.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build completes without `Unknown utility class` errors. If any complain, fix the @theme syntax (spaces, semicolons).

- [ ] **Step 4: Smoke check in dev**

Run: `npm run dev` and open the app at http://localhost:3000. Open DevTools and inspect any element using `text-xs` — confirm the computed font-size is `12px`. Render a throwaway `<div className="rounded-card bg-success p-4">test</div>` somewhere temporarily, confirm visually, then remove.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add radius, spacing, status color, and font-size tokens to @theme"
```

---

## Task 2: Cap minimum text size at 12px

**Files:**
- Modify: `src/components/AdminPanel.tsx` (273 sites)
- Modify: `src/components/OperationalManager.tsx` (79 sites)
- Modify: `src/components/TeacherDashboard.tsx` (25 sites)
- Modify: `src/components/WebmasterPanel.tsx` (12 sites)
- Modify: `src/App.tsx` (3 sites)
- Modify: `src/components/Login.tsx` (3 sites)

Total: 395 instances.

- [ ] **Step 1: Inventory the exact sites**

Run:

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]" \
  src/App.tsx \
  src/components/AdminPanel.tsx \
  src/components/OperationalManager.tsx \
  src/components/TeacherDashboard.tsx \
  src/components/WebmasterPanel.tsx \
  src/components/Login.tsx \
  > /tmp/sub12-sites.txt
wc -l /tmp/sub12-sites.txt   # expect 395
```

Save the output for review.

- [ ] **Step 2: Bulk replace with sed (in-place, all six files)**

Replace `text-[10px]` with `text-xs` first (this is the safe majority case):

```bash
for f in \
  src/App.tsx \
  src/components/AdminPanel.tsx \
  src/components/OperationalManager.tsx \
  src/components/TeacherDashboard.tsx \
  src/components/WebmasterPanel.tsx \
  src/components/Login.tsx; do
  sed -i 's/text-\[10px\]/text-xs/g' "$f"
done
```

Run lint and dev server immediately after this step (Step 3) before doing the 8/9px replacements — those are the visually-critical "table density" sites that may need `text-[11px]` not `text-xs`.

- [ ] **Step 3: Run typecheck and dev server smoke test**

```bash
npm run lint
```

Expected: 0 errors (the lint script is the one introduced in Plan 1).

Then:

```bash
npm run dev
```

Click through Admin → Faculty list, OperationalManager → Leave Records, Webmaster → faculty table. Confirm no overflow / wrapping regressions. If you see one, note the file:line and bump that single site to `text-[11px]` manually before continuing.

- [ ] **Step 4: Replace `text-[8px]` and `text-[9px]` with `text-[11px]`**

These instances are deliberately tiny (e.g. badges inside table cells like `OperationalManager.tsx:551, 875, 880, 885`). Bumping them to 11px is the minimum-acceptable compromise — `text-xs` (12px) sometimes overflows in the cramped contexts.

```bash
for f in \
  src/components/AdminPanel.tsx \
  src/components/OperationalManager.tsx \
  src/components/TeacherDashboard.tsx \
  src/components/WebmasterPanel.tsx; do
  sed -i 's/text-\[8px\]/text-[11px]/g; s/text-\[9px\]/text-[11px]/g' "$f"
done
```

- [ ] **Step 5: Verify zero sub-11px text remains**

```bash
grep -rn "text-\[8px\]\|text-\[9px\]\|text-\[10px\]" src/
```

Expected: no output. If any remain, hand-edit them.

- [ ] **Step 6: Show before/after for representative sites**

These are the four most visible call sites. Confirm by reading the file that they have flipped:

| File:line | Before | After |
|---|---|---|
| `AdminPanel.tsx:2090` | `text-[10px] font-black text-text-muted uppercase tracking-widest` | `text-xs font-black text-text-muted uppercase tracking-widest` |
| `OperationalManager.tsx:548` | `text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter` | `text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-tighter` |
| `OperationalManager.tsx:551` | `bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full` | `bg-blue-600 text-white text-[11px] px-1.5 py-0.5 rounded-full` |
| `OperationalManager.tsx:875,880,885` | `text-[8px] font-black uppercase tracking-tighter` | `text-[11px] font-black uppercase tracking-tighter` |

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "refactor(typography): cap minimum text size at 11-12px (395 sites)"
```

---

## Task 3: Restrict `font-black uppercase tracking-widest` to nav + primary stats

**Files:**
- Modify: `src/components/AdminPanel.tsx` (most affected)
- Modify: `src/components/OperationalManager.tsx`
- Modify: `src/components/TeacherDashboard.tsx`
- Modify: `src/components/WebmasterPanel.tsx`
- Modify: `src/components/Login.tsx`
- Keep unchanged: `src/App.tsx:267` (role nav buttons), `src/App.tsx:251` ("Invigilation" subtitle)

The "shouty" combo `font-black uppercase tracking-widest` on small text is everywhere; this task strips it from form labels, table cells, and status pills, keeping it only on:

1. Top role-nav buttons (`App.tsx:267`)
2. Primary stat headers in Admin and Webmaster (the `text-2xl font-black tracking-tighter` cards stay; only the secondary `text-[10px]…` labels above stats lose the combo)
3. Modal/section titles (where it acts as the H2)

Replacement rule: drop `font-black uppercase tracking-widest`. If hierarchy is needed, leave `font-bold` (or keep `font-black` solo for headers) and use color contrast (`text-text-dark` vs `text-text-muted`) instead.

- [ ] **Step 1: Inventory sites**

Run:

```bash
grep -rn "font-black uppercase tracking-widest\|font-black tracking-widest uppercase\|uppercase font-black tracking-widest\|uppercase tracking-widest font-black\|tracking-widest font-black uppercase\|tracking-widest uppercase font-black" \
  src/App.tsx src/components/ > /tmp/shouty-sites.txt
wc -l /tmp/shouty-sites.txt
```

Note the count. Reviewer reports the pattern is on ~273 sites in AdminPanel alone, but many are co-occurring with the small-text replacement done in Task 2.

- [ ] **Step 2: Define a sentinel comment for "keep" sites**

In each file, before bulk-stripping, mark the keep sites with a no-op marker. For each of these specific lines, add `/* keep-shouty */` as the very last item on the className (Tailwind ignores unknown class names but `clsx` would not — these files use string templates not `clsx`, so we'll instead just add a comment beside the line).

Mark these lines manually before the bulk replace (use Read + Edit per line):

- `src/App.tsx:251` (`Invigilation` subtitle)
- `src/App.tsx:267` (role nav button label classes — already line ~267)
- `src/components/AdminPanel.tsx:2094` (`text-2xl font-black text-text-dark tracking-tighter` — does not match the strip pattern; safe automatically)
- `src/components/AdminPanel.tsx:2106-2152` — the 7 tab buttons (`text-xs font-black uppercase tracking-widest`) — these match the strip pattern but should KEEP it. Plan 4 will replace these with `<TabButton>` anyway, so we'll defer this nuance to Plan 4 by listing these as "do not strip" in Step 4 below.

In practice, instead of marker comments, use the explicit-skip list in Step 4 of this task.

- [ ] **Step 3: Run sed replacement on the 6 files (excluding skip list)**

```bash
# Replace the canonical ordering only — most sites in this codebase use this exact ordering.
for f in \
  src/components/AdminPanel.tsx \
  src/components/OperationalManager.tsx \
  src/components/TeacherDashboard.tsx \
  src/components/WebmasterPanel.tsx \
  src/components/Login.tsx; do
  sed -i 's/ font-black uppercase tracking-widest//g' "$f"
done
```

This deletes the exact 33-character substring `' font-black uppercase tracking-widest'` from every className.

- [ ] **Step 4: Manually restore on KEEP sites**

After step 3, several sites will have lost classes they should retain. Restore them. Open each file and confirm the line still reads correctly; if a label or section title now looks too "soft," restore `font-black` alone (without `uppercase tracking-widest`).

KEEP the full `font-black uppercase tracking-widest` exactly here — re-add it manually if the sed step removed it:

- `src/App.tsx:251` (Invigilation subtitle in nav)
- `src/App.tsx:267` (role nav buttons)
- `src/components/AdminPanel.tsx:2106-2152` (the 7 tab buttons — Plan 4 will convert these to `<TabButton>` anyway, but during this Plan 7 step they should still compile and look correct)

For every other site, if the visual hierarchy now feels lost, add a single replacement: change the line to use `font-black` (alone, no uppercase / no tracking-widest) and keep the existing color/size.

- [ ] **Step 5: Build + click-through**

```bash
npm run lint && npm run build
npm run dev
```

Click through every panel:
- Login form (labels should now be normal-case body weight)
- Teacher dashboard (timetable list labels normal; period headings keep their weight)
- Admin (faculty list, subjects, scheduler — labels and small captions should not shout)
- OperationalManager (incident table column headers, status pills no longer all-caps; body remains readable)
- Webmaster (zinc-card titles unchanged in weight, label text below stats is no longer tiny-shouty)

Expected: visually calmer; hierarchy still readable because larger headings keep `font-black`.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "refactor(typography): restrict font-black uppercase tracking-widest to nav + stats only"
```

---

## Task 4: Normalize border-radius using new tokens

**Files:**
- Modify: `src/components/AdminPanel.tsx` (12 arbitrary radius sites)
- Modify: `src/components/Login.tsx` (1 site)
- Modify: `src/components/TeacherDashboard.tsx` (1 site)
- Modify: any `rounded-2xl` / `rounded-3xl` site that should now adopt a token

Confirmed sites of `rounded-[…]`:

| File | Line | Before | After |
|---|---:|---|---|
| `Login.tsx` | 21 | `rounded-[2rem]` (login card) | `rounded-modal` |
| `TeacherDashboard.tsx` | 535 | `rounded-[32px]` (help-request popup) | `rounded-modal` |
| `AdminPanel.tsx` | 2048 | `rounded-[32px]` (red hero stat card) | `rounded-modal` |
| `AdminPanel.tsx` | 2052 | `rounded-[24px]` (icon panel inside hero) | `rounded-modal` |
| `AdminPanel.tsx` | 6019 | `rounded-[32px]` (modal shell) | `rounded-modal` |
| `AdminPanel.tsx` | 7027 | `rounded-[40px]` (12-col layout container) | `rounded-modal` |
| `AdminPanel.tsx` | 7030 | `rounded-[32px]` (left col card) | `rounded-card` |
| `AdminPanel.tsx` | 7477 | `rounded-[32px]` (middle col card) | `rounded-card` |
| `AdminPanel.tsx` | 7712 | `rounded-[32px]` (right col card, dashed) | `rounded-card` |
| `AdminPanel.tsx` | 7862 | `rounded-[40px]` (full-bleed modal) | `rounded-modal` |
| `AdminPanel.tsx` | 7918 | `rounded-[2rem]` (panel inside modal) | `rounded-modal` |
| `AdminPanel.tsx` | 8004 | `rounded-[40px]` (modal shell) | `rounded-modal` |
| `AdminPanel.tsx` | 8517 | `rounded-[32px]` (sub-panel) | `rounded-card` |
| `AdminPanel.tsx` | 8637 | `rounded-[40px]` (modal shell) | `rounded-modal` |

- [ ] **Step 1: sed-replace arbitrary radius literals**

```bash
for f in \
  src/components/AdminPanel.tsx \
  src/components/TeacherDashboard.tsx \
  src/components/Login.tsx; do
  sed -i \
    -e 's/rounded-\[40px\]/rounded-modal/g' \
    -e 's/rounded-\[32px\]/rounded-modal/g' \
    -e 's/rounded-\[24px\]/rounded-modal/g' \
    -e 's/rounded-\[22px\]/rounded-card/g' \
    -e 's/rounded-\[2rem\]/rounded-modal/g' \
    "$f"
done
```

- [ ] **Step 2: Manually reconcile cards-vs-modal**

Open `AdminPanel.tsx:7030, 7477, 7712, 8517` and change `rounded-modal` → `rounded-card` (the table above asked for `card`, but the sed in Step 1 made everything `rounded-modal`). Use Edit on each line.

For `AdminPanel.tsx:8517`, the sub-panel inside an outer modal looks better at `rounded-card` (16px) than `rounded-modal` (24px).

- [ ] **Step 3: Verify zero arbitrary radii remain**

```bash
grep -rn "rounded-\[" src/
```

Expected: no output. If any leftover, hand-edit.

- [ ] **Step 4: Optional sweep — replace `rounded-3xl` on top-level containers with `rounded-modal`**

`rounded-3xl` (24px) is identical in size to `rounded-modal`. Replacing it isn't required for visual change but is helpful for semantic clarity. Skip this for now to keep the diff small; do it as a follow-up only if you want consistency in code review. (Mark as nice-to-have.)

- [ ] **Step 5: Build + smoke**

```bash
npm run lint && npm run build && npm run dev
```

Confirm: login card still rounded, modals still rounded, no visual regression.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "refactor(theme): normalize border-radius to --radius-card / --radius-modal tokens"
```

---

## Task 5: JetBrains Mono — KEEP (usage exceeds threshold)

**Decision (recorded here, no edit needed):** the grep returned 27 references including 24 actual uses (timetable times, workload tabular numbers, status durations). This exceeds the "drop if <5" threshold; mono provides real tabular-numeric clarity. **No change to the JetBrains Mono import.**

- [ ] **Step 1: Document the decision**

Open `src/index.css` and add this comment above the `--font-mono` line:

```css
  /* JetBrains Mono retained — 24 usages for tabular numerics (timetables, workloads, time ranges).
     If usage drops below ~10 sites, drop the @import to save ~50 KB webfont. */
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "docs(theme): record decision to retain JetBrains Mono (24 usages)"
```

---

## Task 6: Status color → meaning mapping doc + sweep

**Files:**
- Create: `src/styles/STATUS_COLORS.md`
- Modify: `src/components/OperationalManager.tsx` (lines 548-565, 870-893)
- Modify: `src/components/WebmasterPanel.tsx` (lines 154-155)
- Reference only (no edit unless blatant misuse): `src/components/AdminPanel.tsx`

The semantic tokens were introduced in Task 1. This task documents *which utility class to use for each meaning*, then sweeps the most obvious ad-hoc usages. **Do NOT replace decorative colors** (e.g. SectionCard variant tints in Plan 3 — those are not status, they are categorization).

- [ ] **Step 1: Create the mapping document**

Create `src/styles/STATUS_COLORS.md` with:

```markdown
# Status Color Mapping

Tailwind v4 utility classes that map to a single meaning. Use these for *state* colors only (approval, severity, error). For decorative or categorical colors, use the Tailwind palette directly (`bg-emerald-500`, `bg-purple-100`, etc.) and document the intent inline.

| Meaning   | Background (strong) | Background (soft)        | Text             | Border          |
|-----------|---------------------|--------------------------|------------------|-----------------|
| Success   | `bg-success`        | `bg-success-soft`        | `text-success`   | `border-success`   |
| Warning   | `bg-warning`        | `bg-warning-soft`        | `text-warning`   | `border-warning`   |
| Danger    | `bg-danger`         | `bg-danger-soft`         | `text-danger`    | `border-danger`    |
| Info      | `bg-info`           | `bg-info-soft`           | `text-info`      | `border-info`      |

## Usage rules

- **Status pills**: soft bg + strong text → `bg-success-soft text-success`.
- **Status icons** (lucide): use `text-success` / `text-danger` / `text-warning`.
- **Filled action buttons** (e.g. confirm-destructive): `bg-danger text-white`.
- **NEVER** use `bg-emerald-*` / `bg-amber-*` / `bg-red-*` / `bg-blue-*` for status. Reserve those for decorative or categorical use.

## Approval / leave / extension status mapping

| Status     | Class set                         |
|------------|-----------------------------------|
| APPROVED   | `bg-success-soft text-success`    |
| DENIED     | `bg-danger-soft text-danger`      |
| PENDING    | `bg-warning-soft text-warning`    |
| INFO       | `bg-info-soft text-info`          |

Reference: `OperationalManager.tsx:872-892` (extension status icons), `OperationalManager.tsx:548-565` (leave status pills).
```

- [ ] **Step 2: Sweep `OperationalManager.tsx` extension-status pills (lines 872-892)**

Edit `src/components/OperationalManager.tsx` lines 872-892. Replace the three blocks:

Before (`OperationalManager.tsx:872-877`):
```tsx
<div className="flex flex-col items-center gap-1 text-emerald-600" title="Approved">
  <ShieldCheck className="w-5 h-5 shadow-sm" />
  <span className="text-[11px] font-black uppercase tracking-tighter">Approved</span>
</div>
```

After:
```tsx
<div className="flex flex-col items-center gap-1 text-success" title="Approved">
  <ShieldCheck className="w-5 h-5 shadow-sm" />
  <span className="text-[11px] font-black uppercase tracking-tighter">Approved</span>
</div>
```

Same pattern for `text-red-600` → `text-danger`, `text-amber-500` → `text-warning`.

(Note: line numbers reflect post-Task 2/3 state — sed shifts may move them ±1; grep `"Approved"\|"Denied"\|"Pending"` to find each.)

- [ ] **Step 3: Sweep `OperationalManager.tsx:554-555` leave-day pill**

Before:
```tsx
<span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${req.isFullDay ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
```

This is **not** status — it is a category (full-day vs partial). Leave the purple/gray as-is per the "do not replace decorative" rule. Add an inline `// decorative — see STATUS_COLORS.md` comment above the line.

- [ ] **Step 4: Sweep `WebmasterPanel.tsx:154-155` health-status fill**

Before:
```tsx
className={`text-xs font-black px-3 py-1 rounded-full ${
  s.status === 'OK' 
    ? 'bg-emerald-500/10 text-emerald-500' 
    : 'bg-amber-500/10 text-amber-500'
}`}
```

After:
```tsx
className={`text-xs font-black px-3 py-1 rounded-full ${
  s.status === 'OK' 
    ? 'bg-success-soft text-success' 
    : 'bg-warning-soft text-warning'
}`}
```

- [ ] **Step 5: Audit AdminPanel for obvious status sites and leave a TODO if any are found**

Run:

```bash
grep -n "bg-emerald-50\|bg-emerald-100\|bg-red-50\|bg-red-100\|bg-amber-50\|bg-amber-100" src/components/AdminPanel.tsx
```

If any line is clearly a status pill (color carries APPROVED/DENIED meaning), replace it. Otherwise, leave a one-line comment `// see STATUS_COLORS.md — decorative, not status` and move on. Do not chase decorative color through the entire 8,715-line file in this plan; that's a Plan 9 follow-up.

- [ ] **Step 6: Build + smoke**

```bash
npm run lint && npm run build && npm run dev
```

Click OperationalManager → marking extensions and leave records. Confirm the colors still read correctly: emerald-ish for approved, red-ish for denied, amber-ish for pending. Webmaster: health pills should still be clearly green/amber.

- [ ] **Step 7: Commit**

```bash
git add src/styles/STATUS_COLORS.md src/components/
git commit -m "feat(theme): add STATUS_COLORS mapping doc and sweep status pills"
```

---

## Task 7: Snapshot tests for token usage (optional)

**Files:**
- Create: `src/styles/__tests__/tokens.test.ts` (optional, only if Plan 3 has shipped)

This task is optional and depends on Plan 3 (`<SectionCard>`) having shipped.

- [ ] **Step 1 (optional): write a snapshot test for SectionCard variants**

```ts
import { render } from '@testing-library/react';
import { SectionCard } from '../../components/ui/SectionCard';

describe('SectionCard tokens', () => {
  test.each(['emerald', 'red', 'blue', 'amber', 'zinc'] as const)(
    '%s variant renders with correct radius and background',
    (variant) => {
      const { container } = render(
        <SectionCard variant={variant} title="Test">body</SectionCard>
      );
      expect(container.firstChild).toMatchSnapshot();
    }
  );
});
```

- [ ] **Step 2 (optional): run test**

```bash
npm test -- src/styles/__tests__/tokens.test.ts
```

If Plan 3 has not shipped, skip this task entirely and note it as a follow-up.

---

## Self-Review Checklist (perform before signing off)

- [ ] Read `src/index.css` end-to-end. Confirm tokens compile (no `Unknown utility class` errors during `npm run build`).
- [ ] `grep -rn "text-\[8px\]\|text-\[9px\]\|text-\[10px\]" src/` returns nothing.
- [ ] `grep -rn "rounded-\[" src/` returns nothing.
- [ ] Login, Teacher, Admin (each tab), Operations, Webmaster panels all render without visible regression. Note: there is no automated visual regression test; the user must manually click through each panel. Recommend running through all five role views before merging.
- [ ] All commits land cleanly; `npm run lint && npm run build` exits 0.

## Cross-plan notes

- This plan **assumes Plan 1 has shipped** (real `lint` script).
- Task 2 conflicts with Plan 4 step that converts AdminPanel tab buttons to `<TabButton>` — coordinate ordering. Recommended ordering: Plan 7 Task 2-3 first, then Plan 4 picks up the already-cleaned classes when wrapping in `<TabButton>`.
- Task 6 references `<SectionCard>` from Plan 3. Status sweeps for AdminPanel are deferred until both Plan 3 and Plan 9 have shipped.
- After landing this plan, Plan 8 (Motion & ARIA) can land in parallel; they don't conflict.
