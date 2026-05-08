# Curro Invigilation Scheduler — UX/UI & System Review

Reviewed: 2026-05-07. Reviewer: senior UX research / front-end review pass. Method: static source-code review (no browser, no runtime). Findings cite `file:line` for traceability.

---

## 1. Executive Summary

1. **`AdminPanel.tsx` is 8,715 lines / ~397 KB in a single file** with 15 nested function components (`AdminPanel.tsx:303, 3623, 3799, 3958, 4137, 4292, 4514, 4647, 4934, 5819, 5994, 6135, 7967, 8117, 8566`). It is unmaintainable, untestable, and ships entirely on first load.
2. **Webmaster panel has unreadable text on its own background.** The panel sets `text-white` on a transparent container (`WebmasterPanel.tsx:132`) but the page wrapper is `bg-bg-gray` (`App.tsx:189` resolves to `#F4F7F9`). The `<h2>System Diagnostics</h2>` and the section `<p>` will be white-on-near-white. Cards are dark (`bg-zinc-900`), so the page looks half-styled.
3. **Authentication is theatrical, not real.** `Login.tsx` collects email + password but `App.tsx:46-50` only checks `password === 'CURRO'` (a hardcoded shared password) and matches email by string comparison against the local teacher list. Firestore rules trust *any* signed-in (including anonymous, `FirebaseContext.tsx:23`) user as admin/webmaster (`firestore.rules:29-49`). The "role" UX is purely client-side; the rules give every visitor full DB write.
4. **`lint` script does not lint.** `package.json:11` defines `"lint": "tsc --noEmit"`. Eslint is installed but never runs on `src/`. Combined with `tsconfig.json` having no `"strict": true` and 14 `: any` / `@ts-ignore` instances in `AdminPanel.tsx`, type safety is weaker than the dependency list suggests.
5. **Animation classes referenced but never defined.** `animate-shake` (`Login.tsx:35`), `animate-pulse-slow` (`TeacherDashboard.tsx:535`), and `animate-in fade-in slide-in-from-bottom-4` (~12 usages across `AdminPanel.tsx` and `OperationalManager.tsx:284`) require the `tailwindcss-animate` plugin or custom keyframes — neither exists in `index.css` or Tailwind theme. They silently no-op.
6. **No code splitting whatsoever.** `App.tsx:4-7` imports all four panels synchronously. The teacher who opens the app to "Call HELP" downloads the entire admin scheduler bundle.
7. **`alert()` and `confirm()` are used as the primary user-feedback channel** — 11 `alert(` and 8 `confirm(` calls in `AdminPanel.tsx` (e.g. lines 672, 6308, 6400, 6478, 8149, 8256, 8323). Native dialogs break the visual language and are unstyled, modal-blocking, and not screen-reader-friendly.
8. **Modals lack a11y semantics and Escape-to-close.** No `role="dialog"`, no `aria-modal`, no `aria-labelledby`, no `Escape` keydown handlers anywhere in `src/components/`. ~10 modals across the app (`AdminPanel.tsx:3670, 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995`).
9. **Typography is monotonously "shouty".** `font-black` + `uppercase` + `tracking-widest` is applied to ~273 instances of `text-[8/9/10]px` labels in `AdminPanel.tsx`. Sub-11px uppercase bold is hard to read and removes meaningful hierarchy — when everything is loud, nothing is.
10. **The Firebase Web API key is committed in plaintext** (`firebase-applet-config.json:4`). This is normal for Firebase web apps *if* security rules are tight, but combined with point 3 (open rules), the project is effectively a public read/write database.

---

## 2. What I Reviewed

Static source-code review only. **I did not run the app, take screenshots, or use a browser.** No runtime DOM inspection, no contrast-ratio measurement against rendered pixels, no usability testing with humans.

| File | Lines | Read |
|---|---:|---|
| `src/App.tsx` | 377 | Full |
| `src/main.tsx` | 16 | Full |
| `src/index.css` | 30 | Full |
| `src/constants.ts` | 90 | Full |
| `src/data.ts` | 74 | Full |
| `src/types.ts` | 142 | Full |
| `src/firebase.ts` | 79 | Full |
| `src/context/FirebaseContext.tsx` | 66 | Full |
| `src/components/Login.tsx` | 87 | Full |
| `src/components/ErrorBoundary.tsx` | 66 | Full |
| `src/components/WebmasterPanel.tsx` | 307 | Full |
| `src/components/TeacherDashboard.tsx` | 819 | Full |
| `src/components/OperationalManager.tsx` | 1,215 | Full |
| `src/components/AdminPanel.tsx` | 8,715 | Sampled — read full opening (1–250), tabs (1840–2170), AddTeacher modal (3958–4140), SchedulerTab signature (6135–6260); structural map via grep of all 15 inner components, 38 `useState`s, all 19 `alert/confirm` sites, all 14 `: any`/`@ts-ignore`, 30 `md:`/`sm:` responsive utilities, 273 sub-11px text instances |
| `firestore.rules` | 197 | Full |
| `security_spec.md` | 25 | Full |
| `vite.config.ts` | 24 | Full |
| `eslint.config.js` | 8 | Full |
| `tsconfig.json` | 26 | Full |
| `package.json` | 41 | Full |
| `.env.example`, `metadata.json`, `firebase-applet-config.json`, `README.md`, `index.html` | various | Full |

Caveats:
- `AdminPanel.tsx` line numbers below are from a single-pass read; I sampled ~1,500 of 8,715 lines plus comprehensive greps for state, alerts, modals, tab controls, responsive utilities, and a11y attributes. I am confident in the patterns reported but did not exhaustively read every JSX block.
- Color-contrast claims are based on Tailwind class semantics (`text-white` on `bg-bg-gray` → ~1.06:1) not measured pixels.
- I did not verify whether `tailwindcss-animate` or similar would be auto-included by Tailwind v4 plugins; `package.json:30-39` shows it is not installed.

---

