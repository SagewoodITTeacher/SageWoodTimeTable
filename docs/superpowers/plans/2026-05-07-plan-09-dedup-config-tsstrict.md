# Logic Dedup, Firestore Config, TypeScript Strict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three copies of the workload-calc logic, replace hardcoded staff-code lists with data on the Teacher document, move app config out of source code into Firestore, and turn on TypeScript strict mode.

**Architecture:** New `src/lib/workload.ts` as canonical implementation with full test suite. New `src/hooks/useAppConfig.ts` reading `config/main` Firestore doc. Migration script in `scripts/`. Strict TypeScript flags surface real bugs that have been hiding.

**Tech Stack:** TypeScript 5.8, Firebase 12, vitest, @firebase/rules-unit-testing, tsx.

**Depends on:** Plan 1 (vitest test infra), Plan 2 (real auth, since `canApproveExtensions` is now a privileged field), Plan 5 (per-panel hooks pattern).

---

## Pre-flight

- [ ] **Confirm Plan 1 has shipped:** `vitest.config.ts` and `src/test/setup.ts` exist; `package.json` has `"test": "vitest"`.

  Run: `test -f /home/leon/dev/github/curro/vitest.config.ts && test -f /home/leon/dev/github/curro/src/test/setup.ts && jq -r '.scripts.test' /home/leon/dev/github/curro/package.json`
  Expected: prints `vitest` (or similar). If anything is missing, complete Plan 1 first.

- [ ] **Confirm Plan 2 has shipped:** `firestore.rules` reads `users/{uid}.roles` for privileged operations; the `'CURRO'` shared password is gone.

  Run: `grep -n "request.auth.uid" /home/leon/dev/github/curro/firestore.rules`
  Expected: matches inside `isAdmin()` / `isOperationalManager()` / `isWebmaster()`. If absent, complete Plan 2 first.

---

## Task 1: Canonical Workload Library — `src/lib/workload.ts`

**Files:**
- Create: `src/lib/workload.ts`
- Create: `src/lib/workload.test.ts`

The three current implementations differ:

- `WebmasterPanel.tsx:74-78` treats specialists as IT (`FRAN, JACB, NORT, ORMA`) + LS (`CHAM, EZNY, ORIM, CPMO, ENYA`) + Art (`SHEH, SHHU`).
- `OperationalManager.tsx:74-79` treats specialists as `JACB, SHHU, CPMO, ENYA, ORMA` only (note: missing IT/LS/Art split).
- `AdminPanel.tsx:216-225` defines `isITSpecialistTeacher`, `isLSSpecialistTeacher`, `isArtSpecialistTeacher` matching WebmasterPanel.

The canonical API takes the **union** (AdminPanel + WebmasterPanel) — Operations is a strict subset and was inadvertently undercounting.

- [ ] **Step 1: Write the failing test for the basic shape**

```typescript
// src/lib/workload.test.ts
import { describe, expect, it } from 'vitest';
import { computeWorkload } from './workload';
import type { Teacher, TimetableEntry } from '../types';

const t = (id: string, overrides: Partial<Teacher> = {}): Teacher => ({
  id,
  firstName: id,
  lastName: id,
  roles: ['TEACHER'],
  activeRole: 'TEACHER',
  totalHours: 0,
  ...overrides,
});

describe('computeWorkload', () => {
  it('returns one entry per included teacher with all minute buckets at zero when no entries', () => {
    const teachers = [t('AAAA'), t('BBBB')];
    const result = computeWorkload(teachers, [], []);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'AAAA',
      morning: 0,
      afternoon: 0,
      tech: 0,
      standby: 0,
      total: 0,
      adjTotal: 0,
      loadWeight: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/workload.test.ts`
Expected: FAIL with "Cannot find module './workload'".

- [ ] **Step 3: Write the minimal `computeWorkload` skeleton to pass step 1**

