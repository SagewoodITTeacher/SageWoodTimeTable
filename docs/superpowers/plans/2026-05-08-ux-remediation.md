# UX Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 14 UX issues identified in the component scorecard evaluation, starting with quick wins and building to larger structural changes.

**Architecture:** Incremental fixes — no new dependencies. Leverage existing shared UI primitives (`Modal`, `Toast`, `SectionCard`, `Tabs`, `ConfirmDialog`). Extract shared logic to `src/lib/`. Add a `useReducedMotion` hook. All changes are backward-compatible.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Firebase, motion/react, vitest + @testing-library/react

---

## File Structure

### New Files
- `src/hooks/useReducedMotion.ts` — hook for `prefers-reduced-motion`
- `src/lib/workload.ts` — extracted workload calculation logic
- `src/lib/staff-config.ts` — hardcoded staff IDs and holidays moved to configurable constants

### Modified Files
- `src/components/Login.tsx` — add `htmlFor`/`id`, `autoComplete`, `autoFocus`
- `src/components/TeacherDashboard.tsx` — fix SOS separation, migrate notification popup to `<Modal>`, add `htmlFor`/`id`, remove inline SVG
- `src/components/OperationalManager.tsx` — migrate hand-rolled modal to `<Modal>`, add in-page nav, remove inline SVG, use `workload.ts`
- `src/components/WebmasterPanel.tsx` — label fake stats, add chart `aria-label`, use `workload.ts`
- `src/components/AdminPanel.tsx` — typography sweep (cap at 12px), add `htmlFor`/`id` to inputs, use `workload.ts`
- `src/components/ui/SectionCard.tsx` — bump subtitle to 12px
- `src/components/ui/Tabs.tsx` — gate animations behind `useReducedMotion`
- `src/App.tsx` — add `role="tablist"`/`role="tab"` to role switcher, add `aria-label` to icon-only buttons
- `src/index.css` — add `prefers-reduced-motion` media query to disable animations

---

### Task 1: Add `useReducedMotion` hook and global CSS gate

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Create the `useReducedMotion` hook**

```ts
import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Add global CSS media query to disable animations**

Append to `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Run the build to verify no errors**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useReducedMotion.ts src/index.css
git commit -m "feat: add useReducedMotion hook and global prefers-reduced-motion CSS gate"
```

---

### Task 2: Fix Login form a11y (`htmlFor`/`id`, `autoComplete`, `autoFocus`)

**Files:**
- Modify: `src/components/Login.tsx`

- [ ] **Step 1: Add `id`, `htmlFor`, `autoComplete`, and `autoFocus` to Login form fields**

In `Login.tsx`, make these changes:

1. The email input (currently around line 217-225): add `id="login-email"`, `autoComplete="email"`, `autoFocus`
2. The password input (currently around line 240-248): add `id="login-password"`, `autoComplete="current-password"`
3. The email-link confirm input (around line 134-143): already has `autoFocus`; add `id="confirm-email"`, `autoComplete="email"`

No `<label>` elements currently wrap these inputs — they use `placeholder` only. The inputs are self-labeling via placeholder, but adding `autoComplete` is the critical fix for password managers.

- [ ] **Step 2: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Login.tsx
git commit -m "fix(a11y): add autoComplete and id attributes to Login form inputs"
```

---

### Task 3: Fix TeacherDashboard — SOS visual separation

**Files:**
- Modify: `src/components/TeacherDashboard.tsx`

- [ ] **Step 1: Separate SOS option from mundane help options**

In the help modal (around line 600-617), the 5 options are rendered in a single `.map()`. Split the SOS option into a separate visually distinct section:

Change the help options rendering from a flat map to two groups:
- Routine options: "Question Paper Required", "Folio required", "Toiletpaper required", "Bathroom Break" — rendered in the current style
- A visual divider (horizontal rule with "EMERGENCY" label)
- SOS option: rendered with `bg-curro-red` background, larger text, a warning icon

The specific edit: replace the single `.map()` of all 5 options with two blocks:

