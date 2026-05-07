# Performance: Code-splitting + Listener Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop teacher first-load JS by ~70% via per-panel code-splitting, lazy Recharts, and listener scoping. Eliminate the 8s loading-spinner safety net.

**Architecture:** `React.lazy` per panel + `<Suspense>`. New `src/hooks/` directory holds one hook per Firestore collection, owned by the panel that needs it. Global listeners reduced to `users` (which contains `teachers`) only. Recharts moves to per-chart files that are only imported by the panels that render them, then those panels themselves are lazy.

**Tech Stack:** React 19, Vite 6, Firebase Firestore, vitest, rollup-plugin-visualizer.

**Depends on:** Plan 1 (vitest + RTL test infrastructure must be in place — `vitest.config.ts`, `src/test/setup.ts`, `npm test` script).

**Bundle baseline (estimated, no analyzer yet):**
- Today: every visitor pulls `AdminPanel.tsx` (~397 KB source), Recharts (~350 KB min), Motion (~80–120 KB), all of date-fns/lucide. Single chunk; teachers download admin scheduler they never see.
- Target for Teacher session: ≤ 250 KB gzipped initial JS (Recharts and AdminPanel must not be in the teacher chunk).

---
                                                                  
  Notes for next session:                                                                                                                                                                                                                 
  - userEvent v14 + vi.useFakeTimers() hangs in this vitest 4 setup — fake-timer tests use fireEvent instead                                                                                                                              
  - Modal scopes initial-focus to its content area (not panel) so the X button isn't auto-focused                                                                                                                                         
  - Modal.hideClose added during Plan 4 for non-dismissable progress overlays                                                                                                                                                             
  - Plan 5 (Performance) is next per the Plan 2 changelog ordering, or Plan 6/7/8/9 depending on user priority       
  

## Task 1: Lazy-load the four role panels

`App.tsx:4-7` synchronously imports `TeacherDashboard`, `AdminPanel`, `WebmasterPanel`, `OperationalManager`. The panel switch at `App.tsx:317-360` renders one of them based on `activeUser.activeRole`.

**Files:**
- Modify: `src/App.tsx:1-12` (replace static imports with `React.lazy`)
- Modify: `src/App.tsx:317-360` (wrap panel switch in `<Suspense>`)
- Create: `src/components/PanelLoadingSpinner.tsx`

- [ ] **Step 1: Read the current static-import block**

Run: `sed -n '1,12p' src/App.tsx`
Expected output begins with `import React, { useState, useEffect, useMemo } from 'react';` followed by the panel imports on lines 4-7.

- [ ] **Step 2: Create the panel-loading spinner component**

Write `src/components/PanelLoadingSpinner.tsx`:

```tsx
export default function PanelLoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-curro-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-xs uppercase tracking-widest">Loading panel…</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the four static panel imports with `React.lazy`**

Edit `src/App.tsx`. Replace lines 1 and 4-7:

```tsx
import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
// ...other unchanged imports...
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const WebmasterPanel = lazy(() => import('./components/WebmasterPanel'));
const OperationalManager = lazy(() => import('./components/OperationalManager'));
import Login from './components/Login';
import PanelLoadingSpinner from './components/PanelLoadingSpinner';
```

Note: `Login` stays static (it ships in the initial bundle so the unauthenticated user sees it instantly).

- [ ] **Step 4: Wrap the panel switch in `<Suspense>`**

Edit `src/App.tsx:317-360`. Wrap the four conditional render blocks:

```tsx
<main className="pt-28 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
  <Suspense fallback={<PanelLoadingSpinner />}>
    {activeUser.activeRole === 'TEACHER' && (
      <TeacherDashboard /* ...same props... */ />
    )}
    {activeUser.activeRole === 'ADMIN' && (
      <AdminPanel /* ...same props... */ />
    )}
    {activeUser.activeRole === 'OPERATIONAL_MANAGER' && (
      <OperationalManager /* ...same props... */ />
    )}
    {activeUser.activeRole === 'WEBMASTER' && (
      <WebmasterPanel /* ...same props... */ />
    )}
  </Suspense>