```typescript
// src/lib/workload.ts
import { format, parseISO } from 'date-fns';
import { PERIODS, WEDNESDAY_PERIODS } from '../constants';
import type { DayPeriodConfig, Teacher, TimetableEntry } from '../types';

export interface WorkloadRow {
  id: string;
  firstName: string;
  lastName: string;
  name: string;          // "Last, First"
  morning: number;       // minutes
  afternoon: number;
  tech: number;
  standby: number;
  total: number;         // morning+afternoon+tech+standby
  loadWeight: number;    // 0.7 for specialists, 1 otherwise
  adjTotal: number;      // round(total / loadWeight)
  category: 'specialist' | 'standard' | 'excluded';
}

export function computeWorkload(
  teachers: Teacher[],
  entries: TimetableEntry[],
  dayPeriodConfigs: DayPeriodConfig[],
): WorkloadRow[] {
  const morning: Record<string, number> = {};
  const afternoon: Record<string, number> = {};
  const tech: Record<string, number> = {};
  const standby: Record<string, number> = {};
  const total: Record<string, number> = {};

  for (const t of teachers) {
    morning[t.id] = 0;
    afternoon[t.id] = 0;
    tech[t.id] = 0;
    standby[t.id] = 0;
    total[t.id] = 0;
  }

  for (const entry of entries) {
    if (!entry.invigilatorAssignments) continue;
    const cfg = dayPeriodConfigs.find(c => c.id === entry.date);
    const periods =
      cfg?.periods ??
      (format(parseISO(entry.date), 'EEEE') === 'Wednesday' ? WEDNESDAY_PERIODS : PERIODS);

    for (const [key, tid] of Object.entries(entry.invigilatorAssignments)) {
      if (!(tid in total)) continue;
      const [pIdxStr, vId, role] = key.split('_');
      const pIdx = parseInt(pIdxStr, 10);
      if (vId !== 'GRADE' && !entry.venueIds?.includes(vId)) continue;

      const p = periods[pIdx];
      let dur = entry.durationMinutes ?? 120;
      if (p) {
        const [h1, m1] = p.start.split(':').map(Number);
        const [h2, m2] = p.end.split(':').map(Number);
        dur = h2 * 60 + m2 - (h1 * 60 + m1);
      }

      if (role === 'STANDBY') standby[tid] += dur;
      else if (role === 'TECH') tech[tid] += dur;
      else if (entry.session === 'MORNING') morning[tid] += dur;
      else if (entry.session === 'AFTERNOON') afternoon[tid] += dur;
      total[tid] += dur;
    }
  }

  return teachers
    .filter(t => isIncluded(t))
    .map(t => {
      const category = categoryFor(t);
      const loadWeight = category === 'specialist' ? 0.7 : 1;
      const tot = total[t.id] ?? 0;
      return {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        name: `${t.lastName}, ${t.firstName}`,
        morning: morning[t.id] ?? 0,
        afternoon: afternoon[t.id] ?? 0,
        tech: tech[t.id] ?? 0,
        standby: standby[t.id] ?? 0,
        total: tot,
        loadWeight,
        adjTotal: Math.round(tot / loadWeight),
        category,
      };
    })
    .sort((a, b) => {
      const ln = a.lastName.localeCompare(b.lastName);
      return ln !== 0 ? ln : a.firstName.localeCompare(b.firstName);
    });
}

// Inclusion + category helpers below preserve current behavior;
// they will be replaced in Task 3 after `Teacher.workloadCategory` exists.
function isIncluded(t: Teacher): boolean {
  return categoryFor(t) !== 'excluded';
}

function categoryFor(t: Teacher): 'specialist' | 'standard' | 'excluded' {
  // Temporary legacy map. Removed in Task 3.
  const name = `${t.firstName} ${t.lastName}`.toLowerCase();
  const isMerike = name.includes('merike') && name.includes('van dyk');
  if (isMerike) return 'excluded';

  const SPECIALIST_IDS = new Set([
    'FRAN', 'JACB', 'NORT', 'ORMA',                  // IT
    'CHAM', 'EZNY', 'ORIM', 'CPMO', 'ENYA',          // LS
    'SHEH', 'SHHU',                                  // Art
  ]);
  if (SPECIALIST_IDS.has(t.id)) return 'specialist';

  // Webmasters who are not specialists are excluded.
  if (t.activeRole === 'WEBMASTER') return 'excluded';
  // Teachers explicitly flagged not to invigilate are excluded.
  if (t.canInvigilate === false) return 'excluded';
  return 'standard';
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- src/lib/workload.test.ts`
Expected: PASS.

- [ ] **Step 5: Add tests for assignment counting**

```typescript
// Append to src/lib/workload.test.ts
const morningEntry = (assignments: Record<string, string>): TimetableEntry => ({
  id: 'e1',
  date: '2026-04-13',  // Monday → uses PERIODS
  grade: 12,
  session: 'MORNING',
  subject: 'Maths',
  paperType: 'Normal',
  venueIds: ['V1'],
  invigilatorAssignments: assignments,
});

it('credits MORNING assignment minutes to the morning bucket', () => {
  const teachers = [t('AAAA')];
  // Period 0 (P1) is 07:50-08:40 = 50 minutes
  const entries = [morningEntry({ '0_V1_PRIMARY': 'AAAA' })];
  const result = computeWorkload(teachers, entries, []);
  expect(result[0].morning).toBe(50);
  expect(result[0].afternoon).toBe(0);
  expect(result[0].total).toBe(50);
});

it('credits STANDBY role to standby bucket regardless of session', () => {
  const teachers = [t('AAAA')];
  const entries = [morningEntry({ '0_V1_STANDBY': 'AAAA' })];
  const result = computeWorkload(teachers, entries, []);
  expect(result[0].standby).toBe(50);
  expect(result[0].morning).toBe(0);
});

it('credits TECH role to tech bucket regardless of session', () => {
  const teachers = [t('AAAA')];
  const entries = [morningEntry({ '0_V1_TECH': 'AAAA' })];
  const result = computeWorkload(teachers, entries, []);
  expect(result[0].tech).toBe(50);
  expect(result[0].morning).toBe(0);
});

it('skips assignments for venues no longer in entry.venueIds', () => {
  const teachers = [t('AAAA')];
  const entries = [{
    ...morningEntry({ '0_DELETED_VENUE_PRIMARY': 'AAAA' }),
    venueIds: ['V1'],
  }];
  const result = computeWorkload(teachers, entries, []);
  expect(result[0].total).toBe(0);
});

it('keeps GRADE-keyed assignments even when not in venueIds', () => {
  const teachers = [t('AAAA')];
  const entries = [morningEntry({ '0_GRADE_PRIMARY': 'AAAA' })];
  const result = computeWorkload(teachers, entries, []);
  expect(result[0].morning).toBe(50);
});
```

- [ ] **Step 6: Run tests, verify all pass**

Run: `npm test -- src/lib/workload.test.ts`
Expected: 6 PASS.

- [ ] **Step 7: Add tests for inclusion + load weight**

```typescript
// Append to src/lib/workload.test.ts
it('excludes Merike Van Dyk by name', () => {
  const teachers = [
    t('MERV', { firstName: 'Merike', lastName: 'Van Dyk' }),
    t('AAAA'),
  ];
  const result = computeWorkload(teachers, [], []);
  expect(result.map(r => r.id)).toEqual(['AAAA']);
});

it('excludes WEBMASTERs who are not specialists', () => {
  const teachers = [
    t('WEBO', { activeRole: 'WEBMASTER', roles: ['WEBMASTER'] }),
    t('FRAN', { activeRole: 'WEBMASTER', roles: ['WEBMASTER'] }), // specialist
  ];
  const result = computeWorkload(teachers, [], []);
  expect(result.map(r => r.id)).toEqual(['FRAN']);
});

it('marks specialists with loadWeight 0.7 and standard with 1', () => {
  const teachers = [t('AAAA'), t('JACB')];
  const result = computeWorkload(teachers, [], []);
  const aaaa = result.find(r => r.id === 'AAAA')!;
  const jacb = result.find(r => r.id === 'JACB')!;
  expect(aaaa.loadWeight).toBe(1);
  expect(jacb.loadWeight).toBe(0.7);
  expect(aaaa.category).toBe('standard');
  expect(jacb.category).toBe('specialist');
});

it('honors dayPeriodConfig override over weekday default', () => {
  const teachers = [t('AAAA')];
  const customCfg: DayPeriodConfig = {
    id: '2026-04-13',
    periods: [{ id: 1, start: '08:00', end: '08:30', label: 'P1' }],
  };
  const entries = [morningEntry({ '0_V1_PRIMARY': 'AAAA' })];
  const result = computeWorkload(teachers, entries, [customCfg]);
  expect(result[0].morning).toBe(30);
});
```