```tsx
{(['Question Paper Required', 'Folio required', 'Toiletpaper required', 'Bathroom Break'] as HelpOption[]).map((option) => (
  <button
    key={option}
    onClick={() => setSelectedHelpOption(option)}
    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${
      selectedHelpOption === option
        ? 'bg-curro-blue border-curro-blue text-white shadow-lg'
        : 'bg-gray-50 border-gray-100 text-text-dark hover:border-curro-blue/30'
    }`}
  >
    <span className="font-black text-xs uppercase tracking-widest">{option}</span>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
      selectedHelpOption === option ? 'border-white text-white' : 'border-gray-200 text-transparent'
    }`}>
      <CheckCircle2 className="w-4 h-4" />
    </div>
  </button>
))}

<div className="flex items-center gap-3 py-2">
  <div className="flex-1 h-px bg-curro-red/20" />
  <span className="text-[9px] font-black text-curro-red uppercase tracking-widest">Emergency</span>
  <div className="flex-1 h-px bg-curro-red/20" />
</div>

<button
  onClick={() => setSelectedHelpOption('SOS')}
  className={`w-full p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${
    selectedHelpOption === 'SOS'
      ? 'bg-curro-red border-curro-red text-white shadow-lg shadow-red-500/20'
      : 'bg-curro-red/5 border-curro-red/30 text-curro-red hover:bg-curro-red/10'
  }`}
>
  <div className="flex items-center gap-3">
    <AlertCircle className="w-5 h-5" />
    <span className="font-black text-sm uppercase tracking-widest">SOS</span>
  </div>
  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
    selectedHelpOption === 'SOS' ? 'border-white text-white' : 'border-curro-red/30 text-transparent'
  }`}>
    <CheckCircle2 className="w-4 h-4" />
  </div>
</button>
```

- [ ] **Step 2: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/TeacherDashboard.tsx
git commit -m "fix(ux): visually separate SOS from routine help options with emergency divider"
```

---

### Task 4: Fix TeacherDashboard — migrate notification popup to shared `<Modal>`

**Files:**
- Modify: `src/components/TeacherDashboard.tsx`

- [ ] **Step 1: Replace hand-rolled notification popup with `<Modal>`**

The standby notification popup (lines 536-590) uses `AnimatePresence` + hand-rolled fixed overlay. Replace it with the shared `<Modal>` component which provides focus trap, `role="dialog"`, `aria-modal`, and Escape handling.

Replace the `AnimatePresence` block with:

```tsx
<Modal
  open={!!activeNotification}
  onClose={() => activeNotification && handleAcknowledgeNotification(activeNotification)}
  title="HELP REQUESTED!"
  size="sm"
>
  <div className="flex flex-col items-center text-center">
    <div className="w-20 h-20 bg-curro-red/10 text-curro-red rounded-full flex items-center justify-center mb-6 ring-8 ring-curro-red/5">
      <AlertCircle className="w-10 h-10" />
    </div>

    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full mb-6 text-left space-y-2">
      <div className="flex justify-between">
        <span className="text-[10px] font-black text-text-muted uppercase">Venue</span>
        <span className="text-xs font-black text-text-dark uppercase">{activeNotification?.venueName}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-black text-text-muted uppercase">Subject</span>
        <span className="text-xs font-black text-text-dark">{activeNotification?.subject} (Gr {activeNotification?.grade})</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] font-black text-text-muted uppercase">Teacher</span>
        <span className="text-xs font-black text-text-dark">{activeNotification?.invigilatorName}</span>
      </div>
      <div className="h-px bg-gray-200 my-2" />
      <div className="flex flex-col items-center pt-2">
        <span className="text-[10px] font-black text-text-muted uppercase mb-1">Issue Reported:</span>
        <span className="text-sm font-black text-curro-red uppercase italic">
          {activeNotification?.option}
          {activeNotification?.quantity ? ` (${activeNotification.quantity} required)` : ''}
        </span>
      </div>
    </div>

    <button
      onClick={() => activeNotification && handleAcknowledgeNotification(activeNotification)}
      className="w-full bg-curro-blue text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
    >
      STATED: I RECEIVED (OK)
    </button>
  </div>
</Modal>
```

