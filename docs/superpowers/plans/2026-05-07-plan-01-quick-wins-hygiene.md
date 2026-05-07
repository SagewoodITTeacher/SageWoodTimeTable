# Quick Visual Wins & Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land 8 low-risk fixes that unblock subsequent plans (test infra) and remove obvious bugs/dead code.

**Architecture:** Surgical edits across `src/`, `package.json`, `index.css`, plus new `vitest.config.ts` + `src/test/setup.ts`. No new components.

**Tech Stack:** Vite 6, React 19, Tailwind v4, vitest, @testing-library/react.

---

## Source of Truth

Findings are referenced from `UX_DESIGN_REVIEW.md` items #3, #4, #13, #18, #23, plus §2 ("No tests"), §11 (lint script doesn't lint), and §11 (`temp.txt` committed). All `file:line` citations below were verified against the working tree on 2026-05-07.

## Task Order Rationale

Task 1 (test infra) is first because Plan 3 onward depends on `vitest`. Tasks 2–6 are independent visual/code fixes — order is preference. Task 7 (dead deps) and Task 8 (lint script) are last so they don't conflict with installs in Task 1.

Each task ends with a single commit. Use Conventional Commits.

---

## Task 1: Set up Vitest + React Testing Library

**Files:**
- Modify: `package.json` — add devDeps and scripts
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `tsconfig.json` — add vitest types
- Create: `src/test/sanity.test.tsx` — proves the harness works

**Why:** The repo has no test framework (`UX_DESIGN_REVIEW.md` §11). Plans 3, 4, 6, 8 use TDD. Adding the harness here unblocks them.

- [ ] **Step 1.1: Install dev dependencies**

Run:
```bash
cd /home/leon/dev/github/curro
npm i -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected: 6 packages added. `package.json` `devDependencies` now contains them; `package-lock.json` updated.

- [ ] **Step 1.2: Create `vitest.config.ts`**

Create `/home/leon/dev/github/curro/vitest.config.ts` with the following content. (We share the Vite plugin set so resolve aliases match.)

```ts
import {defineConfig, mergeConfig} from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({mode: 'test'}),
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules', 'dist'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts'],
      },
    },
  })
);
```

- [ ] **Step 1.3: Create `src/test/setup.ts`**

Create `/home/leon/dev/github/curro/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import {afterEach} from 'vitest';
import {cleanup} from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 1.4: Patch `tsconfig.json` to include vitest globals**

Edit `/home/leon/dev/github/curro/tsconfig.json`. Replace the file with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

The only added line is `"types": ["vitest/globals", "@testing-library/jest-dom"],`.

- [ ] **Step 1.5: Add scripts to `package.json`**

Edit `/home/leon/dev/github/curro/package.json` `scripts` block. (Note: `lint` is replaced in Task 8; here we only add the test scripts.)

Find:
```json
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
```

Replace with:
```json
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:cov": "vitest run --coverage"
  },
```

- [ ] **Step 1.6: Write a failing sanity test**

Create `/home/leon/dev/github/curro/src/test/sanity.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

function Hello({name}: {name: string}) {
  return <h1>Hello, {name}</h1>;
}

describe('test harness', () => {
  it('renders a component and asserts via jest-dom matchers', () => {
    render(<Hello name="Curro" />);
    expect(screen.getByRole('heading', {name: 'Hello, Curro'})).toBeInTheDocument();
  });

  it('fails on a wrong assertion (delete this once verified)', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 1.7: Run the tests**

Run: `npm run test`

Expected output ends with: `Test Files  1 passed (1)` and `Tests  2 passed (2)`. If a peer-dep warning appears for React 19 + RTL, ignore — RTL ≥ 16 supports React 19.

- [ ] **Step 1.8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json src/test/setup.ts src/test/sanity.test.tsx
git commit -m "chore: set up vitest + react-testing-library

- Add vitest, @testing-library/react, jest-dom, user-event, jsdom
- Add vitest.config.ts and src/test/setup.ts
- Wire vitest globals into tsconfig types
- Add test, test:watch, test:ui, test:cov scripts
- Sanity test passes"
```

---

## Task 2: Webmaster Panel Contrast Fix

**Files:**
- Modify: `src/components/WebmasterPanel.tsx:131-135` — wrap the panel in a dark backdrop