- [ ] **Step 8: Run tests, verify all pass**

Run: `npm test -- src/lib/workload.test.ts`
Expected: 10 PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/workload.ts src/lib/workload.test.ts
git commit -m "feat(workload): canonical compute library with full test suite"
```

---

## Task 2: Replace `WebmasterPanel.tsx` workload calc with the library

**Files:**
- Modify: `src/components/WebmasterPanel.tsx:24-118`

- [ ] **Step 1: Replace the inline `useMemo` block with a call to `computeWorkload`**

Open `src/components/WebmasterPanel.tsx`. Replace lines 24-118 with:

```typescript
  // Calculate workload statistics
  const workloadStats = useMemo(
    () => computeWorkload(teachers, entries, dayPeriodConfigs),
    [teachers, entries, dayPeriodConfigs],
  );
```

Add at the top of the file:

```typescript
import { computeWorkload } from '../lib/workload';
```

- [ ] **Step 2: Update consumers downstream that reference `loadWeight`, `morning`, etc.**

Grep usages: `grep -n "workloadStats" src/components/WebmasterPanel.tsx`. The fields we expose match the previous shape (`name`, `firstName`, `lastName`, `morning`, `standby`, `afternoon`, `tech`, `total`, `id`, `loadWeight`) plus new `adjTotal` and `category`. No consumer changes expected.

- [ ] **Step 3: Run lint + typecheck**

Run: `npm run lint`
Expected: zero new TypeScript errors. (Existing strict-mode errors land in Task 7.)

- [ ] **Step 4: Boot the dev server, switch to Webmaster role, verify the table still renders**

Run: `npm run dev` and open http://localhost:3000.
Expected: workload table populated identically to before. Cross-check 2–3 rows against pre-change values (use `git stash` and `git stash pop` to compare visually).

- [ ] **Step 5: Commit**

```bash
git add src/components/WebmasterPanel.tsx
git commit -m "refactor(webmaster): use computeWorkload library"
```

---

## Task 3: Replace `OperationalManager.tsx` workload calc with the library

**Files:**
- Modify: `src/components/OperationalManager.tsx:42-94`

- [ ] **Step 1: Replace the inline `React.useMemo` block**

Replace lines 42-94 with:

```typescript
  const workloadData = React.useMemo(
    () => computeWorkload(teachers, entries, /* dayPeriodConfigs */ []),
    [teachers, entries],
  );
```

Add at the top:

```typescript
import { computeWorkload } from '../lib/workload';
```

**Note on behavioral change:** OperationalManager previously hardcoded a smaller specialist set (`JACB, SHHU, CPMO, ENYA, ORMA`). Now it uses the full set. Verify with the OPS user that adjusted totals are still correct; expect a few rows where `adjTotal` shifts by ≤30%.

- [ ] **Step 2: If `dayPeriodConfigs` is available in this scope, pass it in. Otherwise leave `[]` and add a `TODO: thread dayPeriodConfigs prop` comment.**

Read `src/components/OperationalManager.tsx` near `Props` definition. If the prop is not currently received, add it now and pass it down from `App.tsx`. Plan 5 has already moved listeners; if Plan 5 has shipped, the hook `useDayPeriodConfigs()` is available.

- [ ] **Step 3: Lint + dev-server smoke check**

Run: `npm run lint`. Then `npm run dev`, switch to OPS, verify workload chart and table render.

- [ ] **Step 4: Commit**

```bash
git add src/components/OperationalManager.tsx src/App.tsx
git commit -m "refactor(ops): use computeWorkload library"
```

---

## Task 4: Replace `AdminPanel.tsx` workload calc with the library

**Files:**
- Modify: `src/components/AdminPanel.tsx:1594-1700` (approx — read the block before replacing)
- Modify: `src/components/AdminPanel.tsx:216-225` (delete the now-unused `isITSpecialistTeacher`, `isLSSpecialistTeacher`, `isArtSpecialistTeacher`)

The Admin block has additional bookkeeping: `totalInvigilationMinutesRequired`, `teacherPotentials`, `assignedMinutes`, `teacherBreakdown`. Keep that bookkeeping but feed it from `computeWorkload`'s output rather than an inline pass.

- [ ] **Step 1: Read `AdminPanel.tsx` lines 1594-1750 to capture the full `workloadStats` shape**

Run: `sed -n '1594,1750p' src/components/AdminPanel.tsx`
Note every property the rest of the panel reads (e.g. `workloadStats.assignedMinutes`, `.teacherBreakdown`, etc.).

- [ ] **Step 2: Refactor — keep the outer `useMemo`, derive what's needed from `computeWorkload`**

```typescript
  // 3. Workload Calculation
  const workloadStats = useMemo(() => {
    const rows = computeWorkload(teachers, entries, dayPeriodConfigs);
    const assignedMinutes: { [teacherId: string]: number } = {};
    const teacherBreakdown: {
      [teacherId: string]: { morning: number; afternoon: number; tech: number; standby: number };
    } = {};
    const teacherPotentials: { [teacherId: string]: number } = {};
    let totalInvigilationMinutesRequired = 0;

    for (const r of rows) {
      assignedMinutes[r.id] = r.total;
      teacherBreakdown[r.id] = {
        morning: r.morning,
        afternoon: r.afternoon,
        tech: r.tech,
        standby: r.standby,
      };
      const t = teachers.find(x => x.id === r.id)!;
      teacherPotentials[r.id] = (t.workloadPercentage ?? 100) * r.loadWeight;
      totalInvigilationMinutesRequired += r.total;
    }
    const totalPotentialUnits = Object.values(teacherPotentials).reduce((a, b) => a + b, 0);

    return {
      rows,
      assignedMinutes,
      teacherBreakdown,
      teacherPotentials,
      totalPotentialUnits,
      totalInvigilationMinutesRequired,
    };
  }, [teachers, entries, dayPeriodConfigs]);