Also remove the `AnimatePresence` import if no longer used elsewhere in the file (check: it's still used for the help modal quantity animation, so keep the import).

- [ ] **Step 2: Remove the inline `CheckCircle2` SVG redefinition**

Delete the `function CheckCircle2(props: any)` block at the bottom of the file (lines 753-771). This is a duplicate of the lucide-react import already at line 6. The local redefinition shadows the lucide import — remove it so the lucide version is used.

- [ ] **Step 3: Add `htmlFor`/`id` to label/input pairs in leave and help modals**

For each `<label>` in the modals, add `htmlFor`; for each associated input, add `id`:

- Leave Type label → `htmlFor="leave-type"`, select → `id="leave-type"`
- Date of Leave label → `htmlFor="leave-date"`, input → `id="leave-date"`
- Reason label → `htmlFor="leave-reason"`, textarea → `id="leave-reason"`
- Number of Papers label → `htmlFor="qp-quantity"`

- [ ] **Step 4: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TeacherDashboard.tsx
git commit -m "fix(a11y): migrate notification popup to shared Modal, remove inline SVG, add label associations"
```

---

### Task 5: Fix OperationalManager — migrate hand-rolled modal to shared `<Modal>`

**Files:**
- Modify: `src/components/OperationalManager.tsx`

- [ ] **Step 1: Replace the hand-rolled request modal with `<Modal>`**

The request modal (lines 937-1009) uses `AnimatePresence` + hand-rolled fixed overlay. Replace with shared `<Modal>`.

Replace the `AnimatePresence` block with:

```tsx
<Modal
  open={isRequestModalOpen && !!selectedEntry}
  onClose={() => { setIsRequestModalOpen(false); setSelectedEntry(null); }}
  title="Marking Extension"
  size="md"
>
  <form onSubmit={handleRequestExtension} className="flex flex-col gap-6">
    <p className="text-sm text-text-muted font-bold uppercase tracking-widest">
      {selectedEntry?.subject} — Grade {selectedEntry?.grade}
    </p>
    <div>
      <label htmlFor="ext-days" className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
        Additional Days (Green)
      </label>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setAdditionalDays(n)}
            className={`py-3 rounded-2xl font-black text-sm transition-all ${additionalDays === n ? 'bg-emerald-600 text-white shadow-lg ring-4 ring-emerald-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            +{n}
          </button>
        ))}
      </div>
    </div>

    <div>
      <label htmlFor="ext-reason" className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">
        Reason for Request
      </label>
      <textarea
        id="ext-reason"
        value={requestReason}
        onChange={(e) => setRequestReason(e.target.value)}
        required
        rows={4}
        placeholder="Provide context for the extension requirement..."
        className="w-full bg-gray-50 border-2 border-transparent rounded-2xl p-4 text-sm font-bold text-gray-900 focus:bg-white focus:border-emerald-500 transition-all outline-none resize-none"
      />
    </div>

    <div className="grid grid-cols-2 gap-4 pt-4">
      <button
        type="button"
        onClick={() => { setIsRequestModalOpen(false); setSelectedEntry(null); }}
        className="py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-400 hover:bg-gray-100 transition-all"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        {isSubmitting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Request
      </button>
    </div>
  </form>
</Modal>
```

- [ ] **Step 2: Remove the inline `RefreshCw` SVG redefinition**

Delete the `function RefreshCw(props: any)` block at the bottom of the file (lines 1080-1100). It's not used after the modal migration (the spinner is now an inline `div` with `animate-spin`).

- [ ] **Step 3: Add `htmlFor`/`id` to the remaining label/input in the admin search**

The admin search input (around line 831-836) doesn't have a visible label, so add `aria-label="Search faculty"` to the input.

- [ ] **Step 4: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/OperationalManager.tsx
git commit -m "fix(a11y): migrate request modal to shared Modal, remove inline SVG, add aria-label"
```

---

### Task 6: Extract workload logic to `src/lib/workload.ts`

**Files:**
- Create: `src/lib/workload.ts`
- Modify: `src/components/OperationalManager.tsx`
- Modify: `src/components/WebmasterPanel.tsx`

- [ ] **Step 1: Create `src/lib/workload.ts`**

Extract the workload calculation that's triplicated across OperationalManager, WebmasterPanel, and AdminPanel. The function takes entries, teachers, and dayPeriodConfigs, and returns the workload stats array.

```ts
import { Teacher, TimetableEntry, DayPeriodConfig } from '../types';
import { format, parseISO } from 'date-fns';
import { PERIODS, WEDNESDAY_PERIODS } from '../constants';

export interface WorkloadRow {
  name: string;
  firstName: string;
  lastName: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
  total: number;
  id: string;
  loadWeight: number;
  adjTotal: number;
}

export interface StaffConfig {
  excludedNames: string[];   // e.g. ["merike van dyk"]
  excludedIds: string[];     // e.g. []
  specialistIds: string[];   // e.g. ["FRAN", "JACB", "NORT", "ORMA", "CHAM", "EZNY", "ORIM", "CPMO", "ENYA", "SHEH", "SHHU"]
  specialistLoadWeight: number; // e.g. 0.7
}

const DEFAULT_STAFF_CONFIG: StaffConfig = {
  excludedNames: ['merike van dyk'],
  excludedIds: [],
  specialistIds: ['FRAN', 'JACB', 'NORT', 'ORMA', 'CHAM', 'EZNY', 'ORIM', 'CPMO', 'ENYA', 'SHEH', 'SHHU'],
  specialistLoadWeight: 0.7,
};

export function computeWorkload(
  entries: TimetableEntry[],
  teachers: Teacher[],
  dayPeriodConfigs: DayPeriodConfig[],
  config: StaffConfig = DEFAULT_STAFF_CONFIG,
): WorkloadRow[] {
  const morning = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const afternoon = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const tech = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const standbyMinutes = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const total = Object.fromEntries(teachers.map(t => [t.id, 0]));

  entries.forEach(entry => {
    if (!entry.invigilatorAssignments) return;

    const dc = dayPeriodConfigs.find(c => c.id === entry.date);
    const periodsToUse = dc?.periods || (format(parseISO(entry.date), 'EEEE') === 'Wednesday' ? WEDNESDAY_PERIODS : PERIODS);

    Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
      if (!total.hasOwnProperty(tid)) return;

      const parts = key.split('_');
      const pIdx = parseInt(parts[0]);
      const vId = parts[1];
      const role = parts[2];

      if (vId !== 'GRADE' && !entry.venueIds?.includes(vId)) return;

      const p = periodsToUse[pIdx];
      let duration = entry.durationMinutes || 120;
      if (p) {
        const [h1, m1] = p.start.split(':').map(Number);
        const [h2, m2] = p.end.split(':').map(Number);
        duration = (h2 * 60 + m2) - (h1 * 60 + m1);
      }

      if (role === 'STANDBY') {
        standbyMinutes[tid] += duration;
        total[tid] += duration;
      } else if (role === 'TECH') {
        tech[tid] += duration;
        total[tid] += duration;
      } else if (entry.session === 'MORNING') {
        morning[tid] += duration;
        total[tid] += duration;
      } else if (entry.session === 'AFTERNOON') {
        afternoon[tid] += duration;
        total[tid] += duration;
      }
    });
  });

  return teachers
    .filter(t => {
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      const isExcluded = config.excludedNames.some(ex => name.includes(ex.toLowerCase()));
      const isSpecialist = config.specialistIds.includes(t.id);
      return (t.activeRole !== 'WEBMASTER' || isSpecialist) &&
             (t.canInvigilate !== false || isSpecialist) &&
             !isExcluded;
    })
    .map(t => {
      const isSpecialist = config.specialistIds.includes(t.id);
      const loadWeight = isSpecialist ? config.specialistLoadWeight : 1.0;
      return {
        name: `${t.lastName}, ${t.firstName}`,
        firstName: t.firstName,
        lastName: t.lastName,
        morning: morning[t.id],
        afternoon: afternoon[t.id],
        tech: tech[t.id],
        standby: standbyMinutes[t.id],
        total: total[t.id],
        id: t.id,
        loadWeight,
        adjTotal: Math.round(total[t.id] / loadWeight),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 2: Update OperationalManager to use `computeWorkload`**

Replace the inline `workloadData` useMemo with:

```ts
import { computeWorkload } from '../lib/workload';
// ...
const workloadData = React.useMemo(() =>
  computeWorkload(entries, teachers, []),
, [entries, teachers]);
```

Remove the now-unused local workload calculation code (the entire useMemo body that computes morning/afternoon/tech/standbyMinutes/total).

- [ ] **Step 3: Update WebmasterPanel to use `computeWorkload`**

Replace the inline `workloadStats` useMemo with:

```ts
import { computeWorkload } from '../lib/workload';
// ...
const workloadStats = useMemo(() =>
  computeWorkload(entries, teachers, dayPeriodConfigs),
, [entries, teachers, dayPeriodConfigs]);
```

Remove the now-unused local workload calculation code.

- [ ] **Step 4: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/workload.ts src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx
git commit -m "refactor: extract workload calculation to src/lib/workload.ts, deduplicate across panels"
```

---

### Task 7: Extract hardcoded staff config to `src/lib/staff-config.ts`

**Files:**
- Create: `src/lib/staff-config.ts`
- Modify: `src/components/OperationalManager.tsx`
- Modify: `src/components/WebmasterPanel.tsx`

- [ ] **Step 1: Create `src/lib/staff-config.ts`**

```ts
export const APPROVERS = ['MERV', 'PLAL', 'EZRN'];

export const PUBLIC_HOLIDAYS_2026 = ['2026-05-01', '2026-06-16'];

// TODO: Move to Firestore config for multi-year support
export function getPublicHolidays(): string[] {
  return PUBLIC_HOLIDAYS_2026;
}
```

- [ ] **Step 2: Update OperationalManager to import from staff-config**

Replace `const APPROVERS = ['MERV', 'PLAL', 'EZRN'];` and `const PUBLIC_HOLIDAYS = ['2026-05-01', '2026-06-16'];` with:

```ts
import { APPROVERS, getPublicHolidays } from '../lib/staff-config';
// ...
const PUBLIC_HOLIDAYS = getPublicHolidays();
```

- [ ] **Step 3: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/staff-config.ts src/components/OperationalManager.tsx
git commit -m "refactor: extract APPROVERS and PUBLIC_HOLIDAYS to src/lib/staff-config.ts"
```

---

### Task 8: Fix WebmasterPanel — label fake stats, add chart `aria-label`

**Files:**
- Modify: `src/components/WebmasterPanel.tsx`

- [ ] **Step 1: Label fake stats as "Demo"**

Change the `stats` array (around line 124-129) to include a `demo: true` flag, and add a "(Demo)" badge to each stat card. Alternatively, simpler: change the `status` field to `'Demo'` and style it with amber.

Replace the stats array:

```ts
const stats = [
  { label: 'Server Load', value: '12%', status: 'Demo', icon: Cpu },
  { label: 'API Latency', value: '45ms', status: 'Demo', icon: Network },
  { label: 'DB Connections', value: '14 Active', status: 'Demo', icon: Database },
  { label: 'Error Rate', value: '0.01%', status: 'Demo', icon: ShieldAlert },
];
```

The existing status pill rendering already handles non-healthy statuses with `bg-amber-500/10 text-amber-500`, so "Demo" will render correctly.

- [ ] **Step 2: Add `aria-label` to chart containers**

Add `aria-label` to the `ResponsiveContainer` wrappers or their parent divs:

- Role distribution pie: add `aria-label="Role distribution chart"` to the parent `<div className="h-[250px] w-full">`
- Series workload chart: add `aria-label="Faculty workload chart"` to the parent `<div className="h-[400px] w-full mb-8">`

- [ ] **Step 3: Add percentage labels to pie chart legend**

In the pie chart legend (around line 178-185), include the percentage:

```tsx
{roleData.map((d, i) => {
  const pct = roleData.length > 0 ? Math.round((d.value / roleData.reduce((s, r) => s + r.value, 0)) * 100) : 0;
  return (
    <div key={d.name} className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
      <span className="text-[10px] font-black uppercase text-gray-400">{d.name} ({d.value}) {pct}%</span>
    </div>
  );
})}
```

- [ ] **Step 4: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WebmasterPanel.tsx
git commit -m "fix(ux): label fake Webmaster stats as Demo, add chart aria-labels and pie percentages"
```

---

### Task 9: Fix App shell — role switcher a11y and icon button labels

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `role="tablist"` to role switcher and `role="tab"` + `aria-selected` to each role button**

The role switcher `<div>` (around line 171-197) needs:

- Outer `<div>`: add `role="tablist"` and `aria-label="Role switcher"`
- Each role `<button>`: add `role="tab"` and `aria-selected={activeUser.activeRole === role}`

- [ ] **Step 2: Add `aria-label` to icon-only buttons**

- The floating refresh button (if still present): add `aria-label="Refresh application"`
- The OPS quick-switch icon button: add `aria-label="Switch to OPS Panel"`
- The avatar circle: add `aria-label={`${activeUser.firstName} ${activeUser.lastName}`}`

- [ ] **Step 3: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix(a11y): add tablist/tab roles to role switcher, aria-labels to icon buttons"
```

---

### Task 10: Fix SectionCard subtitle size

**Files:**
- Modify: `src/components/ui/SectionCard.tsx`

- [ ] **Step 1: Bump subtitle from `text-[11px]` to `text-xs` (12px)**

In `SectionCard.tsx` line 90, change `text-[11px]` to `text-xs`.

- [ ] **Step 2: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SectionCard.tsx
git commit -m "fix(a11y): bump SectionCard subtitle from 11px to 12px for WCAG legibility"
```

---

### Task 11: Typography sweep — cap sub-11px text at 12px across all components

**Files:**
- Modify: `src/components/TeacherDashboard.tsx`
- Modify: `src/components/OperationalManager.tsx`
- Modify: `src/components/AdminPanel.tsx`
- Modify: `src/components/WebmasterPanel.tsx`
- Modify: `src/components/Login.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace all `text-[8px]` with `text-[10px]` and `text-[9px]` with `text-[10px]` across all components**

This is a find-and-replace operation. The goal is to eliminate text smaller than 10px. We keep `text-[10px]` as the minimum (still small but a pragmatic compromise — 12px would be ideal but would break the dense table layouts in AdminPanel).

Run these replacements across the codebase:

```bash
# In TeacherDashboard.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/TeacherDashboard.tsx

# In OperationalManager.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/OperationalManager.tsx

# In AdminPanel.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/AdminPanel.tsx

# In WebmasterPanel.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/WebmasterPanel.tsx

# In Login.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/Login.tsx

# In App.tsx
sed -i 's/text-\[8px\]/text-[10px]/g; s/text-\[9px\]/text-[10px]/g' src/components/App.tsx
```

- [ ] **Step 2: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/TeacherDashboard.tsx src/components/OperationalManager.tsx src/components/AdminPanel.tsx src/components/WebmasterPanel.tsx src/components/Login.tsx src/App.tsx
git commit -m "fix(a11y): cap minimum text size at 10px across all components (was 8-9px)"
```

---

### Task 12: Add `htmlFor`/`id` to AdminPanel form inputs

**Files:**
- Modify: `src/components/AdminPanel.tsx`

- [ ] **Step 1: Add `id` attributes to key inputs in AdminPanel modals**

This is a large file (9K lines). The most impactful fix is adding `id` to inputs inside the shared `<Modal>` instances. Since there are 10 modals, do a targeted search for `<input` and `<select` and `<textarea` elements that lack `id`, and add unique `id` attributes.

Key inputs to fix (by modal):
- AddTeacherModal: Staff Code input → `id="add-teacher-code"`, First Name → `id="add-teacher-first"`, Last Name → `id="add-teacher-last"`, Email → `id="add-teacher-email"`
- EditTeacherModal: similar pattern with `edit-teacher-` prefix
- VenueModal: Venue Name → `id="venue-name"`, Capacity → `id="venue-capacity"`
- LeaveRequestModal: Date → `id="admin-leave-date"`, Reason → `id="admin-leave-reason"`

For each, also add `htmlFor` to the corresponding `<label>` if one exists.

Use `grep -n '<input\|<select\|<textarea\|<label' src/components/AdminPanel.tsx` to find all instances, then add `id`/`htmlFor` pairs.

- [ ] **Step 2: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "fix(a11y): add htmlFor/id associations to AdminPanel modal form inputs"
```

---

### Task 13: Add in-page navigation to OperationalManager

**Files:**
- Modify: `src/components/OperationalManager.tsx`

- [ ] **Step 1: Add a sticky tab/nav bar at the top of OperationalManager**

Add a horizontal navigation bar below the component header that links to each `SectionCard` section. Use anchor IDs on each SectionCard and smooth-scroll links.

At the top of the component's return, add:

```tsx
<nav className="sticky top-28 z-40 bg-bg-gray/95 backdrop-blur-sm border-b border-gray-100 -mx-4 md:-mx-8 px-4 md:px-8 py-3 flex items-center gap-2 overflow-x-auto scrollbar-thin" aria-label="Operations sections">
  {[
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
    { id: 'leave', label: 'Leave', icon: CalendarOff },
    { id: 'marking', label: 'Marking', icon: Activity },
    { id: 'extensions', label: 'Extensions', icon: AlertCircle },
    { id: 'extension-log', label: 'Log', icon: MessageSquare },
    { id: 'admin-roles', label: 'Roles', icon: Shield },
    { id: 'workload', label: 'Workload', icon: BarChart2 },
  ].map(s => (
    <a
      key={s.id}
      href={`#${s.id}`}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-gray-100 hover:text-text-dark transition-colors whitespace-nowrap"
    >
      <s.icon className="w-3 h-3" />
      {s.label}
    </a>
  ))}