</main>
```

- [ ] **Step 5: Verify the build still works and produces multiple chunks**

Run: `npm run build`
Expected: `dist/assets/` now contains separate chunks for each panel. Look for `TeacherDashboard-*.js`, `AdminPanel-*.js`, etc.

Verify: `ls -lah dist/assets/*.js | awk '{print $5, $9}'`

- [ ] **Step 6: Smoke-test in dev**

Run: `npm run dev`
In browser DevTools Network tab, confirm:
1. Initial page load fetches the main bundle but NOT `AdminPanel` chunk.
2. Switching to Admin role triggers a new chunk fetch.
3. The `PanelLoadingSpinner` appears briefly during fetch (throttle to "Slow 3G" to see it).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/PanelLoadingSpinner.tsx
git commit -m "perf: code-split role panels with React.lazy + Suspense"
```

---

## Task 2: Extract Recharts wrappers and lazy-load them

Recharts is imported in three panels (`OperationalManager.tsx:7-10`, `WebmasterPanel.tsx:4-7`, plus `AdminPanel.tsx` for one stat block). Even with Task 1 splitting panels, the chart library still ships inside each panel chunk. Goal: extract every chart into its own file that is `lazy()`-imported by its panel, so Recharts becomes its own chunk that only downloads when a chart is actually rendered.

**Files:**
- Create: `src/components/charts/WorkloadChart.tsx`
- Create: `src/components/charts/RoleDistributionPieChart.tsx`
- Create: `src/components/charts/SeriesWorkloadChart.tsx`
- Create: `src/components/charts/index.ts` (barrel export of lazy versions)
- Modify: `src/components/OperationalManager.tsx` (remove direct Recharts imports, use lazy chart components)
- Modify: `src/components/WebmasterPanel.tsx` (same)
- Test: `src/components/charts/WorkloadChart.test.tsx`

- [ ] **Step 1: Inventory every Recharts usage**

Run: `grep -rn "from 'recharts'\|ResponsiveContainer\|<BarChart\|<PieChart" src/components/`

Expected: hits in `OperationalManager.tsx` (around line 329, 1014), `WebmasterPanel.tsx` (around line 175, 196, 257), and possibly `AdminPanel.tsx` for any stat panels.

Record the exact line ranges that wrap each `<ResponsiveContainer>` so you can extract them surgically.

- [ ] **Step 2: Create `WorkloadChart.tsx` (extract from OperationalManager)**

The first chart in `OperationalManager.tsx` (around line 1014, inside `SectionCard` for series workload) is the candidate to keep (Plan 1 deletes the duplicate at lines 286-356).

Write `src/components/charts/WorkloadChart.tsx`:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface WorkloadDatum {
  name: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
}

interface Props {
  data: WorkloadDatum[];
  height?: number;
}

export default function WorkloadChart({ data, height = 360 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12" role="status">
        No assignments yet — generate or add one.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }} aria-label="Workload by teacher">
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="morning" stackId="a" fill="#0ea5e9" name="Morning" />
        <Bar dataKey="afternoon" stackId="a" fill="#f97316" name="Afternoon" />
        <Bar dataKey="tech" stackId="a" fill="#8b5cf6" name="Tech" />
        <Bar dataKey="standby" stackId="a" fill="#10b981" name="Standby" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

(Note: colorblind-safe palette adjustment lives in Plan 10. Here we just preserve current colors with one tweak — `f97316` orange replaces the second blue — to keep the diff small.)

- [ ] **Step 3: Create `RoleDistributionPieChart.tsx` (extract from WebmasterPanel)**

Write `src/components/charts/RoleDistributionPieChart.tsx`:

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  data: { name: string; value: number; color: string }[];
}

export default function RoleDistributionPieChart({ data }: Props) {
  if (data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12" role="status">
        No role data available.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart aria-label="Role distribution">
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 0, borderRadius: 8, color: '#fff' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Create `SeriesWorkloadChart.tsx` (extract from WebmasterPanel)**

Write `src/components/charts/SeriesWorkloadChart.tsx` for the bar chart at `WebmasterPanel.tsx` ~line 257. Extract it with the same pattern: takes `data` prop, renders `BarChart` inside `ResponsiveContainer`, returns empty-state when no data. Reuse the colors from the original implementation.

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface SeriesDatum {
  name: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
}

interface Props {
  data: SeriesDatum[];
}

export default function SeriesWorkloadChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-sm py-12" role="status">
        No workload data yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 60 }} aria-label="Series workload by teacher">
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis dataKey="name" interval={0} tick={{ fontSize: 9, fill: '#a1a1aa' }} angle={-90} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} />
        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: 0, borderRadius: 8, color: '#fff' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#fff' }} />
        <Bar dataKey="morning" stackId="a" fill="#0ea5e9" name="Morning" />
        <Bar dataKey="afternoon" stackId="a" fill="#f97316" name="Afternoon" />
        <Bar dataKey="tech" stackId="a" fill="#8b5cf6" name="Tech" />
        <Bar dataKey="standby" stackId="a" fill="#10b981" name="Standby" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Create the lazy barrel file**

Write `src/components/charts/index.ts`:

```ts
import { lazy } from 'react';

export const WorkloadChart = lazy(() => import('./WorkloadChart'));
export const RoleDistributionPieChart = lazy(() => import('./RoleDistributionPieChart'));
export const SeriesWorkloadChart = lazy(() => import('./SeriesWorkloadChart'));
```

- [ ] **Step 6: Write the failing test for `WorkloadChart` empty-state**

Write `src/components/charts/WorkloadChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkloadChart from './WorkloadChart';

describe('WorkloadChart', () => {
  it('shows empty-state copy when data is empty', () => {
    render(<WorkloadChart data={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No assignments yet/i);
  });

  it('renders the chart container when data has entries', () => {
    const data = [{ name: 'AAA', morning: 1, afternoon: 0, tech: 0, standby: 0 }];
    const { container } = render(<WorkloadChart data={data} />);
    expect(container.querySelector('[aria-label="Workload by teacher"]')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run the tests — they should pass**

Run: `npm test -- src/components/charts/WorkloadChart.test.tsx`
Expected: 2 passed.

- [ ] **Step 8: Replace the inline Recharts blocks in `OperationalManager.tsx`**

Find the chart block (around `OperationalManager.tsx:1009-1024` post-Plan-1, or `:328-355` pre-Plan-1). Replace with:

```tsx
import { Suspense } from 'react';
import { WorkloadChart } from './charts';
// ...elsewhere...
<Suspense fallback={<div className="h-[360px] animate-pulse bg-zinc-100 rounded" />}>
  <WorkloadChart data={chartData} />
</Suspense>
```

Remove the Recharts imports from `OperationalManager.tsx:7-10`.

- [ ] **Step 9: Replace the inline Recharts blocks in `WebmasterPanel.tsx`**

Same pattern. Replace the pie chart at `WebmasterPanel.tsx:175-203` with `<RoleDistributionPieChart>` inside `<Suspense>`. Replace the series chart at `:257-298` with `<SeriesWorkloadChart>`. Remove the Recharts imports from `WebmasterPanel.tsx:4-7`.

- [ ] **Step 10: Build and verify Recharts is in its own chunk**

Run: `npm run build`
Run: `ls -lah dist/assets/*.js`

Expected: there is now a `recharts-*.js` (or similar) chunk that is loaded only when a chart-using panel mounts.

- [ ] **Step 11: Commit**

```bash
git add src/components/charts/ src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx
git commit -m "perf: extract chart components and lazy-load Recharts"
```

---

## Task 3: Scope Firestore listeners to the panels that need them

`App.tsx:103-188` mounts nine global `onSnapshot` listeners:

1. `sessions` (App.tsx:114-119)
2. `assignments` (:122-127)
3. `leaveRequests` (:130-135)
4. `timetableEntries` (:138-143)
5. `venues` (:146-151)
6. `markingExtensions` (:154-158)
7. `subjects` (:161-166)
8. `dayPeriodConfigs` (:169-174)
9. `users` (the teacher list, :177-194)

Per-panel needs:
- **Teacher** uses: `sessions`, `assignments`, `timetableEntries`, `venues` + global `users`/teachers.
- **Admin** uses: all nine.
- **Operations** uses: `timetableEntries`, `markingExtensions`, `leaveRequests` + global `users`.
- **Webmaster** uses: `sessions`, `timetableEntries`, `dayPeriodConfigs` + global `users`.

Keep `users` global (auth + role lookup needs it). Move the rest into per-collection hooks owned by the panel that opens them.

**Files:**
- Create: `src/hooks/useFirestoreCollection.ts` (generic listener hook)
- Create: `src/hooks/useSessions.ts`
- Create: `src/hooks/useAssignments.ts`
- Create: `src/hooks/useLeaveRequests.ts`
- Create: `src/hooks/useTimetableEntries.ts`
- Create: `src/hooks/useVenues.ts`
- Create: `src/hooks/useMarkingExtensions.ts`
- Create: `src/hooks/useSubjects.ts`
- Create: `src/hooks/useDayPeriodConfigs.ts`
- Modify: `src/App.tsx` (delete 8 listeners, keep only `users`)
- Modify: `src/components/TeacherDashboard.tsx` (consume the hooks it needs)
- Modify: `src/components/AdminPanel.tsx` (consume all the hooks)
- Modify: `src/components/OperationalManager.tsx` (consume the hooks it needs)
- Modify: `src/components/WebmasterPanel.tsx` (consume the hooks it needs)
- Test: `src/hooks/useFirestoreCollection.test.ts`

- [ ] **Step 1: Write the failing test for `useFirestoreCollection`**

Write `src/hooks/useFirestoreCollection.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirestoreCollection } from './useFirestoreCollection';

vi.mock('firebase/firestore', () => {
  const listeners = new Map<string, (snap: any) => void>();
  return {
    collection: (_db: unknown, name: string) => ({ name }),
    onSnapshot: (ref: { name: string }, onNext: any) => {
      listeners.set(ref.name, onNext);
      return () => listeners.delete(ref.name);
    },
    __emit: (name: string, docs: any[]) =>
      listeners.get(name)?.({ docs: docs.map((d, i) => ({ id: String(i), data: () => d })) }),
  };
});

vi.mock('../firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'list' },
}));

describe('useFirestoreCollection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns [] and loading=true before snapshot fires', () => {
    const { result } = renderHook(() => useFirestoreCollection<{ x: number }>('foo'));
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('updates data when snapshot fires', async () => {
    const { result } = renderHook(() => useFirestoreCollection<{ x: number }>('foo'));
    const fs = await import('firebase/firestore') as any;
    act(() => fs.__emit('foo', [{ x: 1 }, { x: 2 }]));
    expect(result.current.data).toEqual([{ id: '0', x: 1 }, { id: '1', x: 2 }]);
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — it should fail because the hook doesn't exist yet**

Run: `npm test -- src/hooks/useFirestoreCollection.test.ts`
Expected: FAIL with module-not-found or similar.

- [ ] **Step 3: Implement `useFirestoreCollection`**

Write `src/hooks/useFirestoreCollection.ts`:

```ts
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface UseCollectionResult<T> {
  data: T[];
  loading: boolean;
}

export function useFirestoreCollection<T extends { id: string }>(name: string): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
        setData(docs);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, name);
      }
    );
    return () => unsub();
  }, [name]);

  return { data, loading };
}
```

- [ ] **Step 4: Run the test — should pass now**

Run: `npm test -- src/hooks/useFirestoreCollection.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Create the typed wrapper hooks**

Write each of the 8 wrapper hooks. Example for `src/hooks/useSessions.ts`:

```ts
import { ExamSession } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useSessions() {
  return useFirestoreCollection<ExamSession>('sessions');
}
```

Repeat with the appropriate type for each collection:
- `useAssignments.ts` → `Assignment` from `'assignments'`
- `useLeaveRequests.ts` → `LeaveRequest` from `'leaveRequests'`
- `useTimetableEntries.ts` → `TimetableEntry` from `'timetableEntries'`
- `useVenues.ts` → `Venue` from `'venues'`
- `useMarkingExtensions.ts` → `MarkingExtension` from `'markingExtensions'`
- `useSubjects.ts` → `Subject` from `'subjects'`
- `useDayPeriodConfigs.ts` → `DayPeriodConfig` from `'dayPeriodConfigs'`

- [ ] **Step 6: Strip the eight non-`users` listeners from `App.tsx`**

Edit `src/App.tsx`. Delete the listeners and the related state at:
- Line 27 (`assignments` state) — delete
- Line 28 (`leaveRequests`) — delete
- Line 29 (`timetableEntries`) — delete
- Line 30 (`venues`) — delete
- Line 31 (`markingExtensions`) — delete
- Line 32 (`subjects`) — delete
- Line 34 (`dayPeriodConfigs`) — delete
- Line 33 (`lockedDates`) — keep for now (unrelated)
- Lines 114-175 (the eight `onSnapshot` blocks for sessions, assignments, leaveRequests, timetableEntries, venues, markingExtensions, subjects, dayPeriodConfigs) — delete
- Lines 199-208 (their unsubscribe entries inside the cleanup) — delete; keep only `teachersUnsubscribe()`

Keep:
- The `users` listener (currently lines 177-194) — but rename `setIsDataReady` semantics: this listener should now signal `setIsDataReady(true)` only after the auth + users join completes (already does).

- [ ] **Step 7: Update each panel's call site to consume hooks**

`TeacherDashboard.tsx`: at the top of the component body, add:

```tsx
const { data: sessions } = useSessions();
const { data: assignments } = useAssignments();
const { data: entries } = useTimetableEntries();
const { data: venues } = useVenues();
```

Remove the matching props from its `interface Props`. Update `App.tsx:319-326` to no longer pass `sessions`, `assignments`, `entries`, `venues` to `<TeacherDashboard>`.

`AdminPanel.tsx`: same pattern, but consume all eight hooks. Remove the matching props from `interface Props`. Update `App.tsx:328-342` to pass only `user` and `teachers` (plus `setAssignments` for the moment — see Step 8).

`OperationalManager.tsx`: consume `useTimetableEntries`, `useMarkingExtensions`, `useLeaveRequests`. Remove from props. Update `App.tsx:344-351`.

`WebmasterPanel.tsx`: consume `useSessions`, `useTimetableEntries`, `useDayPeriodConfigs`. Remove from props. Update `App.tsx:353-359`.

- [ ] **Step 8: Handle `setAssignments` (the only mutating prop)**

`App.tsx:333` currently passes `setAssignments` to `AdminPanel` for optimistic local writes (search `AdminPanel.tsx` for usage). Since the listener is moving inside the panel, the optimistic-update setter must move with it. Inside `AdminPanel.tsx`, after the hook call:

```tsx
const { data: assignmentsFromFirestore } = useAssignments();
const [optimisticAssignments, setAssignments] = useState<Assignment[]>([]);
const assignments = optimisticAssignments.length ? optimisticAssignments : assignmentsFromFirestore;
useEffect(() => { setAssignments(assignmentsFromFirestore); }, [assignmentsFromFirestore]);
```

This preserves the existing optimistic-update behavior without exporting the setter to `App.tsx`.

- [ ] **Step 9: Build and dev-server smoke test**

Run: `npm run build` — expect no type errors.
Run: `npm run dev` — open browser, log in, switch through all four roles. Each should render without missing-data flickers.

In Network tab, confirm:
1. Teacher login: only `sessions`, `assignments`, `timetableEntries`, `venues`, `users` listeners are open.
2. Switching to Admin: additionally opens `leaveRequests`, `markingExtensions`, `subjects`, `dayPeriodConfigs`.
3. Logging out: all listeners (except auth state) detach.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/ src/App.tsx src/components/TeacherDashboard.tsx src/components/AdminPanel.tsx src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx
git commit -m "perf: scope Firestore listeners to the panels that consume them"
```

---

## Task 4: Remove the 8-second `fallbackTimer`

`App.tsx:103-110` is a safety timeout that force-flips `isDataReady` to `true` after 8 seconds. This masks slow listeners and contradicts the per-panel loading model from Task 3.

**Files:**
- Modify: `src/App.tsx:103-110` (remove timer), `:179-188` (the `isDataReady` loading screen — simplify), the cleanup at `:196-208` (drop `clearTimeout(fallbackTimer)`)

- [ ] **Step 1: Delete the timer**

Edit `src/App.tsx`. Remove lines 103-110 (the `setTimeout` block) and remove `clearTimeout(fallbackTimer)` from the cleanup. Also remove the `if (authLoading) return () => clearTimeout(fallbackTimer);` early-return.

- [ ] **Step 2: Replace the global loading screen with an immediate render + per-panel loading**

The global `isDataReady` gate at `App.tsx:179-188` is now driven only by the `users` listener firing once. Keep this minimal — the user must be authenticated and their role known before we render anything. But the panel-level data is no longer waited on; each panel surfaces its own skeleton via the hook's `loading` flag.

Edit the loading-screen block at `App.tsx:179-188` to keep it as-is (it just waits for `users`/teachers). Inside each panel, where lists were previously assumed populated, add inline `loading` checks. Example for `TeacherDashboard`:

```tsx
const { data: sessions, loading: sessionsLoading } = useSessions();
// ...
{sessionsLoading
  ? <div className="h-32 animate-pulse bg-gray-100 rounded" />
  : /* existing sessions UI */}