```

- [ ] **Step 3: Delete the now-unused helpers**

Remove lines 216-225 of `AdminPanel.tsx` (`isITSpecialistTeacher`, `isLSSpecialistTeacher`, `isArtSpecialistTeacher`). Grep first to ensure nothing else references them: `grep -n "isITSpecialistTeacher\|isLSSpecialistTeacher\|isArtSpecialistTeacher" src/components/AdminPanel.tsx`. Expected: zero hits after the refactor.

- [ ] **Step 4: Run lint + boot dev server, verify scheduler tab still computes**

Run: `npm run lint && npm run dev`. Switch to Admin role, click the Scheduler tab, generate or load assignments, verify totals match prior behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminPanel.tsx
git commit -m "refactor(admin): use computeWorkload library, drop specialist helpers"
```

---

## Task 5: Add `Teacher.workloadCategory` and `Teacher.canApproveExtensions` fields

**Files:**
- Modify: `src/types.ts:42-60` (Teacher interface)
- Modify: `src/data.ts` (annotate `INITIAL_TEACHERS` with the new fields)

- [ ] **Step 1: Extend the `Teacher` interface**

Open `src/types.ts`. After line 60 (`hasReward?: boolean;`) but inside the same interface, add:

```typescript
  workloadCategory?: 'specialist' | 'standard' | 'excluded';
  canApproveExtensions?: boolean;
```

Both optional so existing Firestore docs without the field load cleanly.

- [ ] **Step 2: Backfill `INITIAL_TEACHERS`**

Open `src/data.ts`. Apply these per-row edits (verify ids before saving):

| id | workloadCategory | canApproveExtensions |
|---|---|---|
| `MERV` (Merike Van Dyk) | `'excluded'` | `true` |
| `EZRN` (Ezra Nyathi) | `'standard'` | `true` |
| `PLAL` (Placid Letswalo) | `'standard'` | `true` |
| `FRAN` (Franz Nortje) | `'specialist'` | — |
| `JACB` (Jaco Blom) | `'specialist'` | — |
| `SHEH` (Shelton Hu) | `'specialist'` | — |

All other rows: implicit `'standard'` / `false` via the optional default.

Concrete edit for the MERV row (`src/data.ts:18`):

```typescript
  { id: 'MERV', firstName: 'Merike', lastName: 'Van Dyk', roles: ['ADMIN', 'TEACHER', 'OPERATIONAL_MANAGER'], activeRole: 'ADMIN', totalHours: 0, canInvigilate: false, invigilationPreference: 'MARATHON', workloadCategory: 'excluded', canApproveExtensions: true },
```

Same pattern for `EZRN`, `PLAL`, `FRAN`, `JACB`, `SHEH`.

- [ ] **Step 3: Lint**

Run: `npm run lint`. Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/data.ts
git commit -m "feat(types): Teacher.workloadCategory + canApproveExtensions"
```

---

## Task 6: Migration script — backfill `workloadCategory` and `canApproveExtensions` in Firestore

**Files:**
- Create: `scripts/migrate-teacher-categories.ts`
- Create: `scripts/README.md` (one paragraph, lists all migration scripts and how to run them)

- [ ] **Step 1: Write the script**

```typescript
// scripts/migrate-teacher-categories.ts
//
// Backfill Teacher.workloadCategory and canApproveExtensions on existing Firestore docs.
// Usage:
//   npx tsx scripts/migrate-teacher-categories.ts --dry-run
//   npx tsx scripts/migrate-teacher-categories.ts --apply
//
// Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON
// with `roles/datastore.user`. See scripts/README.md.

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const SPECIALIST_IDS = new Set([
  'FRAN', 'JACB', 'NORT', 'ORMA',
  'CHAM', 'EZNY', 'ORIM', 'CPMO', 'ENYA',
  'SHEH', 'SHHU',
]);
const APPROVER_IDS = new Set(['MERV', 'PLAL', 'EZRN']);
const EXCLUDED_BY_NAME = (firstName: string, lastName: string) =>
  /merike/i.test(firstName) && /van\s*dyk/i.test(lastName);