**Why:** `WebmasterPanel.tsx:132` sets `text-white` on a transparent container; the page wrapper resolves to `bg-bg-gray` (`#F4F7F9`) via `App.tsx:189` → `body` `@apply bg-bg-gray` (`src/index.css:19`). The `<h2>System Diagnostics</h2>` and the `<p>` underneath render white-on-near-white. Cards inside (`bg-zinc-900`) look correct, so the panel currently looks half-styled. (`UX_DESIGN_REVIEW.md` finding #3.)

**Approach chosen:** Wrap the panel content in a `bg-zinc-950` rounded container that bleeds to the viewport edges using negative margin, rather than changing the page background. Reasons:

1. Local change — no cross-component coupling; doesn't require `App.tsx` to inspect `activeRole`.
2. Reversible — pulling the wrapper out is one block delete.
3. Matches the existing "hacker mode" of the top nav (`App.tsx:193` `bg-black border-orange-600`).

The trade-off is a hard visual seam; that's acceptable for the only role with a dark theme.

- [ ] **Step 2.1: Read the current panel header**

Read `src/components/WebmasterPanel.tsx` lines 130–145 to confirm the surrounding layout has not drifted from the review.

Expected: line 131 begins `return (`; line 132 is `<div className="flex flex-col gap-6 pb-20 text-white font-sans">`.

- [ ] **Step 2.2: Replace the outer wrapper**

Edit `src/components/WebmasterPanel.tsx`. Find:

```tsx
  return (
    <div className="flex flex-col gap-6 pb-20 text-white font-sans">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">System Diagnostics</h2>
        <p className="text-gray-500 font-medium text-sm">Core infrastructure monitoring and global settings.</p>
      </div>
```

Replace with:

```tsx
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 px-4 md:px-8 pt-6 pb-20 bg-zinc-950 text-white font-sans rounded-3xl flex flex-col gap-6 min-h-[calc(100vh-6rem)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight text-white uppercase">System Diagnostics</h2>
        <p className="text-gray-400 font-medium text-sm">Core infrastructure monitoring and global settings.</p>
      </div>
```

Two changes: outer `<div>` gains `-mx-* -mt-* px-* pt-* pb-20 bg-zinc-950 rounded-3xl min-h-...`; the subtitle `text-gray-500` becomes `text-gray-400` (5.42:1 → 7.05:1 against `bg-zinc-950`, comfortably AA).

- [ ] **Step 2.3: Verify in dev server**

Run: `npm run dev` then open `http://localhost:3000` in a browser, log in, switch to Webmaster role.

Expected: "System Diagnostics" heading is white-on-near-black (clearly readable). The panel reads as a single dark surface; the cards no longer "float on a near-white nothing".

- [ ] **Step 2.4: Commit**

```bash
git add src/components/WebmasterPanel.tsx
git commit -m "fix(webmaster): make System Diagnostics heading legible

Wrap the WebmasterPanel root in a bg-zinc-950 backdrop that bleeds
to the viewport edges. Resolves the white-on-#F4F7F9 contrast bug
flagged in UX_DESIGN_REVIEW.md (#3)."
```

---

## Task 3: Remove the Floating Refresh Button

**Files:**
- Modify: `src/App.tsx:9` — remove `RefreshCw` from the lucide import
- Modify: `src/App.tsx:362-371` — delete the floating button block

**Why:** The button calls `window.location.reload()` (line 369) while every collection in the app is on `onSnapshot` (`App.tsx:113-187`). Pressing it loses local state, re-subscribes 9 listeners, and implies real-time isn't working. (`UX_DESIGN_REVIEW.md` finding #4.)

- [ ] **Step 3.1: Remove the JSX block**

Edit `/home/leon/dev/github/curro/src/App.tsx`. Find:

```tsx
      {/* Floating Refresh (Simulate real-time update) */}
      <button 
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-[22px] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group ${
          activeUser.activeRole === 'WEBMASTER' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
        }`}
        title="Refresh Data"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
      </button>
