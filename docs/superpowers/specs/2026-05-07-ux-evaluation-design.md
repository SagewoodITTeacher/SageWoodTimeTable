# Curro Invigilation Scheduler — UX Evaluation (Component Scorecards)

Date: 2026-05-07. Method: static source-code review against current codebase. Scores are 1-5 per dimension.

---

## Scoring Dimensions

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Visual & Layout** | Broken contrast, no responsive, no brand system | Mostly consistent, some gaps | Cohesive design system, responsive, accessible typography |
| **Interaction & a11y** | No ARIA, no keyboard, no focus mgmt, native dialogs | Partial ARIA, some keyboard, shared primitives | Full ARIA, focus trap, keyboard nav, form validation |
| **Performance** | No splitting, all listeners on load, no lazy | Partial splitting, some lazy | Fully split, per-panel listeners, lazy charts |
| **Code Quality** | God file, no types, massive duplication | Some decomposition, few any | Well-decomposed, strict types, shared primitives |

---

## 1. Login (`Login.tsx`, 283 lines)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **4** | Clean centered card, consistent brand colors, good spacing. Border radius `rounded-[2rem]` is bespoke but consistent within this file. Gradient background is tasteful. |
| Interaction & a11y | **3** | `role="alert"` on error banner (line 102). No `htmlFor`/`id` on label/input pairs. No `autoComplete` on email/password inputs. No `autoFocus` on email field. Google sign-in button has no `aria-label` beyond visible text. Email-link confirm field has `autoFocus` (line 142) — good. |
| Performance | **5** | Tiny component, no heavy deps, loads only when unauthenticated. |
| Code Quality | **4** | Clean TypeScript, real Firebase Auth (Google, email link, password), proper error handling. No `: any`. |

**Top 3 findings:**
1. No `htmlFor`/`id` on any label/input — password managers won't work, screen readers can't associate labels
2. No `autoComplete` attributes — browsers can't autofill email/password
3. `text-[10px] text-gray-400` labels (line 269) fail WCAG AA contrast (~2.85:1 on white)

---

## 2. TeacherDashboard (`TeacherDashboard.tsx`, 772 lines)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **3** | Good mobile-first card layout. 15 sub-11px text instances. 27 `font-black uppercase` instances destroy hierarchy. Only 1 responsive breakpoint (`md:-mx-8`). No desktop-up adaptation. |
| Interaction & a11y | **2** | Uses shared `<Modal>` (good). `role="alert"` on form errors (lines 596, 672). No `htmlFor`/`id` on 4 label/input pairs. No `autoComplete`. No `autoFocus` on modal fields. SOS button has identical styling to "Toiletpaper required" — critical safety concern. Standby notification popup (lines 536-590) is hand-rolled, not `<Modal>` — no focus trap, no `role="dialog"`. No `prefers-reduced-motion`. |
| Performance | **4** | Code-split via `React.lazy` in App.tsx. Audio self-hosted (`/sounds/help-alert.mp3`). Firestore listeners scoped to this component. `motion` library imported but moderate usage. |
| Code Quality | **3** | 2 `@ts-ignore` (lines 444, 515). Inline `CheckCircle2` SVG redefinition (lines 753-771) — already imported from lucide-react. Leave form defaults to "Sick Leave" without placeholder prompt. No partial-day leave UI despite type supporting it. |

**Top 3 findings:**
1. SOS button (line 600) styled identically to mundane options — an invigilator under stress will mis-tap. Needs visual separation (red background, separator, distinct section)
2. Standby notification popup (lines 536-590) bypasses shared `<Modal>` — no focus trap, no `role="dialog"`, no `aria-modal`, no Escape handling
3. Zero `htmlFor`/`id` on any label/input pair — screen readers cannot associate labels, password managers won't work

---

## 3. OperationalManager (`OperationalManager.tsx`, 1,100 lines)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **2** | 70 sub-11px text instances. 27 `font-black uppercase` instances. Only 4 responsive breakpoints. One giant scroll with 7 sections and no in-page navigation. Tables overflow on narrow screens with no column priority hints. |
| Interaction & a11y | **2** | Uses `<SectionCard>` (good). Zero `aria-`/`role=` attributes. Zero `htmlFor`/`id`. Request modal (lines 937-1009) is hand-rolled — no focus trap, no `role="dialog"`, no Escape handling. No `prefers-reduced-motion`. Status pills use color-only indicators (green/red/amber) without consistent icons. |
| Performance | **3** | Code-split via lazy. `WorkloadChart` lazy-loaded. But all Firestore listeners start on mount regardless of which sections are visible. |
| Code Quality | **2** | 10 hardcoded staff IDs (APPROVERS, specialist lists). `PUBLIC_HOLIDAYS` hardcoded for 2026. Workload logic duplicated from WebmasterPanel (different specialist IDs). Inline `RefreshCw` SVG redefinition (lines 1080-1100). `RequestCard` component defined in same file. |