function categoryFor(t: { id: string; firstName: string; lastName: string; activeRole?: string; canInvigilate?: boolean }) {
  if (EXCLUDED_BY_NAME(t.firstName, t.lastName)) return 'excluded' as const;
  if (SPECIALIST_IDS.has(t.id)) return 'specialist' as const;
  if (t.activeRole === 'WEBMASTER') return 'excluded' as const;
  if (t.canInvigilate === false) return 'excluded' as const;
  return 'standard' as const;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.');
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))) });
  const db = getFirestore();

  const snap = await db.collection('teachers').get();
  let toWrite = 0;
  let unchanged = 0;
  const changes: Array<{ id: string; before: any; after: any }> = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const desiredCategory = categoryFor({
      id: data.id ?? doc.id,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      activeRole: data.activeRole,
      canInvigilate: data.canInvigilate,
    });
    const desiredApprover = APPROVER_IDS.has(data.id ?? doc.id);

    const update: Record<string, unknown> = {};
    if (data.workloadCategory !== desiredCategory) update.workloadCategory = desiredCategory;
    if (data.canApproveExtensions !== desiredApprover) update.canApproveExtensions = desiredApprover;

    if (Object.keys(update).length === 0) {
      unchanged++;
      continue;
    }
    toWrite++;
    changes.push({ id: doc.id, before: { workloadCategory: data.workloadCategory, canApproveExtensions: data.canApproveExtensions }, after: update });
    if (apply) await doc.ref.set(update, { merge: true });
  }

  console.log(JSON.stringify({ toWrite, unchanged, applied: apply, dryRun, changes }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm scripts and the dependency**

Edit `package.json` `scripts`:

```json
    "migrate:teacher-categories": "tsx scripts/migrate-teacher-categories.ts --dry-run",
    "migrate:teacher-categories:apply": "tsx scripts/migrate-teacher-categories.ts --apply",
```

Install `firebase-admin` as a dev dep:

```bash
npm i -D firebase-admin
```

- [ ] **Step 3: Write `scripts/README.md`**

```markdown
# Migration Scripts

One-shot scripts for backfilling Firestore data. All scripts default to dry-run.

## Setup

1. Create or download a service-account JSON for the Firebase project.
2. `export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/service-account.json`
3. `npm i` to install `firebase-admin`.

## Available scripts

| Script | Purpose |
|---|---|
| `migrate-teacher-categories.ts` | Backfill `Teacher.workloadCategory` and `Teacher.canApproveExtensions` on existing `teachers/{id}` docs. |

Run dry first, then apply:

    npm run migrate:teacher-categories
    npm run migrate:teacher-categories:apply
```

- [ ] **Step 4: Dry-run against a Firestore emulator (or staging project)**

```bash
firebase emulators:start --only firestore --project demo-curro &
GOOGLE_APPLICATION_CREDENTIALS=./fake-cred.json npm run migrate:teacher-categories
```

Expected: prints a JSON summary with `dryRun: true` and a `changes` array. No writes happen.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-teacher-categories.ts scripts/README.md package.json package-lock.json
git commit -m "feat(migrate): backfill teacher workloadCategory + approver flag"
```

---

## Task 7: Switch `computeWorkload` to use `Teacher.workloadCategory`

**Files:**
- Modify: `src/lib/workload.ts` (`categoryFor()` function)
- Modify: `src/lib/workload.test.ts` (add tests for the new behavior)

- [ ] **Step 1: Add a failing test for the data-driven path**

```typescript
// Append to src/lib/workload.test.ts
it('uses Teacher.workloadCategory when present', () => {
  const teachers = [
    t('XXXX', { workloadCategory: 'specialist' }),
    t('YYYY', { workloadCategory: 'excluded' }),
    t('ZZZZ', { workloadCategory: 'standard' }),
  ];
  const result = computeWorkload(teachers, [], []);
  expect(result.map(r => r.id).sort()).toEqual(['XXXX', 'ZZZZ']);
  const xxxx = result.find(r => r.id === 'XXXX')!;
  expect(xxxx.loadWeight).toBe(0.7);
});

it('falls back to legacy hardcoded list when workloadCategory is undefined', () => {
  const teachers = [t('JACB')];  // legacy specialist id, no workloadCategory
  const result = computeWorkload(teachers, [], []);
  expect(result[0].loadWeight).toBe(0.7);
});
```

- [ ] **Step 2: Run, expect the first test to fail**

Run: `npm test -- src/lib/workload.test.ts`
Expected: the new test fails — current `categoryFor` ignores `workloadCategory`.

- [ ] **Step 3: Update `categoryFor` to prefer the field**

Replace the `categoryFor` body in `src/lib/workload.ts`:

```typescript
function categoryFor(t: Teacher): 'specialist' | 'standard' | 'excluded' {
  if (t.workloadCategory) return t.workloadCategory;

  // Legacy fallback for docs that haven't been migrated yet.
  const name = `${t.firstName} ${t.lastName}`.toLowerCase();
  const isMerike = name.includes('merike') && name.includes('van dyk');
  if (isMerike) return 'excluded';

  const SPECIALIST_IDS = new Set([
    'FRAN', 'JACB', 'NORT', 'ORMA',
    'CHAM', 'EZNY', 'ORIM', 'CPMO', 'ENYA',
    'SHEH', 'SHHU',
  ]);
  if (SPECIALIST_IDS.has(t.id)) return 'specialist';

  if (t.activeRole === 'WEBMASTER') return 'excluded';
  if (t.canInvigilate === false) return 'excluded';
  return 'standard';
}
```

- [ ] **Step 4: All tests pass**

Run: `npm test -- src/lib/workload.test.ts`
Expected: 12 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workload.ts src/lib/workload.test.ts
git commit -m "feat(workload): prefer Teacher.workloadCategory over hardcoded ids"
```

---

## Task 8: Replace `APPROVERS = ['MERV', 'PLAL', 'EZRN']`

**Files:**
- Modify: `src/components/OperationalManager.tsx:32` and downstream usages

- [ ] **Step 1: Find every reference**

Run: `grep -n "APPROVERS\b" src/components/OperationalManager.tsx`
Expected: ≤6 hits.

- [ ] **Step 2: Replace**

For each `APPROVERS.includes(staffCode)` site, rewrite to look up the teacher and check the field:

```typescript
const isApprover = (staffCode: string) =>
  teachers.find(t => t.id === staffCode)?.canApproveExtensions === true;
```

Define `isApprover` once near the top of the component (after `useState` declarations), then replace every `APPROVERS.includes(...)` with `isApprover(...)`.

Delete the `const APPROVERS = ['MERV', 'PLAL', 'EZRN'];` line at `OperationalManager.tsx:32`.

- [ ] **Step 3: Lint + dev-server smoke check**

Run: `npm run lint && npm run dev`. Switch to OPS, verify the "approve extension" buttons appear only for users `MERV` / `PLAL` / `EZRN` (and no others).

- [ ] **Step 4: Commit**

```bash
git add src/components/OperationalManager.tsx
git commit -m "refactor(ops): canApproveExtensions field replaces APPROVERS list"
```

---

## Task 9: Move `PUBLIC_HOLIDAYS` and the cycle-1 reference date to a Firestore `config/main` doc

**Files:**
- Create: `src/hooks/useAppConfig.ts`
- Create: `src/hooks/useAppConfig.test.ts`
- Modify: `src/components/OperationalManager.tsx:33` (delete `PUBLIC_HOLIDAYS`)
- Modify: `src/constants.ts:39-49` (`getCycleForDate` reads from config; keep a fallback)
- Modify: `firestore.rules` (add a rule for `config/main`: read by any signed-in user, write by admin only)

- [ ] **Step 1: Add the failing test for `useAppConfig`**

```typescript
// src/hooks/useAppConfig.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppConfig } from './useAppConfig';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn((_ref, cb) => {
    cb({
      exists: () => true,
      data: () => ({
        publicHolidays: ['2026-12-25'],
        cycleStartDate: '2026-04-13',
        schoolYearStart: '2026-01-15',
        schoolYearEnd: '2026-12-04',
      }),
    });
    return () => {};
  }),
}));

describe('useAppConfig', () => {
  it('returns config from the config/main doc', async () => {
    const { result } = renderHook(() => useAppConfig());
    await waitFor(() => expect(result.current.config).not.toBeNull());
    expect(result.current.config?.publicHolidays).toEqual(['2026-12-25']);
    expect(result.current.config?.cycleStartDate).toBe('2026-04-13');
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- src/hooks/useAppConfig.test.ts`
Expected: FAIL with "Cannot find module './useAppConfig'".

- [ ] **Step 3: Implement `useAppConfig`**

```typescript
// src/hooks/useAppConfig.ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface AppConfig {
  publicHolidays: string[];      // YYYY-MM-DD
  cycleStartDate: string;        // YYYY-MM-DD, Monday of cycle 1
  schoolYearStart: string;       // YYYY-MM-DD
  schoolYearEnd: string;         // YYYY-MM-DD
}

const DEFAULT_CONFIG: AppConfig = {
  publicHolidays: ['2026-05-01', '2026-06-16'],
  cycleStartDate: '2026-04-13',
  schoolYearStart: '2026-01-15',
  schoolYearEnd: '2026-12-04',
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = doc(db, 'config', 'main');
    const unsub = onSnapshot(
      ref,
      snap => setConfig(snap.exists() ? (snap.data() as AppConfig) : DEFAULT_CONFIG),
      err => {
        setError(err);
        setConfig(DEFAULT_CONFIG);
      },
    );
    return unsub;
  }, []);

  return { config, error, defaults: DEFAULT_CONFIG };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- src/hooks/useAppConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `getCycleForDate` to take an optional reference date**

Replace `src/constants.ts:39-49`:

```typescript
// Helper to get Cycle based on date.
// `cycleStartDate` defaults to the legacy 2026-04-13 anchor; pass the value
// from `useAppConfig().config.cycleStartDate` once available.
export function getCycleForDate(date: Date, cycleStartDate = '2026-04-13'): 1 | 2 {
  const startOfReference = new Date(cycleStartDate);
  const diffInMs = date.getTime() - startOfReference.getTime();
  const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
  return Math.abs(diffInWeeks) % 2 === 0 ? 1 : 2;
}
```

Then update each call site to pass the config value. Run: `grep -n "getCycleForDate" src/`. For each site, thread `config?.cycleStartDate` through (or pass nothing to use the default).

- [ ] **Step 6: Use config for `PUBLIC_HOLIDAYS`**

Delete `src/components/OperationalManager.tsx:33` (the `const PUBLIC_HOLIDAYS = [...]` line). Replace each usage with `config?.publicHolidays ?? []` from the hook. Add `const { config } = useAppConfig();` near the top of the component.

- [ ] **Step 7: Tighten `firestore.rules` for `/config/main`**

Append to `firestore.rules` (placement: after the existing `/users/{uid}` block):

```
match /config/main {
  allow read: if isSignedIn();
  allow write: if isAdmin() || isWebmaster();
}
```

(Both helpers were corrected in Plan 2 to read `users/{uid}.roles`.)

- [ ] **Step 8: Lint + dev-server smoke check**

Run: `npm run lint && npm run dev`. Open OPS — verify holidays still grey out the expected dates. Switch to admin scheduler — verify cycle 1/2 still resolves correctly.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useAppConfig.ts src/hooks/useAppConfig.test.ts src/components/OperationalManager.tsx src/constants.ts firestore.rules
git commit -m "feat(config): move holidays + cycle anchor to Firestore config/main"
```

---

## Task 10: Build the admin UI to edit `config/main`

**Files:**
- Create: `src/components/AppConfigEditor.tsx`
- Modify: `src/components/OperationalManager.tsx` (mount `<AppConfigEditor>` inside a new SectionCard)

- [ ] **Step 1: Add the component**

```typescript
// src/components/AppConfigEditor.tsx
import { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppConfig, type AppConfig } from '../hooks/useAppConfig';

export default function AppConfigEditor() {
  const { config } = useAppConfig();
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (config && !draft) setDraft(config);
  }, [config, draft]);

  if (!draft) return <div className="text-sm text-text-muted">Loading config…</div>;

  const update = (patch: Partial<AppConfig>) => setDraft({ ...draft, ...patch });
  const onSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'main'), draft, { merge: true });
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="text-sm">
        <span className="block mb-1 font-semibold">School year start</span>
        <input
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          value={draft.schoolYearStart}
          onChange={e => update({ schoolYearStart: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className="block mb-1 font-semibold">School year end</span>
        <input
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          value={draft.schoolYearEnd}
          onChange={e => update({ schoolYearEnd: e.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className="block mb-1 font-semibold">Cycle 1 start (Monday)</span>
        <input
          type="date"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          value={draft.cycleStartDate}
          onChange={e => update({ cycleStartDate: e.target.value })}
        />
      </label>
      <label className="text-sm md:col-span-2">
        <span className="block mb-1 font-semibold">Public holidays (one YYYY-MM-DD per line)</span>
        <textarea
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
          rows={6}
          value={draft.publicHolidays.join('\n')}
          onChange={e => update({ publicHolidays: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
        />
      </label>
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-lg bg-curro-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && (
          <span className="text-xs text-text-muted">Saved {savedAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it inside OperationalManager**

After the existing "Admin Privilege Management" section, append (use the `<SectionCard>` primitive from Plan 3 if it has shipped; otherwise inline a `<div>`):

```tsx
<SectionCard variant="zinc" title="App Configuration" icon={<Settings className="h-5 w-5" />}>
  <AppConfigEditor />
</SectionCard>
```

Add the import: `import AppConfigEditor from './AppConfigEditor';` and `import { Settings } from 'lucide-react';`.

- [ ] **Step 3: Lint + dev-server smoke check**

Run: `npm run lint && npm run dev`. Switch to OPS, scroll to App Configuration, change a holiday, save, verify the value round-trips on reload.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppConfigEditor.tsx src/components/OperationalManager.tsx
git commit -m "feat(ops): admin UI for app config (holidays, cycle anchor, school year)"
```

---

## Task 11: Document `SUPER_ADMINS` removal and link to Plan 2

**Files:**
- Modify: `src/components/OperationalManager.tsx:175-191` (`toggleAdminRole`)

Plan 2 already removes `SUPER_ADMINS` from `App.tsx:14-19` and the `App.tsx:78-86` override block. After Plan 2 ships, OPS-role grants/revokes flow through `toggleAdminRole` only.

- [ ] **Step 1: Verify Plan 2 work landed**

Run: `grep -n "SUPER_ADMINS" src/`
Expected: zero hits (confirms Plan 2 already swept it).

- [ ] **Step 2: Confirm `toggleAdminRole` writes to Firestore**

Open `src/components/OperationalManager.tsx:175-191`. The function should already `setDoc(doc(db, 'teachers', t.id), { roles: ... })`. If not, fix that here. Add a unit test mocking `setDoc` and asserting the correct payload.

- [ ] **Step 3: Smoke check + commit (likely no-op)**

If no changes were needed, skip the commit. Otherwise:

```bash
git add src/components/OperationalManager.tsx
git commit -m "fix(ops): toggleAdminRole writes to Firestore directly (no SUPER_ADMINS override)"
```

---

## Task 12: Turn on TypeScript strict flags

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Edit `tsconfig.json`**

Replace the `compilerOptions` block with:

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
    "noEmit": true,

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 2: Capture the error inventory**

Run: `npx tsc --noEmit 2>&1 | tee /tmp/curro-strict-errors.txt | tail -1`
Expected: a final "Found N errors in M files" line. Confirmed counts (from this codebase as of 2026-05-07): 9 `: any` in `AdminPanel.tsx`, 1 in `OperationalManager.tsx`, 3 in `TeacherDashboard.tsx`. Strict mode will surface ~30-60 additional `noImplicitAny` and null-check errors.

- [ ] **Step 3: Bucket the errors by category**

```bash
grep -oE "error TS[0-9]+" /tmp/curro-strict-errors.txt | sort | uniq -c | sort -rn
```

You will see categories like `TS7006 Parameter '...' implicitly has an 'any' type`, `TS2531 Object is possibly 'null'`, `TS6133 'X' is declared but its value is never read`, `TS2532 Object is possibly 'undefined'`. Plan the next two tasks (13 + 14) accordingly.

- [ ] **Step 4: Do NOT commit yet — the build is broken until tasks 13+14 land**

(Or: stash the `tsconfig.json` change until both fix tasks are complete, then commit them together.)

```bash
git stash push tsconfig.json -m "WIP: strict-mode bump pending fixes"
```

---

## Task 13: Replace 13 `: any` and 3 `@ts-ignore` sites

**Files (all confirmed via grep on 2026-05-07):**

- `src/components/AdminPanel.tsx:86, 391, 921, 2376, 3232, 6188, 6200, 6201, 6202` (9 sites)
- `src/components/OperationalManager.tsx` (1 site — find via grep)
- `src/components/TeacherDashboard.tsx:430, 501, 800` (3 sites — 2 `@ts-ignore` + 1 `: any`)

- [ ] **Step 1: `AdminPanel.tsx:86` — `teacher: any` parameter**

Read the function signature first (`sed -n '80,100p' src/components/AdminPanel.tsx`). The parameter is a Teacher (verify by examining how the body uses it). Replace `any` with `Teacher`:

```typescript
import type { Teacher } from '../types';
// ...
function someHelper(teacher: Teacher /* was: any */, ...) { ... }
```

- [ ] **Step 2: `AdminPanel.tsx:391` — `backup: { [date: string]: any }`**

Read the assignment (`sed -n '385,420p' src/components/AdminPanel.tsx`). The shape is "entry id → invigilatorAssignments". Replace with:

```typescript
const backup: { [date: string]: { [entryId: string]: TimetableEntry['invigilatorAssignments'] } } = {};
```

Adjust the imports.

- [ ] **Step 3: `AdminPanel.tsx:921` — `localizedAssignments: { [entryId: string]: any }`**

Read the surrounding block. Same pattern: this is a map of entry id to invigilator-assignment objects. Use `TimetableEntry['invigilatorAssignments']` as the value type.

- [ ] **Step 4: `AdminPanel.tsx:2376` — `updates: any = { invigilationPreference: next }`**

Type as `Partial<Teacher>`:

```typescript
const updates: Partial<Teacher> = { invigilationPreference: next };
```

- [ ] **Step 5: `AdminPanel.tsx:3232` — `byEntry: { [eid: string]: any }`**

Same pattern. Use the actual value shape (read the next ~15 lines) — likely `Partial<TimetableEntry>` or an aggregation object.

- [ ] **Step 6: `AdminPanel.tsx:6188-6202` — SchedulerTab prop types**

These are the 50+ props passed to `SchedulerTab`. Define a real `SchedulerTabProps` interface above the component:

```typescript
interface SchedulerTabProps {
  // ...other props (read lines 6135-6250 to enumerate)
  workloadStats: ReturnType<typeof useWorkloadStats>; // or the explicit shape
  setEqStages: React.Dispatch<React.SetStateAction<EqStages>>;
  interactiveWorkload: WorkloadRow[];
  setInteractiveWorkload: React.Dispatch<React.SetStateAction<WorkloadRow[]>>;
}
```

Define `EqStages` near the top by reading the producer site. `WorkloadRow` is exported from `src/lib/workload.ts`.

- [ ] **Step 7: `OperationalManager.tsx` — find and fix the lone `: any`**

Run: `grep -n ":\\s*any\\b" src/components/OperationalManager.tsx`
For each hit, follow the same pattern: read the surrounding context, infer the real type, replace.

- [ ] **Step 8: `TeacherDashboard.tsx:430` — `@ts-ignore`**

Read `sed -n '420,440p' src/components/TeacherDashboard.tsx`. The review notes this is around the audio-context block. Replace `@ts-ignore` with proper typing:

```typescript
const AudioCtx =
  window.AudioContext ??
  (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
```

Drop the `@ts-ignore` comment.

- [ ] **Step 9: `TeacherDashboard.tsx:501` — `@ts-ignore`**

Read `sed -n '495,510p' src/components/TeacherDashboard.tsx`. Apply the same approach: identify the real type, fix it inline. If the cast is genuinely necessary (e.g. interop with a missing-type lib), use a typed `as` cast and document why.

- [ ] **Step 10: `TeacherDashboard.tsx:800` — `function CheckCircle2(props: any)`**

Replace with:

```typescript
import type { LucideProps } from 'lucide-react';
function CheckCircle2(props: LucideProps) { /* ... */ }
```

(If the function is hand-rolling an SVG, type it as `React.SVGProps<SVGSVGElement>` instead.)

- [ ] **Step 11: Run typecheck after each batch**

Run: `npx tsc --noEmit 2>&1 | tail -1`
Expected: error count strictly decreasing as you progress.

- [ ] **Step 12: Commit incrementally (one commit per file)**

```bash
git add src/components/AdminPanel.tsx
git commit -m "fix(types): replace 9 any annotations in AdminPanel"

git add src/components/OperationalManager.tsx
git commit -m "fix(types): replace any in OperationalManager"

git add src/components/TeacherDashboard.tsx
git commit -m "fix(types): drop ts-ignore comments + type CheckCircle2"
```

---

## Task 14: Fix the remaining strict-mode errors (null checks + unused locals)

**Files:** whichever files `tsc --noEmit` still complains about.

Most remaining errors fall into three buckets:

- `TS2531/2532` (Object is possibly 'null'/'undefined') — fix with optional chaining or guards. Avoid `!` non-null assertions unless the invariant is local and obvious.
- `TS7006` (parameter implicitly has an 'any' type) — type each callback arg. For Firestore handlers, `(snap: QuerySnapshot) => …`.
- `TS6133` (declared but never read) — delete the unused import / param. For event handlers, the convention is `_e` to indicate intentional disuse.

- [ ] **Step 1: Pop the stash**

```bash
git stash pop
```

This re-applies the `tsconfig.json` strict bump.

- [ ] **Step 2: Fix in tightest-feedback order**

Loop until clean:

```bash
while true; do
  output=$(npx tsc --noEmit 2>&1)
  echo "$output" | tail -1
  first_error=$(echo "$output" | grep -m1 "error TS")
  if [ -z "$first_error" ]; then break; fi
  echo "Next: $first_error"
  read -p "Press enter once fixed..."
done
```

(Or just run `npx tsc --noEmit --watch` in a side terminal.)

- [ ] **Step 3: Avoid masking errors**

Do NOT add `// @ts-expect-error` to suppress errors. If a real cast is needed, use `as`. If the type system genuinely can't see what you can prove, leave a one-line comment explaining the invariant.

- [ ] **Step 4: Commit when clean**

```bash
git add src tsconfig.json
git commit -m "feat(ts): strict mode + noUnused* + noImplicitReturns"
```

- [ ] **Step 5: Update the lint script to include strict typecheck**

Plan 1 set `"lint": "eslint src --max-warnings=999 && tsc --noEmit"`. With strict mode now passing, tighten:

```json
    "lint": "eslint src --max-warnings=0 && tsc --noEmit",
```

Run: `npm run lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "chore(lint): tighten lint to zero warnings now that strict mode is clean"
```

---

## Self-Review Checklist (run after the plan executes end-to-end)

- [ ] `grep -n "specialistIds\\|isITSpecialistTeacher\\|isLSSpecialistTeacher\\|isArtSpecialistTeacher\\|APPROVERS\\|PUBLIC_HOLIDAYS\\|SUPER_ADMINS" src/` returns zero hits.
- [ ] `npm test` passes including the new `workload.test.ts` (≥12 cases) and `useAppConfig.test.ts`.
- [ ] `npm run lint` passes with zero errors and zero warnings.
- [ ] Manual smoke: log in as OPS, edit a public holiday in the new App Configuration section, refresh the page — value persists. Switch to admin scheduler — the holiday is reflected in the calendar.
- [ ] `firebase-admin` migration script dry-run on the production DB shows the expected delta; apply when ready.

## Out of scope (deferred to other plans)

- Dead-dep removal and the eslint script — already covered by Plan 1.
- `SUPER_ADMINS` deletion + real auth — covered by Plan 2.
- Per-panel listener hooks pattern (`useSubjects`, `useMarkingExtensions`, etc.) — covered by Plan 5; this plan adds `useAppConfig` following that same convention.
- Visual / typography / radius normalization — Plan 7.
- ARIA + reduced-motion — Plan 8.