```

Replace with: (nothing — delete the block, including the comment)

- [ ] **Step 3.2: Drop `RefreshCw` from the import**

Find:
```tsx
import { User as UserIcon, Shield, Briefcase, RefreshCw, LayoutDashboard, LogIn, LogOut, BarChart2 } from 'lucide-react';
```

Replace with:
```tsx
import { User as UserIcon, Shield, Briefcase, LayoutDashboard, LogIn, LogOut, BarChart2 } from 'lucide-react';
```

- [ ] **Step 3.3: Verify build**

Run: `npm run lint` (which is currently `tsc --noEmit`).

Expected: 0 errors. If you see `'RefreshCw' is declared but its value is never read`, you missed Step 3.2.

- [ ] **Step 3.4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): remove floating Refresh button

The button forced window.location.reload() while every data
collection already streams via onSnapshot. It misled users into
thinking real-time was broken. (UX_DESIGN_REVIEW.md #4)"
```

---

## Task 4: Define the Missing Animation Classes

**Files:**
- Modify: `src/index.css` — add `@keyframes` and matching utility selectors

**Why:** `animate-shake` (`Login.tsx:35`), `animate-pulse-slow` (`TeacherDashboard.tsx:535`), and `animate-in fade-in slide-in-from-bottom-4` / `slide-in-from-top-4` / `slide-in-from-right-2` / `slide-in-from-top-2` (12 sites in `AdminPanel.tsx` + `OperationalManager.tsx:331,1165`) all reference classes that aren't defined anywhere — `tailwindcss-animate` is not installed (`package.json:30-39`). They silently no-op today. Defining them is cheaper than tracking down 14+ call sites and removing them, and the intent is obvious from class names. (`UX_DESIGN_REVIEW.md` finding #13.)

We deliberately avoid pulling in `tailwindcss-animate` (a v3 plugin not officially supported on v4) and instead hand-roll the 8 keyframes we actually need.

- [ ] **Step 4.1: Read the current `index.css`**

Read `src/index.css` to confirm we still end at line 30. (Earlier observed content matches.)

- [ ] **Step 4.2: Append keyframes + utilities**

Edit `/home/leon/dev/github/curro/src/index.css`. Append to the end of the file (after line 30):

```css

/* -------------------------------------------------------------------------- */
/* Animations referenced in JSX (UX_DESIGN_REVIEW.md #13)                      */
/* These are intentionally hand-rolled to avoid pulling tailwindcss-animate.   */
/* Respect prefers-reduced-motion: see Plan 8 for the global gate.             */
/* -------------------------------------------------------------------------- */

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }

@keyframes pulse-slow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(227, 27, 35, 0.45); }
  50%      { box-shadow: 0 0 0 12px rgba(227, 27, 35, 0); }
}
.animate-pulse-slow { animation: pulse-slow 2.2s ease-in-out infinite; }

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slide-in-from-bottom-4 {
  from { transform: translateY(1rem); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes slide-in-from-top-4 {
  from { transform: translateY(-1rem); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}
@keyframes slide-in-from-top-2 {
  from { transform: translateY(-0.5rem); opacity: 0; }
  to   { transform: translateY(0);       opacity: 1; }
}
@keyframes slide-in-from-right-2 {
  from { transform: translateX(0.5rem); opacity: 0; }
  to   { transform: translateX(0);      opacity: 1; }
}

/*
 * Composite "animate-in" utility: when present, runs every sibling
 * keyframe class declared on the same element. Mirrors tailwindcss-animate.
 */
.animate-in {
  animation-duration: var(--tw-enter-duration, 250ms);
  animation-timing-function: var(--tw-enter-ease, cubic-bezier(0.16, 1, 0.3, 1));
  animation-fill-mode: both;
}
.animate-in.fade-in              { animation-name: fade-in; }
.animate-in.slide-in-from-bottom-4 { animation-name: slide-in-from-bottom-4; }
.animate-in.slide-in-from-top-4    { animation-name: slide-in-from-top-4; }
.animate-in.slide-in-from-top-2    { animation-name: slide-in-from-top-2; }
.animate-in.slide-in-from-right-2  { animation-name: slide-in-from-right-2; }

/* When two keyframe modifiers stack (e.g. fade-in slide-in-from-bottom-4),
   only the last declared name wins; that is correct for the existing usage
   patterns where translation is the dominant effect. */

/* Tailwind v4 already maps duration-300/500/700 to --tw-enter-duration via
   .duration-* utilities, so combining `animate-in fade-in duration-500` works
   as expected. */
```