```

This is a per-panel sweep. Add at minimum one skeleton spot per major data dependency in each panel. Don't try to make every screen pixel-perfect — a single visible "loading…" or skeleton is acceptable.

- [ ] **Step 3: Manual smoke test on a slow network**

Run: `npm run dev`
In DevTools, throttle to "Slow 3G". Log in. Confirm the app shell appears immediately and individual panel sections show skeletons rather than a blank page.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/TeacherDashboard.tsx src/components/AdminPanel.tsx src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx
git commit -m "perf: remove 8s fallback timer; surface per-panel loading state"
```

---

## Task 5: Guard `testConnection()` in DEV only

`firebase.ts:25` invokes `testConnection()` at module load. The function does an extra `getDocFromServer(doc(db, 'test', 'connection'))` round-trip on every page load (`firebase.ts:16-23`). It only logs to console — no UI effect.

**Files:**
- Modify: `src/firebase.ts:25`

- [ ] **Step 1: Wrap the invocation in `import.meta.env.DEV`**

Edit `src/firebase.ts`. Replace line 25:

```ts
testConnection();
```

with:

```ts
if (import.meta.env.DEV) {
  testConnection();
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds. `dist/assets/*.js` no longer contains the string `'test/connection'` in the production bundle (it's tree-shaken when the `if` is false).

Verify: `grep -c "test/connection" dist/assets/*.js` → 0.

- [ ] **Step 3: Commit**

```bash
git add src/firebase.ts
git commit -m "perf: guard testConnection probe behind import.meta.env.DEV"
```

---

## Task 6: Self-host help-notification audio + add toast fallback

`TeacherDashboard.tsx:319` renders:

```tsx
<audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
```

and `TeacherDashboard.tsx:61` plays it via `audioRef.current.play().catch(e => console.warn("Audio play blocked", e))`. If mixkit.co is unreachable, the help signal is silent. If the browser blocks autoplay, the warning goes to console only — the user gets nothing.

**Files:**
- Create: `public/sounds/help-alert.mp3` (downloaded from mixkit)
- Modify: `src/components/TeacherDashboard.tsx:319` (change src)
- Modify: `src/components/TeacherDashboard.tsx:61` (also fire a toast on play attempt)

- [ ] **Step 1: Download the audio file**

Run from repo root:

```bash
mkdir -p public/sounds
curl -fSL "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" -o public/sounds/help-alert.mp3
ls -lah public/sounds/help-alert.mp3
```

Expected: file exists, ~50–200 KB. If the URL returns HTML (e.g. mixkit hotlink-protected), abort and find an alternative free CDN — note this assumption.

- [ ] **Step 2: Update the `<audio>` src**

Edit `src/components/TeacherDashboard.tsx:319`:

```tsx
<audio ref={audioRef} src="/sounds/help-alert.mp3" preload="auto" />
```

- [ ] **Step 3: Fire a toast in addition to playing audio**

This depends on Plan 3's `useToast()` having shipped. If Plan 3 has not yet landed, leave a TODO comment referencing this step and skip — but still update the audio path.

Edit `TeacherDashboard.tsx:61` (the line `audioRef.current.play().catch(...)`). Replace with:

```tsx
audioRef.current.play().catch((e) => console.warn('Audio play blocked', e));
toast.info(`Help requested: ${request.reason ?? 'unspecified'}`, { duration: 6000 });
```

Add `import { useToast } from './ui/Toast'` and `const toast = useToast();` near the top of the component if not already present.

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Trigger a help request from another tab/role. Confirm:
1. Audio plays from local asset.
2. Toast appears even if user has muted their device.

- [ ] **Step 5: Commit**

```bash
git add public/sounds/help-alert.mp3 src/components/TeacherDashboard.tsx
git commit -m "perf: self-host help alert audio + add visual toast fallback"
```

---

## Task 7: Add a one-shot bundle analyzer + document the target

To verify the work in Tasks 1-3 actually shrank the teacher bundle, add `rollup-plugin-visualizer` behind an env flag.

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Modify: `vite.config.ts` (conditionally add the plugin)

- [ ] **Step 1: Install the analyzer**

Run: `npm install -D rollup-plugin-visualizer`

Verify: `grep rollup-plugin-visualizer package.json` returns one line under devDependencies.

- [ ] **Step 2: Wire the plugin into `vite.config.ts` behind `process.env.ANALYZE`**

Edit `vite.config.ts`. Replace the existing file contents:

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const plugins: Plugin[] = [react(), tailwindcss()];
  if (process.env.ANALYZE) {
    plugins.push(
      visualizer({ filename: 'dist/stats.html', open: true, gzipSize: true, brotliSize: true }) as unknown as Plugin
    );
  }
  return {
    plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: { hmr: process.env.DISABLE_HMR !== 'true' },
  };
});
```

(Note: the `process.env.GEMINI_API_KEY` define is removed in Plan 2; if Plan 2 has shipped, drop that key from the `define` block here.)

- [ ] **Step 3: Add the `build:analyze` script**

Edit `package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "build:analyze": "ANALYZE=1 vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "eslint src --max-warnings=0 && tsc --noEmit",
    "test": "vitest run"
  }
}
```

(Adjust `lint` to match Plan 1's setup. Add `test` if Plan 1 hasn't already.)

- [ ] **Step 4: Run the analyzer and document baseline**

Run: `npm run build:analyze`
Expected: `dist/stats.html` opens in the browser. Note in this plan's notes section:
- Initial chunk size (gzipped): _record number_
- Largest chunk: _record name + size_
- TeacherDashboard chunk: _record size_
- AdminPanel chunk: _record size_
- Recharts chunk: _record size_

Target: TeacherDashboard initial-load total (initial chunk + TeacherDashboard chunk) ≤ 250 KB gzipped.

If above target: investigate the largest-non-Recharts contributor (likely `motion`, `date-fns`, `lucide-react`). For `lucide-react`, ensure named imports (already done — confirmed in `App.tsx:9`). For `date-fns`, switch to per-function imports (`date-fns/format` etc.). For `motion`, consider whether the cinematic stagger animations on every list item are worth the cost (Plan 8 addresses this with `useReducedMotion`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "build: add ANALYZE=1 build with rollup-plugin-visualizer"
```

---

## Notes & assumptions

1. The reviewer cited `TeacherDashboard.tsx:328` for the audio reference; the actual `<audio>` element is at line 319 and the `.play()` call is at line 61. This plan uses the actual lines.
2. `App.tsx` already silently swallows the `users` listener error (line 192) by setting `isDataReady=true` regardless. Task 4 keeps that behavior — the safety net here is deliberate, not accidental.
3. Mixkit's terms allow free use, but the URL returned an `assets.mixkit.co` 308 redirect last we checked. If `curl` fetches HTML instead of MP3, document the alternative source used.
4. Task 2 deliberately does NOT change chart colors substantially — color-blind-safe palette work is in Plan 10. The minimal swap (replacing the second blue with orange) is a cheap correctness fix that doesn't conflict with that plan.
5. Bundle target (≤250 KB gzipped initial JS for teacher session) is a stretch goal, not a hard gate. If we land at 280 KB, that's still a ~70% reduction from baseline.
6. Task 3 step 8 keeps optimistic-update behavior for `assignments` because `AdminPanel.tsx` writes to that collection from many places. This avoids a wider refactor.
7. The `lockedDates` state at `App.tsx:33` is currently unused (always `[]`); Plan 9's dedup work may delete it. Ignore it here.