**Top 3 findings:**
1. Request modal (lines 937-1009) is hand-rolled with `AnimatePresence` — must migrate to shared `<Modal>` for a11y compliance (focus trap, Escape, `role="dialog"`)
2. One giant scroll with no in-page navigation — 7 sections stacked vertically with no tabs, anchors, or jump links. Users must scroll through all sections to reach any one
3. 10 hardcoded staff IDs and `PUBLIC_HOLIDAYS` — onboarding/offboarding and year rollover require code changes

---

## 4. AdminPanel (`AdminPanel.tsx`, 9,064 lines)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **1** | 119 sub-11px text instances (20 at 8px, 27 at 9px, 72 at 10px). 170 `font-black uppercase` (64 with `tracking-widest`). Inconsistent border radius. Brand colors mixed with ad-hoc Tailwind colors. Only 30 responsive utilities across 9K lines. |
| Interaction & a11y | **3** | All 10 modals use shared `<Modal>` (good — focus trap, Escape, `role="dialog"`). 16 `aria-`/`role=` attributes (mostly on action buttons). Only 1 `htmlFor`/`id` pair out of dozens of inputs. No `autoFocus` on modal first fields. No `prefers-reduced-motion`. One modal explicitly opts out of Escape dismiss (`dismissOnEscape={false}`, line 8269). |
| Performance | **2** | Code-split via lazy in App.tsx, but the chunk is still ~400 KB source. 74 `useState` hooks. Recharts loaded in this chunk. All Firestore listeners start on mount. No virtualization for faculty list. |
| Code Quality | **1** | 9,064 lines in a single file. 17 sibling components. 74 `useState` hooks. 7 `: any` types. Workload logic triplicated (also in OperationalManager and WebmasterPanel). No decomposition despite shared primitives existing. |

**Top 3 findings:**
1. 9,064-line god file with 17 components — unmaintainable, untestable, ships entirely on first load. Must decompose into separate files per component
2. 119 sub-11px text instances — fails WCAG 1.4.4 practical legibility, destroys visual hierarchy. Cap minimum at 12px
3. Only 1 `htmlFor`/`id` pair across dozens of inputs — screen readers cannot associate labels with inputs

---

## 5. WebmasterPanel (`WebmasterPanel.tsx`, 269 lines)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **3** | Dark theme (`bg-zinc-950`) wrapper added — contrast is now legible. Consistent card style. But it's a "hacker mode" trope disconnected from the rest of the app's light theme. No `prefers-color-scheme`. |
| Interaction & a11y | **2** | Zero `aria-`/`role=` attributes. No `htmlFor`/`id`. Charts have no `aria-label` or text alternatives. Pie chart has no percentage labels. No `prefers-reduced-motion`. |
| Performance | **4** | Small component, code-split, charts lazy-loaded. |
| Code Quality | **2** | Fake static stats (Server Load 12%, API Latency 45ms — lines 124-129). Non-functional toggles (lines 195-209). Workload logic duplicated from OperationalManager with different specialist IDs. Role distribution pie counts overlapping roles separately (misleading). |

**Top 3 findings:**
1. Fake stats and non-functional toggles — teaches the operator the dashboard lies. Remove or wire to real Firebase Performance data
2. Zero ARIA attributes — charts are invisible to screen readers, no `aria-label` on any interactive element
3. Workload logic duplicated with different hardcoded specialist IDs from OperationalManager — extract to `src/lib/workload.ts`

---

## 6. Shared UI Primitives (`src/components/ui/`)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **4** | Consistent brand colors, clean design. `SectionCard` subtitle uses `text-[11px]` (borderline small). |
| Interaction & a11y | **4** | `Modal`: focus trap, Escape handling, `role="dialog"`, `aria-modal`, `aria-labelledby`, focus restore on close, `autoFocus` to first focusable. `Toast`: `role="alert"`/`role="status"`, dismiss button with `aria-label`. `Tabs`: `role="tablist"`, `role="tab"`, `aria-selected`, arrow-key navigation (Home/End/Left/Right). `ConfirmDialog`: typed confirmation for destructive actions, proper `htmlFor`/`id` on confirmation input. |
| Performance | **5** | Lightweight, no heavy deps, portal-based rendering. |
| Code Quality | **5** | Clean TypeScript, proper generic types, `cn()` utility, well-documented interfaces. |