## 3. Information Architecture & Navigation

**Single-page app, role-gated, no router.** `App.tsx:240-264` switches the active panel on `activeUser.activeRole`. Roles are `'WEBMASTER' | 'ADMIN' | 'TEACHER' | 'OPERATIONAL_MANAGER'` (`types.ts:6`). The top nav (`App.tsx:191-238`) is a horizontal segmented control of available roles with `Briefcase`, `Shield`, `BarChart2`, `User` icons.

Findings:

- **No URL routing.** Refresh always lands on the active role; you cannot deep-link to "Scheduler tab on date X" or share a teacher's view. Browser back/forward do nothing inside the app. Adding `react-router` (or a tiny hash router) would unlock shareable links to specific scheduler dates, faculty profiles, etc., which is exactly the kind of link an admin would paste into a WhatsApp.
- **The seven `AdminPanel` tabs (`AdminPanel.tsx:2105-2153`) are stored only in component state** (`activeTab` at `AdminPanel.tsx:1838`). Reload reverts to `SUBJECTS`. Persisting in URL/`localStorage` is a 5-line fix.
- **Role hierarchy is conflated with role switching.** `App.tsx:78-86` overrides whatever role is loaded from Firestore based on a hardcoded `SUPER_ADMINS` list (`App.tsx:14-19`). A user with `roles: ['ADMIN', 'TEACHER']` but who is also in `SUPER_ADMINS` silently gets `['WEBMASTER', 'ADMIN', 'OPERATIONAL_MANAGER', 'TEACHER']` regardless of what the DB says. This logic is invisible to the user and to any admin trying to manage roles in `OperationalManager.tsx:175-191` (`toggleAdminRole`).
- **A "switch to OPS" shortcut button** (`App.tsx:218-225`) appears only for non-OPS users with the OPS role. Useful pattern, but it's the only such shortcut — there's no equivalent "switch to teacher view" button on the admin panel, even though admins frequently need to verify what teachers see.
- **`OperationalManager` is one giant scroll** (`OperationalManager.tsx:286-1003`). Workload chart, incident reports, leave records, marking gantt, extension log, admin role mgmt, workload chart again. No anchor links, no in-page nav. The same workload table renders twice (`OperationalManager.tsx:286-318` chart + `OperationalManager.tsx:944-980` table) plus again in the bottom workload section — duplicated visual real estate.
- **Bottom-right floating refresh button** (`App.tsx:269-276`) calls `window.location.reload()`. Given the entire app is on Firestore `onSnapshot` (`App.tsx:113-187`) and already updates in real time, this button is misleading — it implies stale data. Either remove it or make it an explicit "I've broken something, restart".

---

## 4. Visual Design & Brand Consistency

The brand colors are defined in `index.css:8-14`:
```
--color-curro-blue: #00468B;
--color-curro-red:  #E31B23;
--color-bg-gray:    #F4F7F9;
--color-text-dark:  #1A1A1A;
--color-text-muted: #666666;
```

Plus `--color-status-green: #28A745` and `--color-status-yellow: #FFC107`. Two fonts: Inter, JetBrains Mono.

Issues:

- **Brand colors are inconsistently used vs ad-hoc Tailwind colors.** `AdminPanel.tsx` uses `curro-blue` 149 times and `curro-red` 60 times, but also `bg-emerald-600`, `bg-amber-500`, `bg-purple-50`, `bg-sky-500`, `bg-orange-500`, `bg-zinc-900`, etc. for status semantics. There is no documented role-to-color mapping. `OperationalManager.tsx:294` uses `bg-emerald-600` as the OPS panel header but `App.tsx:206` uses `bg-emerald-500/20` for the OPS quick-switch chip. Pick one.
- **Webmaster theme is a third design.** `WebmasterPanel.tsx:146,168,206,243` paints `bg-zinc-900` cards with `border-orange-500/30` accents. The top nav also flips to `bg-black border-orange-600` (`App.tsx:193`) when in webmaster mode. This is a "hacker mode" trope rather than a deliberate dark theme — there is no light mode, no `prefers-color-scheme`, and the rest of the site stays light. Net effect: switching to Webmaster feels like switching apps.
- **Border radius is wildly inconsistent.** `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[22px]`, `rounded-[32px]`, `rounded-[40px]`, `rounded-[2rem]` all appear within a few hundred lines of `Login.tsx` and `TeacherDashboard.tsx`. There is no defined "card / button / chip" radius token.
- **Typography is monolithic.** Headings, labels, captions, table cells, status pills — almost everything is `font-black` (weight 900) and `uppercase`. There are 273 occurrences of sub-11px text (`text-[8px]`, `text-[9px]`, `text-[10px]`) in `AdminPanel.tsx`. Examples: `AdminPanel.tsx:2090, 2183, 2198`. This destroys hierarchy and is hostile to anyone with low vision. The `--font-mono` (JetBrains) is loaded but I count ~5 uses; if you don't use mono numerically, drop the @import to save ~50 KB of webfont.
- **`status-pill` / `status-green` / etc. classes defined in `index.css:23-29` are never referenced in source.** Either dead CSS or the team forgot they exist. Status displays in `OperationalManager.tsx:548-565, 877-885` re-implement the pill from scratch with Tailwind classes.
- **Iconography is consistent (lucide-react throughout)** which is good. But icons are sometimes purely decorative (e.g. `Server`, `Cpu`, `Network`, `Globe` on `WebmasterPanel.tsx`) for a mock "system status" panel that displays *fake static numbers* — `Server Load: 12%`, `API Latency: 45ms` (`WebmasterPanel.tsx:121-126`). These are placeholder fixtures that look authoritative; remove them or wire them to actual data.
- **Motion library is over-applied.** `motion.*` and `animate-*` classes appear ~97 times in `AdminPanel.tsx`, ~28 in `TeacherDashboard.tsx`. Every list item has a staggered fade-in (`AdminPanel.tsx:2061` `transition={{ delay: i * 0.05 }}`), which makes 30-row tables feel sluggish and animates on every state change. None of this respects `prefers-reduced-motion`.