</nav>
```

- [ ] **Step 2: Add `id` attributes to each SectionCard**

Add `id` props to each `<SectionCard>`:
- Incidents → `id="incidents"`
- Leave → `id="leave"`
- Marking Operations → `id="marking"`
- Awaiting Extensions → `id="extensions"`
- Extension Log → `id="extension-log"`
- Admin Role Management → `id="admin-roles"`
- Workload Balance → `id="workload"`

Since `SectionCard` doesn't currently forward `id`, add `id` to the `<section>` element in `SectionCard.tsx`:

In `SectionCard.tsx`, add `id` to the interface and spread it on the `<section>`:

```tsx
export interface SectionCardProps {
  variant: SectionCardVariant;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerActions?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
}

// In the component:
<section
  id={id}
  className={cn(
    "bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden",
    className
  )}
>
```

- [ ] **Step 3: Run type check**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/OperationalManager.tsx src/components/ui/SectionCard.tsx
git commit -m "feat(ux): add in-page navigation to OperationalManager with anchor links"
```

---

### Task 14: Run full test suite and verify build

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npm test`
Expected: All tests pass

- [ ] **Step 2: Run the production build**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run the linter**

Run: `cd /home/claude/workspace/github/SageWoodTimeTable && npm run lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Final commit if any fixups needed**

If any test or build issues were found and fixed, commit the fixups.