**Top 3 findings:**
1. `SectionCard` subtitle at `text-[11px]` (line 90) — borderline too small, especially with `font-black uppercase tracking-widest`
2. `TabButton` uses `font-black uppercase tracking-widest` (line 140) — consistent with app style but contributes to the "everything is loud" problem
3. Not adopted everywhere — OperationalManager still has a hand-rolled modal, TeacherDashboard has a hand-rolled notification popup

---

## 7. App Shell (`App.tsx` + `FirebaseContext.tsx` + routing)

| Dimension | Score | Notes |
|---|---|---|
| Visual & Layout | **3** | Role switcher in top nav works. Webmaster mode flips to dark nav. `text-[10px]` role labels. No URL routing — refresh loses state, no deep links. |
| Interaction & a11y | **2** | Role switcher is `<div>` of `<button>`s — should be `role="tablist"` with `role="tab"`, `aria-selected`, arrow-key navigation. Icon-only buttons on narrow screens lack `aria-label`. No skip-nav link. |
| Performance | **3** | Code-splitting via `React.lazy` + `Suspense` (good). But all Firestore listeners start on app load regardless of which panel is opened. Global `teachers` listener is appropriate; `subjects`, `dayPeriodConfigs`, `markingExtensions`, `venues` listeners should be panel-scoped. |
| Code Quality | **3** | Real Firebase Auth via `FirebaseContext.tsx` (good). Firestore rules tightened with `hasRole()` checks (good). `SUPER_ADMINS` still hardcoded in App.tsx. No URL routing. `wideLayout` state persisted to localStorage (good pattern). |

**Top 3 findings:**
1. No URL routing — tabs, selected dates, and role are lost on refresh. Cannot deep-link or share specific views
2. Role switcher lacks `role="tablist"`/`role="tab"` semantics and arrow-key navigation
3. Firestore listeners for admin-only data (`subjects`, `dayPeriodConfigs`, `venues`) start on teacher sessions — wastes bandwidth and Firestore reads

---

## Cross-Component Summary

### Overall Scores (simple average of 4 dimensions, rounded to 1 decimal)

| Component | Visual | Interaction | Performance | Code Quality | Weighted Avg |
|---|---|---|---|---|---|
| Login | 4 | 3 | 5 | 4 | **4.0** |
| TeacherDashboard | 3 | 2 | 4 | 3 | **3.0** |
| OperationalManager | 2 | 2 | 3 | 2 | **2.3** |
| AdminPanel | 1 | 3 | 2 | 1 | **1.8** |
| WebmasterPanel | 3 | 2 | 4 | 2 | **2.8** |
| Shared UI | 4 | 4 | 5 | 5 | **4.5** |
| App Shell | 3 | 2 | 3 | 3 | **2.8** |

### Highest-Impact Fixes (cross-component)

| # | Fix | Components | Effort | Impact |
|---|---|---|---|---|
| 1 | Decompose AdminPanel.tsx into separate files per component | AdminPanel | L | High |
| 2 | Cap minimum text at 12px, reserve `font-black uppercase` for ≤3 roles | All | M | High |
| 3 | Add `htmlFor`/`id` to every label/input pair + `autoComplete` on Login | All | S | High |
| 4 | Migrate OperationalManager hand-rolled modal to shared `<Modal>` | OperationalManager | S | High |
| 5 | Migrate TeacherDashboard notification popup to shared `<Modal>` | TeacherDashboard | S | High |
| 6 | Visually separate SOS from mundane help options | TeacherDashboard | S | High |
| 7 | Add `prefers-reduced-motion` support globally | All | S | Med |
| 8 | Add in-page navigation to OperationalManager (tabs or anchor links) | OperationalManager | M | Med |
| 9 | Extract workload logic to `src/lib/workload.ts` | AdminPanel, OperationalManager, WebmasterPanel | S | Med |
| 10 | Move admin-only Firestore listeners into panel-scoped hooks | App Shell | M | Med |
| 11 | Add URL routing for tabs, dates, roles | App Shell | M | Med |
| 12 | Remove fake Webmaster stats or wire to real data | WebmasterPanel | S | Med |
| 13 | Move hardcoded staff IDs/holidays to Firestore config | OperationalManager, WebmasterPanel | M | Med |
| 14 | Add `role="tablist"`/`role="tab"` to App shell role switcher | App Shell | S | Low |

### Quick Wins (do first, <30 min each)

1. **#4** — Replace OperationalManager hand-rolled modal with `<Modal>` (one component swap)
2. **#5** — Replace TeacherDashboard notification popup with `<Modal>` (one component swap)
3. **#6** — Add red background + separator to SOS option in help modal
4. **#3** — Add `htmlFor`/`id` + `autoComplete` to Login form (5 attributes)
5. **#12** — Delete or clearly label fake Webmaster stats as "Demo"