---

## 5. Component & Layout Quality

- **Zero shared components.** Each panel reimplements its own card, modal, table, badge, and tab control. Examples: the "section card with colored header" (e.g. `OperationalManager.tsx:288-301`, `OperationalManager.tsx:430-443`, `OperationalManager.tsx:545-555`, `OperationalManager.tsx:687-699`, etc.) is duplicated ~7 times in `OperationalManager.tsx` alone with minor color tweaks. Pull it into a `<SectionCard variant="emerald|red|blue|amber" title icon>` and the file shrinks 30%.
- **Modal pattern is duplicated 10 times in `AdminPanel.tsx`** (lines 3670, 3832, 3993, 4165, 4341, 4541, 4694, 6014, 7857, 7995) — same `fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4` shell, same close-button-with-X pattern. A `<Modal open onClose>` primitive would deduplicate hundreds of lines and let you fix the a11y issues in one place.
- **Tab nav repeats in `AdminPanel.tsx:2105-2153`** as 7 near-identical `<button>` elements. A `tabs.map(...)` plus a TabButton component would avoid 50 lines of copy-paste.
- **Responsiveness is uneven.** `AdminPanel.tsx` uses `md:`/`lg:` 30 times across 8,715 lines. `TeacherDashboard.tsx` (the most likely mobile use case — invigilators on phones during exams) uses responsive utilities exactly **once** (`TeacherDashboard.tsx:1` import doesn't count; an actual `md:` appears only via inherited `App.tsx:243` `md:px-8`). The teacher dashboard is designed mobile-first by visual structure (rounded cards, bottom-sheet modals) but the layout never adapts up to desktop.
- **Tables overflow horizontally without explicit handling.** `OperationalManager.tsx:454, 562, 818, 870` use `overflow-x-auto`, which is correct, but no fade indicator or column priority hints. On a 320-wide phone, the 8-column "Incident Rapports" table is unreadable.
- **Empty / loading / error states are ad-hoc.**
  - Loading: only the global app spinner (`App.tsx:179-188`) and per-button spinners. No skeleton screens; the pages flash empty for ~8 seconds on first load (the 8-second `fallbackTimer` in `App.tsx:101-108` is alarming — it admits the app sometimes silently hangs).
  - Empty states exist but are inconsistent: `TeacherDashboard.tsx:368-376` ("No invigilation assigned") vs `OperationalManager.tsx:545-554` ("All Systems Nominal") vs `OperationalManager.tsx:920-925` ("No entries in this view range"). Different copy tone, different icon size, different background.
  - Error states: there is no inline error UI for failed Firestore writes. `TeacherDashboard.tsx:88` and `:269` use `alert('Failed to submit...')`. `AdminPanel.tsx` has 11 `alert()` failure paths.
- **Recharts containers are wrapped in fixed-height divs** (`WebmasterPanel.tsx:170, 196, 257`, `OperationalManager.tsx:328`). On narrow screens the bar chart with `angle={-90}` X-axis labels becomes a wall of overlapping text.

---

## 6. Forms, Inputs & Data Entry

The most common form pattern is `<label>` above `<input>` styled `text-[10px] font-black uppercase tracking-widest text-text-muted` (`AdminPanel.tsx:4026, 4041, 4061, 4076, 4093` and ~25 more). Issues:

- **Labels are not associated with inputs.** Every `<label>` is a sibling without `htmlFor`, and inputs lack `id`. Click on the label does not focus the input; screen readers do not announce the label when the input gets focus. Example: `Login.tsx:43` (Staff Email) and `Login.tsx:46-53` (input) — no association.
- **No `autoComplete` attributes.** `Login.tsx:46-53` (email) should have `autoComplete="username"` and the password (`Login.tsx:61-68`) should have `autoComplete="current-password"`. Without these, password managers will not offer credentials.
- **No `autoFocus` on the first field of any modal.** Opening AddTeacherModal (`AdminPanel.tsx:3958`), the user must click the Staff Code field. Same for every modal. This is the cheapest UX win available.
- **No client-side validation feedback beyond `required`.** Email pattern validation, staff-code length, percentage range — all enforced silently by `type="number" min max` (`AdminPanel.tsx:4111-4116`) but no inline error if the user blanks a required field. Submission failure goes to `alert()`.
- **The "password" on login is theatre** (`App.tsx:46-50`). Every staff member uses the same string `'CURRO'`. There is no rate limiting, no audit log, no MFA, no real account separation. The `Login.tsx` UI strongly implies real auth.
- **Help-request modal has poor option design.** `TeacherDashboard.tsx:599-617` lists 5 distinct options including the catastrophe "SOS" inline with mundane "Toiletpaper required". An invigilator under stress will mis-tap. Separate "SOS" into its own visually distinct panic button; sort the rest.
- **Number stepper buttons in help modal** (`TeacherDashboard.tsx:629-651`) use `+`/`-` text not icons, no min/max indicator, no keyboard support. `qpQuantity = 1` floor (`TeacherDashboard.tsx:638`) is good, but no upper bound (`TeacherDashboard.tsx:644`) — a stuck thumb could request 999 papers.
- **`select` elements default to first option** (`TeacherDashboard.tsx:728-734` Leave Type defaults to "Sick Leave" without prompting). Users may submit the default by accident. Use a "Choose…" placeholder with a `required` validation.
- **Date inputs lack min/max** (e.g. `TeacherDashboard.tsx:418-424`, `OperationalManager.tsx:104` `viewDate`). Users can pick 1990-01-01 with no feedback.
- **Textareas have hardcoded `min-h-[120px]` / `rows={4}`** but no character counter or guidance on length. Leave reason (`TeacherDashboard.tsx:765`) is `required` — say what makes a good reason.

---

## 7. Accessibility (a11y)

This section is the longest because the app is broadly inaccessible.

- **Zero ARIA attributes** in any component. Searched `aria-`, `role=` across `src/components/` — no matches. Modals are not `role="dialog"`, alert banners (`Login.tsx:34`) are not `role="alert"`, the live notification (`TeacherDashboard.tsx:524-573`) is not `aria-live="assertive"`.
- **No `Escape` keydown handlers** on any modal. Searched `Escape`, `onKeyDown` — no matches in `src/components/`. Users with no mouse cannot close any of the ~12 modals except by tabbing to the (X) button.
- **No focus trap in modals.** Tabbing inside an open modal bleeds back into the underlying page.
- **No focus management on modal open/close.** Open AddTeacherModal — focus stays on the trigger button (or wherever it was). Close — focus is lost.
- **Icon-only buttons lack `aria-label`.** All ~10 modal close `<X>` buttons (`AdminPanel.tsx`), the floating refresh (`App.tsx:269`), the role-switch toggles (`App.tsx:208-217`) when on narrow screens (`App.tsx:213-215` hides the text label below `xs`), the duty-management `<Trash2>` and `<UserPlus>` buttons (`OperationalManager.tsx:991-998`) — none announce themselves.
- **Color is the sole indicator of state** in many places: green = approved / red = denied / amber = pending pills (`OperationalManager.tsx:548-565, 877-893`). A color-blind user with the most common deuteranopia will not distinguish these without reading the small uppercase text. Add icons (which are present in some pills but not consistently) and/or distinct shapes.
- **Sub-11px uppercase bold text** (273 instances in `AdminPanel.tsx`) fails WCAG 1.4.4 (Resize text 200%) practical legibility. `text-[8px]` like `OperationalManager.tsx:548` and `AdminPanel.tsx:2090` is well below recommended minimum body sizes.
- **Likely contrast failures (estimated from class semantics, not measured):**
  - `WebmasterPanel.tsx:132,134` — `text-white` heading on `bg-bg-gray` (#F4F7F9) page → ~1.06:1, fails AA at any size.
  - `App.tsx:233-235` — `text-[10px] uppercase ... text-orange-500` chip text on `bg-orange-600` chip bg — small bold orange-on-orange.
  - `TeacherDashboard.tsx:343` — `text-[10px] text-text-muted` (#666) on `bg-gray-50/50` is ~5.7:1 — passes AA but only because text is bold; non-bold sub-12px fails AA.
  - `Login.tsx:43,58` — `text-[10px] text-gray-400` (Tailwind ≈ #9ca3af) on white is ~2.85:1, fails AA.
  - `WebmasterPanel.tsx:159` — `text-[10px] text-gray-500` on `bg-zinc-900` is borderline; muted labels on a near-black card are ~6:1, OK.
- **`prefers-reduced-motion` is not respected anywhere.** No CSS media query, no `useReducedMotion()` hook from `motion/react`. The app fades, springs, slides, pulses, and bounces by default. The `animate-pulse-slow` border (`TeacherDashboard.tsx:535`) on the help-request popup will be especially nauseating to vestibular-sensitive users.
- **No `lang` on dynamic content.** `index.html:2` has `lang="en"` but the data is bilingual (Afrikaans, Zulu, Sesotho, etc., per `constants.ts:67` `FAL_SUBJECTS`). Subject names mix languages without `lang="af"` etc.
- **The audio notification** (`TeacherDashboard.tsx:328`) plays an external mp3 (`https://assets.mixkit.co/...`) without user consent and without a way to mute or test. Browsers will block autoplay; the `.catch(...)` (`TeacherDashboard.tsx:333`) silently logs a warning. A teacher relying on the beep won't know it failed.
- **Tables have no `<caption>`** and no `scope` on `<th>`. Example: `OperationalManager.tsx:457-466` (Incident Rapports) — 8 column headers, no scope.
- **Charts have no text alternative.** Recharts `ResponsiveContainer` (`WebmasterPanel.tsx:175, 257`, `OperationalManager.tsx:329`) renders SVG with no `aria-label` or visible data table beside it. The Webmaster panel does include a table below the chart (`WebmasterPanel.tsx:269-298`) — good. But OperationalManager's first chart (`OperationalManager.tsx:328-355`) does not include a table, only a bar chart.
- **The nav role-switcher** (`App.tsx:200-217`) is a `<div>` of `<button>`s. Should be `role="tablist"` with `role="tab"`, `aria-selected`, arrow-key navigation. Right now Tab walks through every role button individually.

---

## 8. Role-Specific UX

### 8.1 Login (`Login.tsx`, 87 lines)

- Who: Any staff member, any time (per `App.tsx:46-50` the password is `CURRO` shared).
- Need: Identify themselves and continue.
- Friction: 
  - Password field implies a per-user secret but isn't (`App.tsx:46-50`).
  - Email matching is fuzzy/forgiving (4 suffix variants tried in `App.tsx:51-58`) — good.
  - No "remember me" checkbox even though `localStorage` is already used (`App.tsx:39, 67-68`) — the only-on-by-default state means anyone on a shared device stays logged in until manual logout.
  - No password manager hints (no `autocomplete`, no `<form>`-level `name` attributes).
  - No way to recover/reset since there is nothing to reset.
  - "Authorized Access Only" footer (`Login.tsx:81`) is ironic given the actual auth model.

### 8.2 Teacher Dashboard (`TeacherDashboard.tsx`, 819 lines)

- Who: An invigilator on a phone, during an exam, possibly stressed.
- Need: See "what am I doing right now? where? who is my standby? how do I call for help?" — fast.
- The "Call HELP" red button (`TeacherDashboard.tsx:498-516`) is well placed and disabled when no current activity, which is correct.
- Friction:
  - **First load latency.** As covered in §10, a teacher downloads the entire admin bundle. On 3G this is brutal.
  - The screen is dense — daily timetable, "Main Hall Team" HUD, support button, leave request — all stacked. A single "what's happening RIGHT NOW" hero card with "Call HELP" big at the bottom would serve the primary use better. Currently the current activity is just a left-edge blue stripe (`TeacherDashboard.tsx:393`) inside a list.
  - "Standby Support" name in the HUD (`TeacherDashboard.tsx:478-488`) is shown but there is **no way to phone or message them** from inside the app. For a "Bathroom Break" situation, a `tel:` or WhatsApp deep link would be invaluable (and `Teacher.email` exists in types but no phone field).
  - The help notification overlay (`TeacherDashboard.tsx:520-575`) is full-screen, blocking, and modal. If the standby teacher is themselves invigilating in another room, dismissing requires looking away from their own students. Add a swipe-to-dismiss / minimize.
  - Audio relies on autoplay — see §7.
  - The "Request Leave" button (`TeacherDashboard.tsx:434-440`) is placed in the salutation hero, but the form (`TeacherDashboard.tsx:684-797`) only has Type / Date / Reason — no time-range picker, despite the `LeaveRequest` type supporting `isFullDay`, `startTime`, `endTime` (`types.ts:90-96`). So partial-day leave can never be requested via the UI.
  - "Hello, ${user.firstName}!" salutation doesn't change with time of day; "Invigilating Now" only appears when `selectedDate === today`. The header always says the same — easy missed personalization.
  - The progress bar (`TeacherDashboard.tsx:457-475`) updates only every 30 seconds (`TeacherDashboard.tsx:39`). For a 90-minute period that's fine; for a 10-minute changeover it's visibly jumpy.

### 8.3 Operational Manager (`OperationalManager.tsx`, 1,215 lines)

- Who: A dean / department head / scheduler manager.
- Need: See faculty workload distribution, approve marking extensions, manage incident reports and leave, grant/revoke admin rights.
- Friction:
  - **Two duplicate workload charts** (`OperationalManager.tsx:328` and `:1009`) — same data, same component, same colors. The second one with table is more useful; delete the first.
  - **Workload exclusion logic is hardcoded by staff ID.** `OperationalManager.tsx:75-84` excludes Merike, includes Franz, marks specific IDs as "specialists". This is not configurable; if a teacher leaves or a new specialist joins, an engineer must edit code. The same logic is duplicated in `WebmasterPanel.tsx:81-101`. Move to a `Teacher.workloadCategory` field.
  - Approver gate (`OperationalManager.tsx:32`) `APPROVERS = ['MERV', 'PLAL', 'EZRN']` is also hardcoded. Same issue — should be `Teacher.canApproveExtensions`.
  - Pending extension cards (`OperationalManager.tsx:732-746`) show "Requested by `${ext.requestedBy}`" — this is a staff code (e.g. "AMOP"), not a name. Look up the teacher.
  - The "Admin Privilege Management" section (`OperationalManager.tsx:937-1004`) renders all 33 teachers as cards in a grid. No bulk operations, no role indicator other than `STAFF` / `OPS` / `WEBMASTER` derived inline. A search exists (`OperationalManager.tsx:961`) but no filter by role.
  - The approval form on each card (`OperationalManager.tsx:1129-1152`) approves with optional comments — there's no warning if approving a 5-day extension on a critical subject; no view of the requested entry's exam date to gauge urgency.
  - The CSV download button (`OperationalManager.tsx:973-980`) downloads "Series Workload" but the user has no preview of what columns will be exported; the column set is hardcoded `OperationalManager.tsx:200-209`.
  - The Marking Gantt (`OperationalManager.tsx:842-928`) is a custom table-based gantt. It works for 21 days but the X-axis is fixed-width — beyond ~15 rows the page feels endless. Consider collapsing by grade.

### 8.4 Admin Panel (`AdminPanel.tsx`, 8,715 lines)

This is the largest panel and likely where the most actual scheduling work happens.

- Who: Admin staff who actually build the timetable, maintain venues, allocate invigilators.
- Need: Add/edit subjects, faculty, exam timetable entries, venues, and assign invigilators per period; resolve conflicts.
- Friction:
  - **The Scheduler tab has 50+ props passed in** (`AdminPanel.tsx:6135-6228`). The decomposition into `SchedulerTab(...)` is a lift-state-up nightmare. Either move state into the child or use a context.
  - 7 top-level tabs (`AdminPanel.tsx:2105-2153`) each labelled with a single uppercase word. "Subjects / Faculty / Exam Time Table / Venues / Scheduler / Assignments / Inspection" — three of these (Scheduler, Assignments, Inspection) are conceptually about *the same data* viewed differently. Consider a 2-tier IA: "Setup" (Subjects, Faculty, Venues, Periods) → "Build" (Timetable, Scheduler, Assignments) → "Verify" (Inspection, Stats).
  - "Inspection" tab (`AdminPanel.tsx:3154`) is gated by selecting a teacher (`AdminPanel.tsx:1872 selectedInspectionTeacherId`); empty state isn't documented from my read.
  - **Bulk actions confirmed via `confirm()`.** "Are you sure you want to clear ALL assignments for ${selectedDate}?" (`AdminPanel.tsx:6297`). A native confirm is a brittle UX for a destructive action. Use a typed-confirmation modal ("Type CLEAR to confirm").
  - **Faculty list of 33 teachers** is rendered into a list-and-detail layout (`AdminPanel.tsx:2165+`). With `INITIAL_TEACHERS` of 33 names this works; if Curro has more campuses joining, add virtualization (none currently).
  - **Auto-generation features** (`isGenerating`, `isEqualizing`, multi-stage progress at `AdminPanel.tsx:375-389`) display per-stage progress bars. No way to cancel mid-run; no "what if I rollback" preview. Bulk operations against Firestore should support undo.
  - **Workload computation duplicates the logic** in `AdminPanel.tsx:1595` (`workloadStats`), `OperationalManager.tsx:42-94` and `WebmasterPanel.tsx:25-118`. Three implementations slightly different (hardcoded specialist IDs differ between files). Extract to `src/lib/workload.ts`.
  - **The Add Teacher modal accepts an arbitrary `Staff Code`** (`AdminPanel.tsx:4017-4032`) — uppercase free text, no uniqueness check before submit. Duplicate codes will cause silent overwrites because Firestore rules accept any signed-in user (`firestore.rules:71-77`).

### 8.5 Webmaster Panel (`WebmasterPanel.tsx`, 307 lines)

- Who: Franz Nortje (per `data.ts:11`), system maintainer.
- Need: Diagnose system health, view role distribution, see global workload.
- Friction:
  - **Fake stats.** `WebmasterPanel.tsx:121-126` — Server Load 12%, API Latency 45ms, DB Connections 14 Active, Error Rate 0.01%. These are hardcoded. Either wire to real metrics (Firebase Performance, Firestore usage API) or remove. As-is, it teaches the operator that the dashboard lies.
  - **"Global Controls" toggles** (`WebmasterPanel.tsx:212-227`) — Public Web App, Automatic Backups, Real-time Sync. None are clickable; they are static `<div>`s of always-on toggles. Either hook them up or delete.
  - The "System Diagnostics" heading (`WebmasterPanel.tsx:134`) is white text with no dark backdrop — invisible until you scroll into a card. Cover the panel with a `bg-zinc-950 -mx-... px-... py-... rounded-...` wrapper, or change heading color.
  - The role-distribution pie (`WebmasterPanel.tsx:175-203`) overlaps roles — every webmaster is also a teacher (per `data.ts:11`), but the chart counts them separately. That's misleading.
  - The faculty table (`WebmasterPanel.tsx:269-298`) shows minutes as raw integers. 480 minutes = 8 hours; surface that.

---

## 9. Data Visualization (Recharts)

- **No `<title>` or `aria-label` on any chart.** Searched all `ResponsiveContainer` usages (`WebmasterPanel.tsx:172, 196, 257`, `OperationalManager.tsx:329, 1014`). A blind user gets nothing.
- **Color choices on stacked bar charts** (`WebmasterPanel.tsx:280-283`, `OperationalManager.tsx:344-347`): tech `#0ea5e9`, morning `#3b82f6`, afternoon `#a855f7`, standby `#10b981`. The two blues (`sky-500` and `blue-500`) are visually adjacent and distinguishable mainly by hue — for deuteranopia they collapse. Test with a CB simulator; consider one blue + one orange + one green + one purple.
- **X-axis at `angle={-90}` with 8px font** (`WebmasterPanel.tsx:264-268`) — names rotated vertically squeezed against the chart. On a narrow viewport, names overlap each other. Either truncate to last name only, or paginate the chart.
- **Tooltips have white-on-dark styling** even on the OperationalManager light chart (`OperationalManager.tsx:339-342` uses `backgroundColor: '#fff'`). At least that one is consistent. Webmaster's `#18181b` tooltip is fine on dark cards.
- **The pie chart has no percentage labels** (`WebmasterPanel.tsx:181-189`). Users see "Teachers, Admins, Webmasters" with raw counts but no proportion.
- **No empty-state on charts.** With zero entries, the bar charts will render an empty gray rectangle. Show "No assignments yet — generate or add one".

---

## 10. Performance & Perceived Performance

- **Single bundle. No code splitting.** `App.tsx:4-7` imports `TeacherDashboard`, `AdminPanel`, `WebmasterPanel`, `OperationalManager` synchronously. Use `React.lazy(() => import(...))` + `<Suspense>` per role; on average a teacher would download 1/4 of the JS.
- **`AdminPanel.tsx` is a 397 KB source file.** Even with tree-shaking, the inner 15 components, all lucide icons, all date-fns helpers, and Recharts go into the same chunk.
- **Recharts is heavy** (~350 KB minified). Loaded by all three of `OperationalManager`, `WebmasterPanel`, `AdminPanel`. Lazy-load it; teachers never need it.
- **Motion library is on every page.** `motion/react` is imported by all four panels and used pervasively. The library is ~80-120 KB. If you keep it, gate animations behind `prefers-reduced-motion`.
- **No list virtualization.** Faculty list, scheduler grids, Gantt rows — all rendered fully. With 33 teachers you're fine; at scale (multi-campus) you need `react-window` or similar.
- **Firestore listeners (9 of them) all start on app load** (`App.tsx:113-187`) regardless of which panel will be opened. A teacher session loads `subjects`, `dayPeriodConfigs`, `markingExtensions`, `venues`, all of which are admin-only data. Move these listeners into the panels that need them.
- **`testConnection()` runs on every page load** (`firebase.ts:25` — the `testConnection()` invocation). It does an extra `getDocFromServer` round-trip for nothing — remove or guard with `import.meta.env.DEV`.
- **The 8-second `fallbackTimer`** (`App.tsx:101-108`) is a code smell. If the data flow is correct, you don't need a timeout to "force" loading. The current behavior: on bad network or rule failure, the user sees a loading spinner for 8 seconds, then the empty fallback teachers. It would be better to render the app immediately and surface inline loading state per section.
- **Audio asset is fetched from a CDN** (`TeacherDashboard.tsx:328` mixkit.co). If that CDN is down, the help notification is silent. Bundle the file or self-host.
- **`AnimatePresence` wraps full-screen modals** (`TeacherDashboard.tsx:521, 578, 685`). This forces a re-render of the entire modal tree on close. Cheap fix but visible jank on slow phones.
- **The floating Refresh button does `window.location.reload()`** (`App.tsx:269-276`) — full page reload, all listeners re-subscribed, all state lost. With `onSnapshot` already running, this button shouldn't exist.

---

## 11. Other System Issues Found

- **`firestore.rules` is permissive to the point of negligence.** `firestore.rules:29-49` defines `isAdmin()`, `isWebmaster()`, `isOperationalManager()` all as `isAuthorized()` which is `isSignedIn()` which is `request.auth != null`. Combined with `FirebaseContext.tsx:23` automatically signing in *anonymously*, **every visitor to the URL has admin write access to every collection except where there's a stricter explicit rule**. Sessions, assignments, timetable entries can be edited by anonymous users. This contradicts the intent in `security_spec.md:6` ("Only Admins or Webmasters can modify other users' roles") — the rules do not enforce this.
- **Scope of write rules is mostly `if isAdmin()`** which under the helper definition is `isSignedIn()`. `firestore.rules:101, 107, 120, 148, 176` — sessions, assignments, timetable entries, subjects, dayPeriodConfigs all writable by anyone signed in. The "Dirty Dozen" defense in `security_spec.md:11-22` is not actually implemented.
- **Firebase Web API key in repo** (`firebase-applet-config.json:4`) — this is normal for client-side Firebase, but only safe when rules are tight. They are not (see above).
- **`@google/genai` is installed but unused** (`package.json:14`). Searched all `src/` for `genai`, `Gemini`, `GoogleGenAI`, `generateContent`, `process.env.GEMINI_API_KEY` — zero hits. The Gemini key is wired through `vite.config.ts:11` and inserted as `process.env.GEMINI_API_KEY` at build time, but nothing reads it. Either remove the dependency or use it.
- **`process.env.GEMINI_API_KEY` is `JSON.stringify`'d into the client bundle** (`vite.config.ts:11`). If you do start using it in client code, the key is publicly visible. Move Gemini calls to a server function.
- **`express` is in dependencies** (`package.json:20`) but no server file exists. Dead dep.
- **`dotenv` is in dependencies** (`package.json:19`) but Vite handles env loading natively. Dead dep.
- **`tailwindcss` is in both `dependencies` and `devDependencies`** (`package.json:36, 27` — `@tailwindcss/vite` and `tailwindcss`). Pick one.
- **`autoprefixer` is in `devDependencies`** (`package.json:34`) — Tailwind v4 with `@tailwindcss/vite` does not need it.
- **Tailwind v4 `@theme` block is incomplete**: `index.css:4-15` defines colors and fonts but not `--spacing`, `--radius`, etc. The radius and spacing chaos in §4 is a direct symptom.
- **`tsconfig.json` is permissive.** No `"strict": true`, no `"noUnusedLocals"`, no `"noImplicitAny"`. `package.json:11 "lint": "tsc --noEmit"` therefore catches very little. There are 14 `: any` annotations and 2 `@ts-ignore` (`TeacherDashboard.tsx:430, 501`).
- **No tests.** Searched repo — no `*.test.ts`, `*.spec.ts`, no `vitest`, `jest`, `@testing-library`. The `security_spec.md:24` explicitly notes "I cannot run a test suite directly" — author is aware.
- **`ErrorBoundary.tsx:33-36` parses the error message as JSON to extract Firestore errors.** This works for errors thrown by `handleFirestoreError` (`firebase.ts:51-78`) but the message includes auth info — `userId`, `email`, etc. — which is dumped to `console.error` (`firebase.ts:75`). Don't log PII.
- **`ErrorBoundary` has no reset path other than full reload** (`ErrorBoundary.tsx:53`). For a transient Firestore hiccup, "Reload Application" is heavy-handed.
- **`ErrorBoundary` doesn't report errors anywhere** — no Sentry, no Firebase Crashlytics, no console.error fallback for production. You won't know your users hit an error unless they tell you.
- **`temp.txt` is committed** at the repo root with one orphan line of code. Delete.
- **`SUPER_ADMINS` whitelist** (`App.tsx:14-19`) is hardcoded by staff code. Onboarding/offboarding super admins requires a code change + redeploy.
- **`PUBLIC_HOLIDAYS = ['2026-05-01', '2026-06-16']`** (`OperationalManager.tsx:33`) and the cycle-1 reference date `2026-04-13` (`constants.ts:39`) are hardcoded for 2026. Won't roll over to 2027 automatically.
- **Hardcoded specialist staff codes** in `WebmasterPanel.tsx:91-93`, `OperationalManager.tsx:75-79`, `AdminPanel.tsx:216-225`. Same logic in three places, with subtly different IDs in each — maintainability nightmare.
- **`React.StrictMode` is enabled** (`main.tsx:9`) — good. But many `useEffect` hooks contain Firestore listeners with cleanup; under strict mode these subscribe twice in development. Verify no double-write side effects.
- **Login fallback uses `localStorage`** (`App.tsx:39, 67-68`). Combined with anonymous Firebase auth, a shared device is dangerous: clear the browser tab and the next user is logged in as the previous teacher.

---

## 12. Prioritized Recommendations

Sorted by Impact desc, Effort asc.

| # | Recommendation | Area | Effort | Impact | Notes |
|---|---|---|---|---|---|
| 1 | Tighten `firestore.rules` to actually check the user's `roles` field on the `/users/{uid}` doc, instead of `isSignedIn()` masquerading as `isAdmin()`. Stop signing in anonymously by default in `FirebaseContext.tsx:23`. | Security | M | High | The single biggest risk. `firestore.rules:29-49` + `FirebaseContext.tsx:18-27`. Without this, every other UX role boundary is theatre. |
| 2 | Replace shared `'CURRO'` password (`App.tsx:46`) with real Firebase Auth (Google sign-in is already wired in `FirebaseContext.tsx:36`). Drop the email-string-matching fallback. | Security / Login | M | High | Cuts ~30 lines and makes role enforcement real. |
| 3 | Fix Webmaster panel contrast: wrap the panel in `bg-zinc-950 rounded-3xl p-6` or change the page background when `activeRole === 'WEBMASTER'`. | Visual / a11y | S | High | `WebmasterPanel.tsx:132`, `App.tsx:189`. Single class change. |
| 4 | Remove the floating refresh button (`App.tsx:269-276`) or rename it to "Reload" and explain why someone would press it. | UX | S | High | Currently misleads users into thinking real-time isn't working. |
| 5 | Replace all `alert()` and native `confirm()` in `AdminPanel.tsx` with a styled toast/modal primitive. | UX | M | High | 11 alerts, 8 confirms. Pull the success/error toasts into `<Toast>` and confirmations into `<ConfirmDialog>`. |
| 6 | Code-split panels with `React.lazy` + `Suspense`. | Performance | S | High | `App.tsx:4-7`. Teacher bundle drops by ~70%. |
| 7 | Lazy-load Recharts in only the panels that use it. | Performance | S | Med | ~350 KB saved on the teacher session. |
| 8 | Add `htmlFor`/`id` to every `<label>`/`<input>` pair, plus `autoComplete` on Login (`Login.tsx:46-68`) and `autoFocus` on first field of every modal. | a11y / Forms | S | High | Cheapest win in the file. |
| 9 | Add `Escape`-to-close + focus trap + `role="dialog"` + `aria-labelledby` to the modal wrapper, then reuse it. | a11y | M | High | ~12 modals across `AdminPanel.tsx`, `TeacherDashboard.tsx`, `OperationalManager.tsx`. One new component. |
| 10 | Extract a `<SectionCard>`, `<DataTable>`, `<TabButton>`, `<Modal>` set; replace the 7 duplicated card patterns and 7 tab buttons in `AdminPanel.tsx:2105-2153` and `OperationalManager.tsx:286+`. | Maintainability | M | High | Will shrink `AdminPanel.tsx` and `OperationalManager.tsx` by ~25-30%. |
| 11 | Move workload-calc / specialist-list / approver-list out of components into `src/lib/`. | Maintainability | S | Med | Three near-identical implementations in `WebmasterPanel.tsx:25`, `OperationalManager.tsx:42`, `AdminPanel.tsx:1595`. |
| 12 | Define and enforce typography scale: cap minimum body text at 12px, reserve `font-black uppercase` for ≤3 specific roles (e.g. nav, primary stat). | Visual / a11y | M | High | 273 sub-11px instances in `AdminPanel.tsx`. |
| 13 | Define the missing `animate-shake`, `animate-pulse-slow`, `animate-in fade-in slide-in-from-bottom-4` keyframes — or remove them. | Visual | S | Low | They silently no-op today. `Login.tsx:35`, `TeacherDashboard.tsx:535`, ~12 spots. |
| 14 | Add `prefers-reduced-motion` support: gate `motion.*` animations behind `useReducedMotion()` from `motion/react`, and disable `animate-pulse` on the help-request popup when set. | a11y | S | Med | Accessibility compliance + nausea reduction. |
| 15 | Replace fake Webmaster stats (`WebmasterPanel.tsx:121-126`, toggles `:212-227`) with real data or remove the section. | Trust / UX | S | Med | Currently teaches the operator the dashboard lies. |
| 16 | Add a real "switch to teacher view" shortcut for admins, mirror of `App.tsx:218-225`. | UX | S | Med | Common admin workflow: verify what the teacher sees. |
| 17 | Implement URL routing (`react-router` or hash router) so tabs and selected dates are linkable and bookmarkable. | UX / IA | M | Med | Persists `activeTab` (`AdminPanel.tsx:1838`), `selectedDate`, `viewDate`. |
| 18 | De-duplicate the workload chart in `OperationalManager.tsx` (lines 286-356 vs 1009-1024 are the same chart). | UX | S | Med | Fix in 5 minutes. |
| 19 | Add color-blind-safe palette to stacked bar charts; current sky-500 + blue-500 are too close. | DataViz / a11y | S | Med | `WebmasterPanel.tsx:280-283`, `OperationalManager.tsx:344-347`. |
| 20 | Extract `SUPER_ADMINS`, `APPROVERS`, `PUBLIC_HOLIDAYS`, specialist lists into Firestore-managed config. | Maintainability | M | Med | `App.tsx:14`, `OperationalManager.tsx:32-33`, etc. |
| 21 | Add inline error states (banner + retry) replacing `alert('Failed to ...')` in `TeacherDashboard.tsx:88, 269` and the 11 admin alerts. | UX | M | Med | Tied to Recommendation 5. |
| 22 | Audit `tsconfig.json`: turn on `"strict": true`, `"noUnusedLocals"`, fix the 14 `: any` and 2 `@ts-ignore` cases. Replace `lint: tsc --noEmit` with a real eslint+tsc combo. | Quality | M | Med | `tsconfig.json`, `package.json:11`, `eslint.config.js`. |
| 23 | Remove dead deps: `express`, `dotenv`, `autoprefixer`, the duplicate `tailwindcss` entry, and `@google/genai` if still unused. | Hygiene | S | Low | `package.json`. |
| 24 | Persist `activeTab` (`AdminPanel.tsx:1838`) and selected dates in `localStorage` or URL. | UX | S | Low | One useEffect. |
| 25 | Self-host the help-notification audio (`TeacherDashboard.tsx:328`); show a UI toast as well so deaf users / muted phones still get the alert. | a11y / Resilience | S | Med | External CDN dependency on critical safety path. |

---

## 13. Quick Wins (do these first)

| Order | Recommendation | Why now |
|---|---|---|
| 1 | **#3 — Fix Webmaster contrast** by wrapping the panel in a dark backdrop. (`WebmasterPanel.tsx:132`) | One-line change, visibly broken section becomes legible. |
| 2 | **#6 — Lazy-load panels** with `React.lazy`. (`App.tsx:4-7`) | ~5 lines, teacher first-load drops dramatically. |
| 3 | **#8 — Label / autocomplete / autofocus** on Login + every modal first field. (`Login.tsx:42-68` and ~10 modal openings) | Trivial, but big a11y + password-manager UX win. |
| 4 | **#4 — Delete or rename the floating refresh button.** (`App.tsx:269-276`) | One block removed, removes a misleading affordance. |
| 5 | **#18 — Delete the duplicate workload chart** in `OperationalManager.tsx` (lines 286-356 OR 1009-1024). | One block removed, page feels half as long. |
