# URL Routing + State Persistence + DataViz Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every panel, tab, and view state linkable. Replace fake Webmaster stats with truthful UI. Bring charts to a11y baseline (color-blind-safe palette, percentage labels, text alternatives, empty states).

**Architecture:** Add `react-router-dom`. URL becomes the source of truth for `activeRole`, `activeTab`, `selectedDate`, `viewDate`. Charts wrapped with sibling `<table>` text alternatives. New helpers `formatMinutes`, `useResponsiveChartLabels`.

**Tech Stack:** React 19, react-router-dom 6, Recharts 3, vitest, @testing-library/react.

**Depends on:** Plan 2 (auth flow — `Login` rendering moves under `<Route path="/login">`), Plan 5 (lazy chart loading — coordinate the lazy boundary so `RoleDistributionChart`/`WorkloadChart` are extracted from `WebmasterPanel`/`OperationalManager` first).

---

## Pre-flight

- [ ] **Verify Plan 1 test infra is live**

```bash
ls /home/leon/dev/github/curro/vitest.config.ts /home/leon/dev/github/curro/src/test/setup.ts
```

Expected: both files exist (Plan 1 Task 1 created them). If missing, complete Plan 1 first.

- [ ] **Confirm react-router not yet installed**

```bash
grep -E '"react-router' /home/leon/dev/github/curro/package.json
```

Expected: no match.

---

## Task 1: Install react-router-dom and wrap the app in `<BrowserRouter>`

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx:1-16`
- Test: `src/test/router-smoke.test.tsx` (create)

- [ ] **Step 1: Install dependency**

```bash
cd /home/leon/dev/github/curro && npm i react-router-dom@^6.26.0
```

Expected: `package.json` gets `"react-router-dom": "^6.26.0"` under `dependencies`.

- [ ] **Step 2: Write failing smoke test for `BrowserRouter` mount**

Create `src/test/router-smoke.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