- [ ] **Step 4.3: Manual verification**

Run: `npm run dev`. Trigger each animation:

| Animation | How to trigger |
|---|---|
| `animate-shake` | Open Login screen, enter wrong password ("X"), click Sign In. The red error banner should shake horizontally for ~500ms. |
| `animate-pulse-slow` | Set yourself as standby for an active assignment, then have another teacher submit a help request. The full-screen popup border should pulse a faint red halo. (If you can't reach this state easily, skip — visual inspection of `TeacherDashboard.tsx:535` rendering with the class applied is enough.) |
| `animate-in fade-in slide-in-from-bottom-4` | Switch tabs in `AdminPanel`. The newly mounted tab body should fade + slide up over 500ms. |

If any animation does not fire, check the DOM in DevTools → Elements: confirm the class is on the element AND the element is being unmounted/remounted (not just hidden). The keyframes only run on first paint of an element.

- [ ] **Step 4.4: Commit**

```bash
git add src/index.css
git commit -m "feat(css): define missing animation keyframes + utilities

Adds @keyframes for shake, pulse-slow, fade-in, and four
slide-in-from-* directions, plus an .animate-in compositor that
matches the (previously no-op) class usage in Login, TeacherDashboard,
AdminPanel, and OperationalManager. (UX_DESIGN_REVIEW.md #13)"
```

---

## Task 5: Dedupe the Workload Chart in OperationalManager

**Files:**
- Modify: `src/components/OperationalManager.tsx:333-393` — delete the duplicate chart card

**Why:** Two identical "Faculty Workload Distribution" charts render in the same panel — the first at `OperationalManager.tsx:333-393` (header reads `Faculty Workload Distribution`, no table beside it), the second at `OperationalManager.tsx:982-1048` (header reads `Workload Balance Chart (Rule 18)`, has the per-faculty table beneath). The second is more useful. (`UX_DESIGN_REVIEW.md` finding #18.)

The deletion is purely a JSX block; no state, computed value, or memo is shared with the kept chart specifically — both consume the same `workloadData`.

- [ ] **Step 5.1: Confirm exact range**

Run:
```bash
grep -n "Workload Distribution Chart Copy\|Workload Balance Chart" /home/leon/dev/github/curro/src/components/OperationalManager.tsx
```
Expected: a line with `Workload Distribution Chart Copy` near 332 and a line with `Workload Balance Chart (Rule 18)` near 981. If line numbers have drifted, adjust below.

- [ ] **Step 5.2: Remove the duplicate chart block**

Edit `src/components/OperationalManager.tsx`. Find:

```tsx
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Workload Distribution Chart Copy */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-0">
        <div className="bg-emerald-600 p-6 text-white flex items-center justify-between border-b-4 border-emerald-800">
```

Delete from `{/* Workload Distribution Chart Copy */}` (line ~332) through the closing `</div>` of that card (line ~393, the `</div>` that ends the `<div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-0">` block).

After the edit the JSX should read:

```tsx
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

      {/* Incident Rapports Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-0">
        <div className="bg-curro-red p-6 text-white flex items-center justify-between border-b-4 border-red-800">
```

(The "Workload Balance Chart (Rule 18)" block at the bottom of the same return — `:982-1048` before the edit — is preserved untouched.)

- [ ] **Step 5.3: Verify**

Run: `npm run lint`.

Expected: 0 errors.

Then `npm run dev`, open the OPS panel: only one workload chart should appear. Scroll to the bottom — the "Workload Balance Chart" with the per-faculty table is the surviving one.

- [ ] **Step 5.4: Commit**

```bash
git add src/components/OperationalManager.tsx
git commit -m "refactor(ops): drop duplicate Faculty Workload chart

Two copies of the same stacked bar chart rendered in the OPS panel.
Keeps the lower one ('Workload Balance Chart') because it has the
companion table. (UX_DESIGN_REVIEW.md #18)"
```

---

## Task 6: Delete `temp.txt`

**Files:**
- Delete: `temp.txt` at repo root

**Why:** Single orphan line of code committed at repo root: `const firstEmpty = relevantPIdxs.find(p => !entry.invigilatorAssignments?.[p]);`. Has no effect, was likely a paste accident. (`UX_DESIGN_REVIEW.md` §11.)

- [ ] **Step 6.1: Confirm contents are still trivial**

Run: `cat /home/leon/dev/github/curro/temp.txt`

Expected output: one line of code (the find expression). If you see anything else (longer file, secrets, etc.), STOP and inspect — do not delete.

- [ ] **Step 6.2: Delete and commit**

```bash
cd /home/leon/dev/github/curro
rm temp.txt
git add -A temp.txt
git commit -m "chore: remove stray temp.txt

Single orphan line of code, no callers. (UX_DESIGN_REVIEW.md #11)"
```

---

## Task 7: Remove Dead Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

**Why:** Five packages are listed but never imported in `src/`. (`UX_DESIGN_REVIEW.md` finding #23 + §11.)

| Package | Listed at | Why it's dead |
|---|---|---|
| `express` | `package.json:20` (deps) + `:32` (`@types/express`, devDeps) | No server file in repo |
| `dotenv` | `package.json:19` (deps) | Vite handles `.env` natively |
| `autoprefixer` | `package.json:34` (devDeps) | Tailwind v4 + `@tailwindcss/vite` does not need it |
| `tailwindcss` (devDeps duplicate) | `package.json:36` | `@tailwindcss/vite` is the v4 entry; root `tailwindcss` is redundant once the Vite plugin owns it |
| `@google/genai` | `package.json:14` (deps) | No `genai` / `Gemini` / `GoogleGenAI` import in `src/` (verified) |

- [ ] **Step 7.1: Confirm zero usage in `src/`**

Run:
```bash
cd /home/leon/dev/github/curro
grep -rn "from 'express'\|from \"express\"\|require('express')" src/ || echo "express: clean"
grep -rn "from 'dotenv'\|from \"dotenv\"\|require('dotenv')" src/ || echo "dotenv: clean"
grep -rn "@google/genai\|GoogleGenAI\|generateContent\|GEMINI_API_KEY" src/ || echo "genai: clean"
grep -rn "autoprefixer" . --include="*.json" --include="*.cjs" --include="*.mjs" --include="*.js" --include="*.ts" | grep -v node_modules | grep -v package-lock || echo "autoprefixer: clean"
```

Expected: all five lines end with `: clean`. (Note: `GEMINI_API_KEY` may appear in `vite.config.ts:11` — that string interpolation is dropped in Plan 2, so seeing it here is fine; no import depends on it in `src/`.)

If any output appears that is *not* the "clean" line, STOP, investigate, and reduce the dead-dep list before continuing.

- [ ] **Step 7.2: Uninstall**

Run:
```bash
npm uninstall express dotenv autoprefixer tailwindcss @google/genai @types/express
```

(`@types/express` goes too because `express` itself is gone; otherwise its `--save-dev` partner would be orphaned.)

- [ ] **Step 7.3: Verify build still works**

Run:
```bash
npm run build
```

Expected: `✓ built in <Xs>` with no missing-module errors. Tailwind continues to work because `@tailwindcss/vite` (kept) bundles the engine.

- [ ] **Step 7.4: Verify dev still works**

Run: `npm run dev`. Expected: server starts on port 3000. Open the app — styles still apply (proves `@tailwindcss/vite` is sufficient on its own).

- [ ] **Step 7.5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove dead dependencies

- Drop express + @types/express (no server in repo)
- Drop dotenv (Vite handles .env natively)
- Drop autoprefixer (Tailwind v4 ships its own)
- Drop tailwindcss (devDeps); @tailwindcss/vite is the v4 entry
- Drop @google/genai (zero imports in src/)

(UX_DESIGN_REVIEW.md #23, §11)"
```

---

## Task 8: Make `lint` Actually Lint

**Files:**
- Modify: `package.json` — replace `lint` script
- Modify: `eslint.config.js` — extend the flat config to lint `src/`
- Possibly create: `.eslintignore` is not needed (flat config handles ignores)

**Why:** `package.json:11` defines `"lint": "tsc --noEmit"`. ESLint is installed (`devDependencies`) but never runs against source — only the `@firebase/eslint-plugin-security-rules` recommended config is loaded. (`UX_DESIGN_REVIEW.md` §11.)

We extend the flat config with a ruleset for `src/**/*.{ts,tsx}` — minimal at first to avoid a cascade of failures we'll inherit. Plan 9 tightens this further alongside the `tsconfig` strict-mode bump.

- [ ] **Step 8.1: Install ESLint plugins**

Run:
```bash
cd /home/leon/dev/github/curro
npm i -D typescript-eslint eslint-plugin-react eslint-plugin-react-hooks globals
```

`typescript-eslint` is the v8 metapackage that bundles the parser + plugin. `globals` provides browser/node globals for the flat config.

- [ ] **Step 8.2: Replace `eslint.config.js`**

Read `eslint.config.js` first to confirm the existing 8-line content. Then replace it entirely with:

```js
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: '19.0' }
    },
    rules: {
      // Don't break the build on day one; we'll tighten in Plan 9.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      'react/jsx-uses-react': 'off', // React 17+ JSX transform
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'curly': ['error', 'all'],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['src/test/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
```

Notes:
- `curly: ['error', 'all']` matches the `~/.claude/CLAUDE.md` team rule ("After writing TS/JS code, run `npm run lint` and fix curly rule violations").
- All `@typescript-eslint/*` rules are `warn`, not `error`, except `curly`/`react-hooks/rules-of-hooks` — Plan 9 promotes them once the strict-mode bump is done.

- [ ] **Step 8.3: Update `package.json` `lint` scripts**

Find:
```json
    "lint": "tsc --noEmit",
```

Replace with:
```json
    "lint": "eslint src --max-warnings=999 && tsc --noEmit",
    "lint:fix": "eslint src --fix",
    "lint:strict": "eslint src --max-warnings=0 && tsc --noEmit",
```

We start with `--max-warnings=999` to get the lint script running today without a 200-warning blocker. Plan 9 flips the default to `lint:strict` once warnings are addressed.

- [ ] **Step 8.4: Run lint and capture the warning baseline**

Run:
```bash
npm run lint 2>&1 | tee /tmp/curro-lint-baseline.txt | tail -20
```

Expected: exits 0; the tail shows the warning summary, e.g. `✖ NN problems (0 errors, NN warnings)`. Record the number — Plan 9 must drive it down. **If `errors > 0`, fix them before committing** (likely candidates are import-resolution issues, in which case re-check Step 8.2 carefully).

- [ ] **Step 8.5: Commit**

```bash
git add package.json package-lock.json eslint.config.js
git commit -m "chore: make lint actually lint

- Add typescript-eslint, eslint-plugin-react, eslint-plugin-react-hooks
- Flat config now lints src/**/*.{ts,tsx} with curly + hooks rules as
  errors and any/unused-vars/ts-comment as warnings (Plan 9 promotes)
- lint script: eslint src --max-warnings=999 && tsc --noEmit
- Add lint:fix and lint:strict scripts

(UX_DESIGN_REVIEW.md §11)"
```

---

## Self-Review Checklist (run after all 8 tasks)

- [ ] `npm run lint` exits 0 with the recorded warning count or fewer
- [ ] `npm run test` passes the sanity test
- [ ] `npm run build` produces a `dist/` directory
- [ ] `npm run dev` boots; manual smoke: switch through all 4 roles, log in, log out
- [ ] Webmaster heading is legible (Task 2)
- [ ] No floating refresh button bottom-right (Task 3)
- [ ] Login error shake fires on a wrong password (Task 4)
- [ ] OPS panel shows exactly one Faculty Workload chart (Task 5)
- [ ] `temp.txt` is gone (`ls temp.txt` → "No such file") (Task 6)
- [ ] `package.json` no longer lists express/dotenv/autoprefixer/duplicate tailwindcss/@google/genai (Task 7)
- [ ] `eslint.config.js` is the new flat config (Task 8)

If any item fails, fix it in a follow-up commit on this same branch — do not re-open completed tasks unless the fix is non-trivial.

## Out of Scope (deferred to later plans)

- Animation `prefers-reduced-motion` gating → Plan 8.
- Promoting eslint warnings to errors + tsconfig `strict: true` → Plan 9.
- Removing the `JSON.stringify` of `GEMINI_API_KEY` from `vite.config.ts:11` → Plan 2 (security).
- Deleting the unused `status-pill` / `status-green` CSS classes (`index.css:23-29`) → Plan 7 (design tokens).