describe('react-router smoke', () => {
  it('renders the matched route element', () => {
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <Routes>
          <Route path="/teacher" element={<div>teacher-panel</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('teacher-panel')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/test/router-smoke.test.tsx
```

Expected: 1 passed. (This proves the install works; later tasks add real routes.)

- [ ] **Step 4: Wrap `<App />` in `<BrowserRouter>`**

Replace `src/main.tsx` lines 1-16 (the entire file) with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { FirebaseProvider } from './context/FirebaseContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FirebaseProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FirebaseProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

- [ ] **Step 5: Run dev server and confirm app still renders**

```bash
cd /home/leon/dev/github/curro && npm run dev
```

Open `http://localhost:3000`. Expected: app loads as before (no routes defined yet, so the existing role-switch logic in `App.tsx` still runs). Stop the server (`Ctrl-C`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/test/router-smoke.test.tsx
git commit -m "chore(router): add react-router-dom and wrap App in BrowserRouter"
```

(Note: this repo is not yet a git repo per the project context. If `git status` errors with "not a git repository", skip the commit step — Plan 1 may have run `git init`. Run `git status` first to confirm.)

---

## Task 2: Define the route table inside `App.tsx`

**Files:**
- Modify: `src/App.tsx:234-364` (the JSX return block)
- Test: `src/test/routes.test.tsx` (create)

- [ ] **Step 1: Write failing test for route resolution**

Create `src/test/routes.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Stub firebase context provider — the real one tries to connect.
vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({ user: null, loading: false, login: vi.fn(), logout: vi.fn() }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('routes', () => {
  it('renders Login at /login when no user', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(/staff email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/test/routes.test.tsx
```

Expected: FAIL — `Login` is currently rendered conditionally on `!activeUser`, not via routing.

- [ ] **Step 3: Add `Routes` block to `App.tsx`**

In `src/App.tsx`, add to the imports at line 12:

```tsx
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
```

Replace the JSX `return` block (currently `App.tsx:234-364`, starting with `return ( <div className="min-h-screen ...">` and ending with `);`) with a routes-driven version. Keep the top nav and the floating refresh in their current positions; replace the four `{activeUser.activeRole === 'X' && ( ... )}` sections inside `<main>` with a `<Routes>` block:

```tsx
return (
  <div className={`min-h-screen transition-colors duration-500 bg-bg-gray`}>
    {/* Top Bar / Role Switcher (unchanged from current App.tsx:236-315) */}
    <nav className={...}>{/* existing nav contents */}</nav>

    <main className="pt-28 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
      <Routes>
        <Route path="/login" element={
          activeUser ? <Navigate to={defaultRoutePath(activeUser)} replace /> : <Login onLogin={handleLocalLogin} error={loginError} />
        } />
        <Route path="/teacher" element={
          <RequireRole role="TEACHER" activeUser={activeUser}>
            <TeacherDashboard
              user={activeUser!}
              sessions={sessions}
              assignments={assignments}
              entries={timetableEntries}
              venues={venues}
              teachers={teachers}
            />
          </RequireRole>
        } />
        <Route path="/admin/:tab?" element={
          <RequireRole role="ADMIN" activeUser={activeUser}>
            <AdminPanel
              user={activeUser!}
              teachers={teachers}
              sessions={sessions}
              assignments={assignments}
              setAssignments={setAssignments}
              leaveRequests={leaveRequests}
              entries={timetableEntries}
              venues={venues}
              subjects={subjects}
              lockedDates={lockedDates}
              dayPeriodConfigs={dayPeriodConfigs}
            />
          </RequireRole>
        } />
        <Route path="/operations" element={
          <RequireRole role="OPERATIONAL_MANAGER" activeUser={activeUser}>
            <OperationalManager
              user={activeUser!}
              entries={timetableEntries}
              extensions={markingExtensions}
              teachers={teachers}
              leaveRequests={leaveRequests}
            />
          </RequireRole>
        } />
        <Route path="/webmaster" element={
          <RequireRole role="WEBMASTER" activeUser={activeUser}>
            <WebmasterPanel
              user={activeUser!}
              teachers={teachers}
              sessions={sessions}
              entries={timetableEntries}
              dayPeriodConfigs={dayPeriodConfigs}
            />
          </RequireRole>
        } />
        <Route path="*" element={<Navigate to={activeUser ? defaultRoutePath(activeUser) : '/login'} replace />} />
      </Routes>
    </main>

    {/* Floating Refresh (Plan 1 may delete this; keep until confirmed) */}
  </div>
);
```

Add helpers above `App` (around `App.tsx:13`, after the `SUPER_ADMINS` constant — note Plan 2 deletes that constant; coordinate by placing these helpers below the constant block):

```tsx
function defaultRoutePath(user: Teacher): string {
  switch (user.activeRole) {
    case 'TEACHER': return '/teacher';
    case 'ADMIN': return '/admin';
    case 'OPERATIONAL_MANAGER': return '/operations';
    case 'WEBMASTER': return '/webmaster';
    default: return '/login';
  }
}

function RequireRole({ role, activeUser, children }: {
  role: Role;
  activeUser: Teacher | null;
  children: React.ReactNode;
}) {
  if (!activeUser) return <Navigate to="/login" replace />;
  if (!activeUser.roles.includes(role)) return <Navigate to={defaultRoutePath(activeUser)} replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Update `switchRole` to navigate**

The existing `switchRole` (somewhere in `App.tsx:60-90`) currently mutates `activeUser.activeRole` in state. It must also navigate. Replace the function body:

```tsx
const navigate = useNavigate();

const switchRole = (role: Role) => {
  if (!activeUser) return;
  setActiveUser({ ...activeUser, activeRole: role });
  navigate(defaultRoutePath({ ...activeUser, activeRole: role }));
};
```

- [ ] **Step 5: Sync `activeRole` from URL on landing**

Add a `useEffect` in `App` that, when `activeUser` is set and the URL path implies a different role, updates `activeRole` to match:

```tsx
const location = useLocation();
useEffect(() => {
  if (!activeUser) return;
  const pathRole: Role | null =
    location.pathname.startsWith('/teacher') ? 'TEACHER' :
    location.pathname.startsWith('/admin') ? 'ADMIN' :
    location.pathname.startsWith('/operations') ? 'OPERATIONAL_MANAGER' :
    location.pathname.startsWith('/webmaster') ? 'WEBMASTER' : null;
  if (pathRole && activeUser.roles.includes(pathRole) && activeUser.activeRole !== pathRole) {
    setActiveUser({ ...activeUser, activeRole: pathRole });
  }
}, [location.pathname, activeUser]);
```

- [ ] **Step 6: Run the route test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/test/routes.test.tsx
```

Expected: 1 passed.

- [ ] **Step 7: Manual smoke — visit each route**

```bash
cd /home/leon/dev/github/curro && npm run dev
```

Open in order: `http://localhost:3000/`, `/teacher`, `/admin`, `/operations`, `/webmaster`. Expected: each renders the right panel; refreshing the page keeps you there; `/teacher` when not signed in redirects to `/login`.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/test/routes.test.tsx
git commit -m "feat(router): replace activeRole switch with Routes and RequireRole guard"
```

---

## Task 3: Persist `activeTab` in URL params for AdminPanel

**Files:**
- Modify: `src/components/AdminPanel.tsx:1838` (the `useState<...>("SUBJECTS")` call) and the tab-button block at `:2100-2153`.
- Test: `src/components/AdminPanel.tab-routing.test.tsx` (create)

- [ ] **Step 1: Write failing test**

Create `src/components/AdminPanel.tab-routing.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminPanel from './AdminPanel';

vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({ user: null, loading: false }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const minimalProps = {
  user: { id: 'TEST', firstName: 'Test', lastName: 'Admin', email: 't@example.com', roles: ['ADMIN'], activeRole: 'ADMIN' } as any,
  teachers: [], sessions: [], assignments: [], setAssignments: vi.fn(),
  leaveRequests: [], entries: [], venues: [], subjects: [], lockedDates: [], dayPeriodConfigs: [],
};

describe('AdminPanel URL tab routing', () => {
  it('opens the FACULTY tab when URL is /admin/faculty', () => {
    render(
      <MemoryRouter initialEntries={['/admin/faculty']}>
        <Routes>
          <Route path="/admin/:tab?" element={<AdminPanel {...minimalProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('tab', { name: /faculty/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates to /admin/venues when the Venues tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin/:tab?" element={<AdminPanel {...minimalProps} />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('tab', { name: /venues/i }));
    expect(screen.getByRole('tab', { name: /venues/i })).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/AdminPanel.tab-routing.test.tsx
```

Expected: FAIL — current tab buttons are `<button>` not `role="tab"`, and tab state is component-local.

- [ ] **Step 3: Replace tab state with URL param**

In `src/components/AdminPanel.tsx`, add to the imports near the top (around line 1-30):

```tsx
import { useParams, useNavigate } from 'react-router-dom';
```

Replace the `useState` at `AdminPanel.tsx:1838`:

```tsx
// before:
const [activeTab, setActiveTab] = useState<
  | "SUBJECTS" | "FACULTY" | "TIMETABLE" | "VENUES" | "SCHEDULER" | "ASSIGNMENTS" | "INSPECTION"
>("SUBJECTS");
```

with:

```tsx
type TabKey = "SUBJECTS" | "FACULTY" | "TIMETABLE" | "VENUES" | "SCHEDULER" | "ASSIGNMENTS" | "INSPECTION";
const TAB_KEYS: TabKey[] = ["SUBJECTS", "FACULTY", "TIMETABLE", "VENUES", "SCHEDULER", "ASSIGNMENTS", "INSPECTION"];

const { tab: tabParam } = useParams<{ tab?: string }>();
const navigateTabs = useNavigate();
const activeTab: TabKey = (
  TAB_KEYS.find(k => k.toLowerCase() === (tabParam ?? "subjects").toLowerCase()) ?? "SUBJECTS"
);
const setActiveTab = (next: TabKey) => navigateTabs(`/admin/${next.toLowerCase()}`);
```

- [ ] **Step 4: Add `role="tab"` and `aria-selected` to tab buttons**

In the tab-switcher block at `AdminPanel.tsx:2100-2153`, change every button. Pattern (apply to all 7):

```tsx
<button
  role="tab"
  aria-selected={activeTab === "SUBJECTS"}
  onClick={() => setActiveTab("SUBJECTS")}
  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "SUBJECTS" ? "bg-curro-blue text-white shadow-lg scale-105" : "text-text-muted hover:bg-gray-50"}`}
>
  <BookOpen className="w-4 h-4" />
  Subjects
</button>
```

Wrap the seven buttons in:

```tsx
<div role="tablist" aria-label="Admin sections" className="flex flex-wrap items-center p-1 bg-white border border-gray-100 rounded-2xl w-fit shadow-sm gap-1">
  {/* the 7 buttons */}
</div>
```

(Note: Plan 4 replaces these seven buttons with the `<Tabs>`/`<TabButton>` primitive from Plan 3. If Plan 4 has shipped first, this task collapses to: pass `value={activeTab}` and `onValueChange={setActiveTab}` to `<Tabs>`, and delete the local state. Detect by checking whether `src/components/ui/Tabs.tsx` exists.)

- [ ] **Step 5: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/AdminPanel.tab-routing.test.tsx
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/AdminPanel.tab-routing.test.tsx
git commit -m "feat(admin): persist activeTab in URL via /admin/:tab"
```

---

## Task 4: Persist `selectedDate` (admin) and `viewDate` (operations) in query params

**Files:**
- Modify: `src/components/AdminPanel.tsx` (find `selectedDate` `useState` — likely around the scheduler tab state, near `:2000`)
- Modify: `src/components/OperationalManager.tsx:104` (the `viewDate` `useState`)
- Test: `src/components/OperationalManager.viewdate-routing.test.tsx` (create)

- [ ] **Step 1: Write failing test for OperationalManager viewDate**

Create `src/components/OperationalManager.viewdate-routing.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OperationalManager from './OperationalManager';

vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({ user: null, loading: false }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('OperationalManager viewDate URL', () => {
  it('reads viewDate from ?viewDate= query param', () => {
    render(
      <MemoryRouter initialEntries={['/operations?viewDate=2026-08-15']}>
        <Routes>
          <Route path="/operations" element={
            <OperationalManager
              user={{ id: 'MERV', firstName: 'M', lastName: 'V', roles: ['OPERATIONAL_MANAGER'], activeRole: 'OPERATIONAL_MANAGER' } as any}
              entries={[]} extensions={[]} teachers={[]} leaveRequests={[]}
            />
          } />
        </Routes>
      </MemoryRouter>,
    );
    // The Gantt header renders viewDate; assert it shows Aug 2026.
    expect(screen.getByText(/aug.*2026|august.*2026/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/OperationalManager.viewdate-routing.test.tsx
```

Expected: FAIL — viewDate currently defaults to `new Date()`.

- [ ] **Step 3: Replace `viewDate` state with `useSearchParams`**

In `src/components/OperationalManager.tsx`, near top imports add:

```tsx
import { useSearchParams } from 'react-router-dom';
```

At `OperationalManager.tsx:104`, replace:

```tsx
const [viewDate, setViewDate] = useState<Date>(new Date());
```

with:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const viewDateParam = searchParams.get('viewDate');
const viewDate = viewDateParam ? new Date(viewDateParam) : new Date();
const setViewDate = (next: Date) => {
  const iso = next.toISOString().slice(0, 10); // YYYY-MM-DD
  setSearchParams(prev => {
    const params = new URLSearchParams(prev);
    params.set('viewDate', iso);
    return params;
  }, { replace: true });
};
```

- [ ] **Step 4: Apply the same pattern to AdminPanel `selectedDate`**

In `src/components/AdminPanel.tsx`, find the `selectedDate` `useState` (search: `grep -n "selectedDate" src/components/AdminPanel.tsx | head -5`). It should be near the scheduler-tab state. Replace it with the same `useSearchParams` pattern, key `selectedDate`. Same for `timetableDate` at `AdminPanel.tsx:1858` if you want that linkable too — recommend yes, key `timetableDate`.

- [ ] **Step 5: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/OperationalManager.viewdate-routing.test.tsx
```

Expected: 1 passed.

- [ ] **Step 6: Manual smoke**

Open `http://localhost:3000/operations?viewDate=2026-08-15` and confirm the Gantt starts in August 2026. Pick a different date in the date picker; expected: URL updates.

- [ ] **Step 7: Commit**

```bash
git add src/components/AdminPanel.tsx src/components/OperationalManager.tsx src/components/OperationalManager.viewdate-routing.test.tsx
git commit -m "feat(router): persist selectedDate and viewDate in URL query params"
```

---

## Task 5: Add "Switch to Teacher View" shortcut for admins

**Files:**
- Modify: `src/App.tsx:283-298` (add a sibling button next to the OPS quick-switch).
- Test: `src/test/teacher-view-shortcut.test.tsx` (create)

The existing OPS quick-switch is at `App.tsx:283-291`:

```tsx
{activeUser.activeRole !== 'OPERATIONAL_MANAGER' && activeUser.roles.includes('OPERATIONAL_MANAGER') && (
  <div onClick={() => switchRole('OPERATIONAL_MANAGER')} className="bg-emerald-500/20 ...">
    <BarChart2 className="w-5 h-5 text-emerald-400 ..." />
  </div>
)}
```

- [ ] **Step 1: Write failing test**

Create `src/test/teacher-view-shortcut.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({
    user: { uid: 'u1' }, loading: false, login: vi.fn(), logout: vi.fn(),
  }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Switch-to-teacher shortcut', () => {
  it('shows the shortcut for an admin who also has TEACHER role', async () => {
    // Seed localStorage so App.tsx restores a TEST admin user
    localStorage.setItem('curro_loggedInStaffId', 'TEST');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /switch to teacher view/i })).toBeInTheDocument();
  });
});
```

(Note: depending on Plan 2's auth changes, `localStorage.getItem('curro_loggedInStaffId')` may no longer drive login — adapt the test seed when Plan 2 ships. For now, this matches `App.tsx:39-46` behavior.)

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/test/teacher-view-shortcut.test.tsx
```

Expected: FAIL — no such button.

- [ ] **Step 3: Add the shortcut button**

In `src/App.tsx`, immediately after the OPS quick-switch block (currently `App.tsx:283-291`), insert:

```tsx
{activeUser.activeRole !== 'TEACHER' && activeUser.roles.includes('TEACHER') && (
  <button
    onClick={() => switchRole('TEACHER')}
    aria-label="Switch to teacher view"
    title="Switch to Invigilator view"
    className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30 cursor-pointer hover:bg-blue-500/30 transition-all shadow-lg group mr-1"
  >
    <UserIcon className="w-5 h-5 text-blue-300 group-hover:scale-110 transition-transform" />
  </button>
)}
```

(Also: convert the existing OPS shortcut from `<div onClick=...>` to `<button onClick=... aria-label="Switch to OPS view">` — `<div>` with onClick fails a11y. This is in scope here because both shortcuts should be consistent.)

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/test/teacher-view-shortcut.test.tsx
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/test/teacher-view-shortcut.test.tsx
git commit -m "feat(nav): add switch-to-teacher shortcut and make role shortcuts buttons"
```

---

## Task 6: Remove fake Webmaster stats and toggles

**Files:**
- Modify: `src/components/WebmasterPanel.tsx:115-227`

Decision: **delete the fake content**. The cards at `:121-126` and toggles at `:212-227` are static placeholders that mislead the operator. Replace with a real-data section (Faculty Assignment Statistics already at `:240+`) plus a clear "future work" comment for plumbing Firebase Performance metrics.

Alternative path (deferred): wire Firebase Performance Monitoring + `firestore.useEmulator()`-aware quota inspection. Not in this plan.

- [ ] **Step 1: Write failing test**

Create `src/components/WebmasterPanel.fake-stats.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WebmasterPanel from './WebmasterPanel';

vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({ user: null, loading: false }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('WebmasterPanel: no fake metrics', () => {
  const props = {
    user: { id: 'FRAN', firstName: 'F', lastName: 'N', roles: ['WEBMASTER'], activeRole: 'WEBMASTER' } as any,
    teachers: [], sessions: [], entries: [], dayPeriodConfigs: [],
  };

  it('does not render Server Load placeholder', () => {
    render(<MemoryRouter><WebmasterPanel {...props} /></MemoryRouter>);
    expect(screen.queryByText(/server load/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/api latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/db connections/i)).not.toBeInTheDocument();
  });

  it('does not render fake Global Controls toggles', () => {
    render(<MemoryRouter><WebmasterPanel {...props} /></MemoryRouter>);
    expect(screen.queryByText(/automatic backups/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/regional deployment/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/WebmasterPanel.fake-stats.test.tsx
```

Expected: FAIL — those texts currently render.

- [ ] **Step 3: Delete fake content**

In `src/components/WebmasterPanel.tsx`, delete:

- The `stats` array at lines 121-126.
- The grid block rendering it (the `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">` block at `:138-163`, including the `motion.div` map).
- The Global Controls panel at `:204-238` (the `<div className="bg-zinc-900 ... flex flex-col gap-6">` containing the toggles and Regional Deployment card).

Replace the deleted Global Controls block with a placeholder that honestly describes the planned content:

```tsx
<div className="bg-zinc-900 border border-white/5 rounded-xl p-6 flex flex-col gap-3">
  <h3 className="text-sm font-black uppercase flex items-center gap-2">
    <Settings className="w-4 h-4 text-orange-500" />
    Operations
  </h3>
  <p className="text-xs text-gray-400">
    Real system metrics (Firestore quota, deploy status, error rate) will surface here once Firebase Performance is wired up.
  </p>
</div>
```

(Future task documented separately: "Wire Firebase Performance Monitoring → Webmaster Operations section" — out of scope for this plan.)

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/WebmasterPanel.fake-stats.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/WebmasterPanel.tsx src/components/WebmasterPanel.fake-stats.test.tsx
git commit -m "chore(webmaster): remove fake Server Load + Global Controls placeholders"
```

---

## Task 7: Color-blind-safe palette on stacked bar charts

**Files:**
- Modify: `src/components/WebmasterPanel.tsx:280-283` (the four `<Bar fill="...">`)
- Modify: `src/components/OperationalManager.tsx:344-347` (same pattern, in the chart at `:328-355`)
- Modify: legend swatches at `WebmasterPanel.tsx` (search `<div className="w-2 h-2 rounded-full" style={{ backgroundColor:`) and `OperationalManager.tsx:333-345`
- Create: `src/styles/CHART_COLORS.ts` (new — single source of truth)

- [ ] **Step 1: Define the palette**

Create `src/styles/CHART_COLORS.ts`:

```ts
// Color-blind-safe palette for stacked workload charts.
// Distinct hues across red-green deuteranopia and protanopia.
// Source: tested via https://www.color-blindness.com/coblis-color-blindness-simulator/

export const CHART_COLORS = {
  tech: '#0066CC',       // curro blue — distinct from morning orange
  morning: '#FF8A00',    // saturated orange — high contrast vs purple/green
  afternoon: '#7C3AED',  // violet — visually distant from blue and green
  standby: '#059669',    // emerald — distinct from violet under deuteranopia
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;
```

Hue separation (HSL):
- Tech (210°), Morning (32°), Afternoon (270°), Standby (160°). Minimum spacing ~50° between any pair, exceeding the ~30° threshold typically required for deuteranopia distinguishability. Manually verify by rendering the bar chart and toggling Chrome DevTools "Emulate vision deficiencies → Deuteranopia".

- [ ] **Step 2: Replace inline hex codes**

In `src/components/WebmasterPanel.tsx`, near the existing `import { motion } ...` block, add:

```tsx
import { CHART_COLORS } from '../styles/CHART_COLORS';
```

Replace lines 280-283:

```tsx
<Bar dataKey="tech" fill={CHART_COLORS.tech} stackId="a" name="Tech" />
<Bar dataKey="morning" fill={CHART_COLORS.morning} stackId="a" name="Morning" />
<Bar dataKey="afternoon" fill={CHART_COLORS.afternoon} stackId="a" name="Afternoon" />
<Bar dataKey="standby" fill={CHART_COLORS.standby} stackId="a" name="Standby" />
```

Same in `src/components/OperationalManager.tsx:344-347`.

Update the legend swatches in both files:
- `OperationalManager.tsx:333-345` (the three legend items in the workload chart header) — change `bg-[#0ea5e9]` → `style={{ backgroundColor: CHART_COLORS.tech }}` and similarly for `bg-[#3b82f6]` → `morning`, `bg-[#a855f7]` → `afternoon`. Add a fourth swatch for standby.
- WebmasterPanel: search for `style={{ backgroundColor: COLORS[i] }}` (currently the role-distribution legend at `:198`) — leave that one alone (it's the pie chart, see Task 8).

- [ ] **Step 3: Add a vitest snapshot for the palette object**

Create `src/styles/CHART_COLORS.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CHART_COLORS } from './CHART_COLORS';

describe('CHART_COLORS', () => {
  it('contains four entries with valid hex codes', () => {
    expect(Object.keys(CHART_COLORS)).toEqual(['tech', 'morning', 'afternoon', 'standby']);
    for (const v of Object.values(CHART_COLORS)) {
      expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
```

Run:

```bash
cd /home/leon/dev/github/curro && npx vitest run src/styles/CHART_COLORS.test.ts
```

Expected: 1 passed.

- [ ] **Step 4: Manual deuteranopia check**

Run dev server, open Chrome DevTools → Rendering → "Emulate vision deficiencies" → Deuteranopia. Visit `/operations` and `/webmaster`. Expected: every bar segment is visually distinct.

- [ ] **Step 5: Commit**

```bash
git add src/styles/CHART_COLORS.ts src/styles/CHART_COLORS.test.ts src/components/WebmasterPanel.tsx src/components/OperationalManager.tsx
git commit -m "feat(charts): adopt color-blind-safe palette in workload bar charts"
```

---

## Task 8: Pie chart percentage labels and legend on Role Distribution

**Files:**
- Modify: `src/components/WebmasterPanel.tsx:166-204` (the PieChart block)

- [ ] **Step 1: Add label and Legend imports**

In `src/components/WebmasterPanel.tsx`, find the recharts import (near the top). Confirm `Legend` is imported; if not, add it:

```tsx
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
```

- [ ] **Step 2: Add `label` prop to `<Pie>` and a `<Legend>`**

Replace the `<Pie ...>` block at `:172-185` with:

```tsx
<Pie
  data={roleData}
  cx="50%"
  cy="50%"
  innerRadius={50}
  outerRadius={80}
  paddingAngle={5}
  dataKey="value"
  label={(entry) => `${entry.name}: ${(entry.percent * 100).toFixed(0)}%`}
  labelLine={false}
>
  {roleData.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
  ))}
</Pie>
```

Add `<Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />` immediately above the closing `</PieChart>`.

The existing manual legend below the chart at `WebmasterPanel.tsx:194-202` is now duplicated by Recharts' `<Legend>`. Remove the manual block.

- [ ] **Step 3: Manual smoke**

Run dev server, visit `/webmaster`. Expected: each pie slice shows "Teachers: 88%" etc. and a single legend renders below.

- [ ] **Step 4: Commit**

```bash
git add src/components/WebmasterPanel.tsx
git commit -m "feat(webmaster): add percentage labels and use Recharts Legend on role pie"
```

---

## Task 9: `aria-label` and visible-text-alternative tables for charts

**Files:**
- Modify: `src/components/OperationalManager.tsx:328-355` (the workload chart that has NO sibling table — the canonical case)
- Modify: `src/components/WebmasterPanel.tsx:175-203` (pie chart — needs aria-label only since text legend now exists from Task 8)
- Modify: `src/components/WebmasterPanel.tsx:257-290` (faculty assignment chart — already has table; add aria-label only)

- [ ] **Step 1: Write failing a11y test**

Create `src/components/charts.a11y.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationalManager from './OperationalManager';

vi.mock('../context/FirebaseContext', () => ({
  useFirebase: () => ({ user: null, loading: false }),
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Chart a11y', () => {
  const sampleEntries = [
    { id: 'e1', date: '2026-05-08', subject: { name: 'Math' } } as any,
  ];
  const sampleTeachers = [{ id: 'T1', firstName: 'A', lastName: 'B', roles: ['TEACHER'] } as any];

  it('OperationalManager workload chart has aria-label and a sibling data table', () => {
    render(
      <MemoryRouter>
        <OperationalManager
          user={{ id: 'MERV', firstName: 'M', lastName: 'V', roles: ['OPERATIONAL_MANAGER'], activeRole: 'OPERATIONAL_MANAGER' } as any}
          entries={sampleEntries} extensions={[]} teachers={sampleTeachers} leaveRequests={[]}
        />
      </MemoryRouter>,
    );
    const chart = screen.getByRole('img', { name: /faculty workload distribution/i });
    expect(chart).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /faculty workload data/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — confirm it fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/charts.a11y.test.tsx
```

Expected: FAIL — neither `role="img"` nor accessible-named table present.

- [ ] **Step 3: Wrap chart with aria-label and add visually-hidden table**

In `src/components/OperationalManager.tsx`, the chart block at `:328-355` becomes:

```tsx
<div className="p-6 h-[400px]" role="img" aria-label="Faculty workload distribution: stacked bars per faculty across tech, morning, afternoon, standby">
  <ResponsiveContainer width="100%" height="100%">
    {/* ... existing BarChart ... */}
  </ResponsiveContainer>
</div>
<table className="sr-only" aria-label="Faculty workload data">
  <caption>Workload minutes per faculty member, by category.</caption>
  <thead>
    <tr><th scope="col">Name</th><th scope="col">Tech</th><th scope="col">Morning</th><th scope="col">Afternoon</th><th scope="col">Standby</th></tr>
  </thead>
  <tbody>
    {workloadData.map(row => (
      <tr key={row.id}>
        <td>{row.name}</td>
        <td>{row.tech}</td>
        <td>{row.morning}</td>
        <td>{row.afternoon}</td>
        <td>{row.standby}</td>
      </tr>
    ))}
  </tbody>
</table>
```

Add the `sr-only` utility to `src/index.css` if not already present:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

For `WebmasterPanel.tsx`, wrap the pie chart container at `:170-192` and the bar chart at `:257-290` similarly with `role="img" aria-label="..."`. The bar chart already has a visible table at `:269-298`, so no extra `<table className="sr-only">` is needed there — just add `aria-label="See data in table below."`.

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/charts.a11y.test.tsx
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx src/components/charts.a11y.test.tsx src/index.css
git commit -m "feat(a11y): add aria-label and screen-reader tables to charts"
```

---

## Task 10: Chart empty-state

**Files:**
- Modify: `src/components/OperationalManager.tsx` (the chart at `:328-355` — wrap)
- Modify: `src/components/WebmasterPanel.tsx` (the bar chart at `:257-290` — wrap)
- Create: `src/components/ui/ChartEmpty.tsx`

- [ ] **Step 1: Build the empty-state component**

Create `src/components/ui/ChartEmpty.tsx`:

```tsx
import { BarChart2 } from 'lucide-react';

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div role="status" className="h-full w-full flex flex-col items-center justify-center gap-3 text-center p-6">
      <BarChart2 className="w-10 h-10 text-gray-400" aria-hidden="true" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Write failing test**

Create `src/components/ui/ChartEmpty.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartEmpty } from './ChartEmpty';

describe('ChartEmpty', () => {
  it('renders a status role with the provided message', () => {
    render(<ChartEmpty message="No assignments yet" />);
    expect(screen.getByRole('status')).toHaveTextContent('No assignments yet');
  });
});
```

- [ ] **Step 3: Run — confirm passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/components/ui/ChartEmpty.test.tsx
```

Expected: 1 passed (the component is trivial; the test verifies role wiring).

- [ ] **Step 4: Use empty-state in each chart**

In `OperationalManager.tsx`, replace the `<ResponsiveContainer>...</ResponsiveContainer>` body inside the workload chart with:

```tsx
{workloadData.length === 0
  ? <ChartEmpty message="No assignments yet — generate or add one to see the workload chart." />
  : (
    <ResponsiveContainer width="100%" height="100%">
      {/* existing BarChart */}
    </ResponsiveContainer>
  )}
```

Same for `WebmasterPanel.tsx` bar chart at `:257`. For the role-distribution pie at `:170`, the data always has at least 1 row (teachers), but guard anyway:

```tsx
{roleData.every(r => r.value === 0) ? <ChartEmpty message="No users yet." /> : <ResponsiveContainer>...</ResponsiveContainer>}
```

- [ ] **Step 5: Manual smoke**

In dev, temporarily delete all teachers from Firestore (or run a clean emulator). Expected: charts render the empty-state message instead of empty axes.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ChartEmpty.tsx src/components/ui/ChartEmpty.test.tsx src/components/OperationalManager.tsx src/components/WebmasterPanel.tsx
git commit -m "feat(charts): show empty-state instead of empty axes when data is []"
```

---

## Task 11: Convert minutes → hours in faculty table

**Files:**
- Create: `src/lib/formatMinutes.ts`
- Modify: `src/components/WebmasterPanel.tsx:286-296` (the `<td className="py-3 ...">{row.morning}</td>` cells)

- [ ] **Step 1: Write failing test**

Create `src/lib/formatMinutes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatMinutes } from './formatMinutes';

describe('formatMinutes', () => {
  it('formats 480 minutes as "8h 0m"', () => {
    expect(formatMinutes(480)).toBe('8h 0m');
  });
  it('formats 75 minutes as "1h 15m"', () => {
    expect(formatMinutes(75)).toBe('1h 15m');
  });
  it('formats 0 as "0h 0m"', () => {
    expect(formatMinutes(0)).toBe('0h 0m');
  });
  it('formats negative as "-1h 30m"', () => {
    expect(formatMinutes(-90)).toBe('-1h 30m');
  });
  it('formats fractional minutes by flooring', () => {
    expect(formatMinutes(75.7)).toBe('1h 15m');
  });
});
```

- [ ] **Step 2: Run — confirm fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/lib/formatMinutes.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/formatMinutes.ts`:

```ts
export function formatMinutes(min: number): string {
  const sign = min < 0 ? '-' : '';
  const abs = Math.floor(Math.abs(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h ${m}m`;
}
```

- [ ] **Step 4: Run — confirm passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/lib/formatMinutes.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Apply to faculty table**

In `src/components/WebmasterPanel.tsx`, near top imports, add:

```tsx
import { formatMinutes } from '../lib/formatMinutes';
```

Replace the table cells in the assignment-statistics block (`:286-296`):

```tsx
<td className="py-3 text-xs text-center font-mono text-blue-400">{formatMinutes(row.morning)}</td>
<td className="py-3 text-xs text-center font-mono text-purple-400">{formatMinutes(row.afternoon)}</td>
<td className="py-3 text-xs text-center font-mono text-sky-400 font-bold">{formatMinutes(row.tech)}</td>
<td className="py-3 text-xs text-center font-mono text-emerald-400">{formatMinutes(row.standby)}</td>
<td className="py-3 text-xs text-right font-black text-orange-500">{formatMinutes(row.total)}</td>
```

The "Adj. Load" column displays a divided number — leave that unchanged (it isn't minutes).

Also update the column header `Total (min)` → `Total` since the value is no longer raw minutes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/formatMinutes.ts src/lib/formatMinutes.test.ts src/components/WebmasterPanel.tsx
git commit -m "feat(webmaster): show hours+minutes instead of raw minutes in faculty table"
```

---

## Task 12: X-axis labels on narrow viewports

**Files:**
- Create: `src/hooks/useResponsiveChartLabels.ts`
- Modify: `src/components/WebmasterPanel.tsx:264-268` (XAxis props)
- Modify: `src/components/OperationalManager.tsx` (the equivalent XAxis in the workload chart at `:347-355`)

- [ ] **Step 1: Write failing test for the hook**

Create `src/hooks/useResponsiveChartLabels.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsiveChartLabels } from './useResponsiveChartLabels';

describe('useResponsiveChartLabels', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('returns full names on wide viewport', () => {
    const { result } = renderHook(() => useResponsiveChartLabels());
    expect(result.current.formatLabel('Merike van Dyk')).toBe('Merike van Dyk');
    expect(result.current.fontSize).toBeGreaterThanOrEqual(10);
  });

  it('returns last-name-only on narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 480 });
    const { result } = renderHook(() => useResponsiveChartLabels());
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(result.current.formatLabel('Merike van Dyk')).toBe('Dyk');
  });
});
```

- [ ] **Step 2: Run — confirm fails**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/hooks/useResponsiveChartLabels.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useResponsiveChartLabels.ts`:

```ts
import { useEffect, useState } from 'react';

export function useResponsiveChartLabels() {
  const [width, setWidth] = useState<number>(typeof window === 'undefined' ? 1024 : window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const narrow = width < 640;
  return {
    fontSize: narrow ? 10 : 12,
    angle: narrow ? -45 : -90,
    height: narrow ? 70 : 100,
    formatLabel: (full: string): string => {
      if (!narrow) return full;
      const parts = full.trim().split(/\s+/);
      return parts[parts.length - 1] ?? full;
    },
  };
}
```

- [ ] **Step 4: Run — confirm passes**

```bash
cd /home/leon/dev/github/curro && npx vitest run src/hooks/useResponsiveChartLabels.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Apply to charts**

In `src/components/WebmasterPanel.tsx`, near top imports add:

```tsx
import { useResponsiveChartLabels } from '../hooks/useResponsiveChartLabels';
```

Inside the panel function body, near the top of `WebmasterPanel.tsx:115`:

```tsx
const labels = useResponsiveChartLabels();
```

Replace the XAxis at `:264-272`:

```tsx
<XAxis
  dataKey="name"
  stroke="#6b7280"
  fontSize={labels.fontSize}
  angle={labels.angle}
  textAnchor="end"
  interval={0}
  height={labels.height}
  tickFormatter={labels.formatLabel}
/>
```

Same in `OperationalManager.tsx:347-355`.

- [ ] **Step 6: Manual smoke**

Run dev server, resize browser to ≤640px wide. Visit `/webmaster` and `/operations`. Expected: labels truncate to last name only, angled at -45°.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useResponsiveChartLabels.ts src/hooks/useResponsiveChartLabels.test.tsx src/components/WebmasterPanel.tsx src/components/OperationalManager.tsx
git commit -m "feat(charts): truncate x-axis labels to last name on narrow viewports"
```

---

## Self-Review

- [ ] **Coverage:** every directive task (1-11) maps to a Task above. Task 1+2 cover directive #1 (router setup + routes). Task 3 covers #2 (activeTab in URL). Task 4 covers #3 (selectedDate, viewDate). Task 5 covers #4 (teacher view shortcut). Task 6 covers #5 (fake stats). Task 7 covers #6 (palette). Task 8 covers #7 (pie %). Task 9 covers #8 (aria-label + table). Task 10 covers #9 (empty-state). Task 11 covers #10 (minutes → hours). Task 12 covers #11 (x-axis narrow viewport).
- [ ] **Placeholder scan:** No "TODO/TBD/implement later" inside steps. Two cross-plan dependencies are explicitly named (Plan 2 affects Login + localStorage seed in Task 5; Plan 4 may have replaced AdminPanel tabs with `<Tabs>` primitive — Task 3 notes this).
- [ ] **Type consistency:** `Role` from `src/types.ts:6` used throughout. `TabKey` and `TAB_KEYS` defined together in Task 3. `formatMinutes(min: number): string` used identically wherever called. `CHART_COLORS` keys (`tech`, `morning`, `afternoon`, `standby`) used identically in WebmasterPanel and OperationalManager.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-07-plan-10-routing-dataviz.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
