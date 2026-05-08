# AdminPanel Component Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 9,089-line AdminPanel.tsx into a shell + sub-components under `src/components/admin/`, with no behavioral changes.

**Architecture:** AdminPanel becomes a thin shell that owns shared state and renders tab components via props. Each tab, modal, and shared sub-component lives in its own file under `admin/tabs/`, `admin/modals/`, or `admin/shared/`. Utility functions move to `admin/shared/helpers.ts`.

**Tech Stack:** React, TypeScript, Vitest, date-fns, firebase/firestore, lucide-react, recharts, motion/react

---

## File Structure

```
src/components/admin/
  AdminPanel.tsx              — shell: shared state, tab bar, renders active tab
  index.ts                    — re-exports AdminPanel as default
  tabs/
    SubjectsTab.tsx           — moved from L8514 (already a standalone component)
    FacultyTab.tsx            — extracted from inline JSX (L2988-3148)
    AssignmentsTab.tsx        — extracted from inline JSX (L3150-3663)
    TimetableTab.tsx          — thin wrapper rendering ExamTimetableTab (L3665-3677)
    VenuesTab.tsx             — moved from L6249 (already a standalone component)
    SchedulerTab.tsx          — moved from L6555 (already a standalone component)
    InspectionTab.tsx         — extracted from inline JSX (L3736-4268)
    ExamTimetableTab.tsx      — moved from L5364 (already a standalone component)
  modals/
    TimetableModal.tsx        — moved from L4269
    SubjectsModal.tsx         — moved from L4411
    AddTeacherModal.tsx       — moved from L4537
    EditTeacherModal.tsx      — moved from L4687
    BreakDutyModal.tsx        — moved from L4814
    HomeRoomModal.tsx         — moved from L5005
    LeaveRequestModal.tsx     — moved from L5106
    VenueModal.tsx            — moved from L6434
    PeriodConfigModal.tsx     — moved from L8393
    StatsModal.tsx            — moved from L8973
  shared/
    FacultyRow.tsx            — moved from L541
    WorkloadBar.tsx           — moved from L355
    OverflowMenu.tsx          — moved from L438
    InspectionCalendar.tsx    — moved from L898
    TimetableField.tsx        — moved from L6009
    ConfirmFromState.tsx      — moved from L103
    helpers.ts                — utility functions
    types.ts                  — shared types (ConfirmState, WorkloadBreakdown, DayMinutes, etc.)
```

---

### Task 1: Create directory structure and shared types/helpers

**Files:**
- Create: `src/components/admin/shared/types.ts`
- Create: `src/components/admin/shared/helpers.ts`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p src/components/admin/tabs
mkdir -p src/components/admin/modals
mkdir -p src/components/admin/shared
```

- [ ] **Step 2: Create `shared/types.ts` with shared type definitions**

Extract these types from AdminPanel.tsx:

```typescript
import { Teacher } from "../../types";

export type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  variant?: "default" | "destructive";
  requireTyped?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
} | null;

export type WorkloadBreakdown = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};

export type DayMinutes = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};
```

- [ ] **Step 3: Create `shared/helpers.ts` with utility functions**

Extract these module-level functions from AdminPanel.tsx (lines 133-346, 892-897):

```typescript
import { Teacher, TimetableEntry } from "../../types";
import { getCycleForDate, FAL_SUBJECTS } from "../../constants";
import { parseISO } from "date-fns";

export const getTimetableCell = (
  teacher: any,
  periodIdx: number,
  dateStr?: string,
) => {
  if (!teacher.timetable || !dateStr) {return null;}
  const dateUsed = parseISO(dateStr);
  const dayIndexUsed = dateUsed.getDay() === 0 ? 6 : dateUsed.getDay() - 1;
  const cycleKey = getCycleForDate(dateUsed) === 1 ? "cycle1" : "cycle2";
  const dayKey = dayIndexUsed.toString();
  const timetable = (teacher.timetable as any)[cycleKey];
  if (!timetable || !timetable[dayKey]) {return null;}
  return timetable[dayKey][periodIdx] || null;
};

export const getAssignmentKey = (
  pIdx: number,
  vId: string,
  role: string,
  index: number = 0,
) => {
  return `${pIdx}_${vId}_${role}${index > 0 ? `_${index}` : ""}`;
};

export const getEntryTimes = (entry: TimetableEntry, allEntries: TimetableEntry[]) => {
  // ... full implementation from L191-259
};

export const isITSpecialistTeacher = (teacher: Teacher) => {
  return ["FRAN", "JACB", "NORT", "ORMA"].includes(teacher.id);
};

export const isLSSpecialistTeacher = (teacher: Teacher) => {
  return ["CHAM", "EZNY", "ORIM", "CPMO", "ENYA"].includes(teacher.id);
};

export const isArtSpecialistTeacher = (teacher: Teacher) => {
  return ["SHEH", "SHHU"].includes(teacher.id);
};

export const isTeacherRestricted = (teacher: Teacher, subject: string) => {
  // ... full implementation from L273-315
};

export const isTechnicalStaffEligible = (teacher: Teacher, subject: string) => {
  // ... full implementation from L317-330
};

export const isTechnicalSubject = (subject: string) => {
  // ... full implementation from L332-346
};

export const periodDurationMinutes = (period: { start: string; end: string }) => {
  const [sh, sm] = period.start.split(":").map(Number);
  const [eh, em] = period.end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};
```

Each function is copied verbatim from AdminPanel.tsx and exported. The full implementation body is included — no placeholders.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/components/admin/shared/types.ts src/components/admin/shared/helpers.ts`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/
git commit -m "refactor(admin): create admin/ directory with shared types and helpers"
```

---

### Task 2: Extract shared sub-components

**Files:**
- Create: `src/components/admin/shared/ConfirmFromState.tsx`
- Create: `src/components/admin/shared/WorkloadBar.tsx`
- Create: `src/components/admin/shared/OverflowMenu.tsx`
- Create: `src/components/admin/shared/FacultyRow.tsx`
- Create: `src/components/admin/shared/InspectionCalendar.tsx`
- Create: `src/components/admin/shared/TimetableField.tsx`

- [ ] **Step 1: Extract ConfirmFromState (L103-130)**

Copy the `ConfirmFromState` function and its `ConfirmState` type import from `./types`. The component only depends on `ConfirmDialog` from `../ui`.

```typescript
// src/components/admin/shared/ConfirmFromState.tsx
import React from "react";
import { ConfirmDialog } from "../../ui";
import { ConfirmState } from "./types";

export function ConfirmFromState({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  if (!state) {return null;}
  return (
    <ConfirmDialog
      open={state.open}
      onCancel={onClose}
      onConfirm={async () => {
        const action = state.onConfirm;
        onClose();
        await action();
      }}
      title={state.title}
      message={state.message}
      variant={state.variant ?? "default"}
      requireTypedConfirmation={state.requireTyped}
      confirmLabel={state.confirmLabel}
    />
  );
}
```

- [ ] **Step 2: Extract WorkloadBar (L355-437)**

Copy `WorkloadBar` and the `WorkloadBreakdown` type import. It depends on React and lucide-react icons. Copy verbatim, add exports.

- [ ] **Step 3: Extract OverflowMenu (L438-540)**

Copy `OverflowMenu` and the `OverflowItem` type. It depends on React, lucide-react, and motion/react. Copy verbatim, add exports.

- [ ] **Step 4: Extract FacultyRow (L541-897)**

Copy `FacultyRow` and `FacultyRowProps`. This is a large component (357 lines) that depends on many icons, helpers, and types. All imports need to be updated to use relative paths from `admin/shared/`. The helper functions it uses (`isTeacherRestricted`, `isTechnicalStaffEligible`, `isTechnicalSubject`, etc.) now come from `./helpers`.

- [ ] **Step 5: Extract InspectionCalendar (L898-1123)**

Copy `InspectionCalendar` and `DayMinutes` type import. It depends on React, date-fns, lucide-react, and constants. Copy verbatim, add exports.

- [ ] **Step 6: Extract TimetableField (L6009-6248)**

Copy `TimetableField` and `TimetableFieldProps`. It depends on React, types, and various icons. Copy verbatim, add exports.

- [ ] **Step 7: Verify TypeScript compiles for all shared components**

Run: `npx tsc --noEmit`
Expected: No errors (these components are not yet imported anywhere, so this verifies they are self-consistent)

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/shared/
git commit -m "refactor(admin): extract shared sub-components from AdminPanel"
```

---

### Task 3: Extract modal components

**Files:**
- Create: `src/components/admin/modals/TimetableModal.tsx`
- Create: `src/components/admin/modals/SubjectsModal.tsx`
- Create: `src/components/admin/modals/AddTeacherModal.tsx`
- Create: `src/components/admin/modals/EditTeacherModal.tsx`
- Create: `src/components/admin/modals/BreakDutyModal.tsx`
- Create: `src/components/admin/modals/HomeRoomModal.tsx`
- Create: `src/components/admin/modals/LeaveRequestModal.tsx`
- Create: `src/components/admin/modals/VenueModal.tsx`
- Create: `src/components/admin/modals/PeriodConfigModal.tsx`
- Create: `src/components/admin/modals/StatsModal.tsx`

- [ ] **Step 1: Extract each modal one at a time**

For each modal, copy the function verbatim from AdminPanel.tsx, update imports to use relative paths from `admin/modals/`, and add `export`. Each modal's props interface stays co-located in the same file.

The modals and their source lines:
- `TimetableModal` (L4269-4410): Props: `teacher, onClose, onSave, isSaving`
- `SubjectsModal` (L4411-4536): Props: `teacher, onClose, onSave, isSaving, allSubjects`
- `AddTeacherModal` (L4537-4686): Props: `onClose, onSave, isSaving`
- `EditTeacherModal` (L4687-4813): Props: `teacher, onClose, onSave, isSaving`
- `BreakDutyModal` (L4814-5004): Props: `teacher, onClose, onSave, isSaving`
- `HomeRoomModal` (L5005-5105): Props: `teacher, onClose, onSave, isSaving`
- `LeaveRequestModal` (L5106-5363): Props: `teacher, onClose, user, requests, onSave, onUpdateStatus, onDelete, isSaving`
- `VenueModal` (L6434-6554): Props: `venue?, onClose, onSave`
- `PeriodConfigModal` (L8393-8513): Props: `isOpen, onClose, activePeriods, dayName, selectedDate, onSave, onReset`
- `StatsModal` (L8973-9089): Props: `isOpen, onClose, teachers, entries, dayPeriodConfigs`

Each modal file gets its own imports for React, types, icons, UI components, date-fns, etc. — only what that modal actually uses.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/modals/
git commit -m "refactor(admin): extract modal components from AdminPanel"
```

---

### Task 4: Extract standalone tab components

**Files:**
- Create: `src/components/admin/tabs/SubjectsTab.tsx`
- Create: `src/components/admin/tabs/VenuesTab.tsx`
- Create: `src/components/admin/tabs/SchedulerTab.tsx`
- Create: `src/components/admin/tabs/ExamTimetableTab.tsx`

- [ ] **Step 1: Extract SubjectsTab (L8514-8972)**

Copy verbatim. Props: `subjects, teachers, entries, isSaving, onBackup?`. Update imports to relative paths from `admin/tabs/`.

- [ ] **Step 2: Extract VenuesTab (L6249-6433)**

Copy verbatim. Props: `venues, isSaving (as parentSaving), onBackup?`. Update imports. Note: VenuesTab renders `VenueModal` — update the VenueModal import to `../modals/VenueModal`.

- [ ] **Step 3: Extract ExamTimetableTab (L5364-6008)**

Copy verbatim. Props: `date, setDate, entries, teachers, venues, isSaving, allSubjectsList, lockedDates, onBackup?`. Update imports. Note: ExamTimetableTab renders `TimetableField` — update import to `../shared/TimetableField`.

- [ ] **Step 4: Extract SchedulerTab (L6555-8392)**

This is the largest component (1,838 lines). Copy verbatim. It has many props (see analysis above). Update imports. Note: SchedulerTab renders `PeriodConfigModal` — update import to `../modals/PeriodConfigModal`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/tabs/
git commit -m "refactor(admin): extract standalone tab components from AdminPanel"
```

---

### Task 5: Extract inline tab content — FacultyTab

**Files:**
- Create: `src/components/admin/tabs/FacultyTab.tsx`

This is the first inline extraction. The FACULTY tab content (L2988-3148) is inline JSX inside AdminPanel. We wrap it into a component.

- [ ] **Step 1: Identify all variables used by the FACULTY tab JSX**

From the analysis, the FACULTY tab uses:
- **State:** `searchTerm`, `setSearchTerm`, `selectedSubject`, `setSelectedSubject`, `isAddModalOpen` (setter), `selectedTeacherForTimetable` (setter), `selectedTeacherForSubjects` (setter), `selectedTeacherForEdit` (setter), `selectedTeacherForBreakDuty` (setter), `selectedTeacherForHomeRoom` (setter), `selectedTeacherForLeave` (setter), `selectedInspectionTeacherId` (setter), `inspectionView` (setter), `activeTab` (setter), `confirmState` (setter), `isSaving` (setter)
- **Computed:** `allSubjects`, `workloadStats`, `wideLayout`, `currentCycle`, `getTeacherStatus`
- **Callbacks:** `handleFacultyBackup`, `handleUpdateTeacher`, `handleRemoveTeacher`
- **Data:** `teachers`, `leaveRequests`, `sessions`, `activeUser`

- [ ] **Step 2: Create FacultyTab with typed props interface**

Define a `FacultyTabProps` interface with all the variables from Step 1. Copy the JSX from L2988-3148 into the component's return. Update all imports (React, icons, types, UI components, modals → `../modals/`, shared → `../shared/`).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/tabs/FacultyTab.tsx
git commit -m "refactor(admin): extract FacultyTab from AdminPanel inline JSX"
```

---

### Task 6: Extract inline tab content — AssignmentsTab

**Files:**
- Create: `src/components/admin/tabs/AssignmentsTab.tsx`

- [ ] **Step 1: Identify all variables used by the ASSIGNMENTS tab JSX (L3150-3663)**

From the analysis:
- **State:** `assignmentsSubTab`/`setAssignmentsSubTab`, `showStats`/`setShowStats`, `enableCheckMode`/`setEnableCheckMode`, `isSaving`/`setIsSaving`, `activeTab`/`setActiveTab`, `confirmState`/`setConfirmState`
- **Computed:** `lastUpdatedDate`, `conflictMap`
- **Callbacks:** `handleExportAssignmentsCSV`, `handleEqualize`
- **Data:** `leaveRequests`, `entries`, `teachers`, `venues`, `dayPeriodConfigs`
- **Also:** `isGenerating`, `isEqualizing`

- [ ] **Step 2: Create AssignmentsTab with typed props interface**

Define `AssignmentsTabProps`. Copy JSX from L3150-3663. Update imports. Note: This tab renders `StatsModal` — update import to `../modals/StatsModal`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/tabs/AssignmentsTab.tsx
git commit -m "refactor(admin): extract AssignmentsTab from AdminPanel inline JSX"
```

---

### Task 7: Extract inline tab content — InspectionTab

**Files:**
- Create: `src/components/admin/tabs/InspectionTab.tsx`

- [ ] **Step 1: Identify all variables used by the INSPECTION tab JSX (L3736-4268)**

From the analysis:
- **State:** `selectedInspectionTeacherId`/`setSelectedInspectionTeacherId`, `inspectionView`/`setInspectionView`, `selectedInspectionDate`/`setSelectedInspectionDate`, `confirmState`/`setConfirmState`, `isSaving`/`setIsSaving`
- **Data:** `teachers`, `entries`, `dayPeriodConfigs`, `venues`
- **Inline Firestore mutations:** batch delete (L3802-3836), updateDoc to remove assignment (L4069-4089)

- [ ] **Step 2: Create InspectionTab with typed props interface**

Define `InspectionTabProps`. Copy JSX from L3736-4268. The inline Firestore mutations stay inside InspectionTab since they are inspection-specific. Update imports (firebase/firestore, handleFirestoreError from firebase, etc.). Note: This tab renders `InspectionCalendar` — update import to `../shared/InspectionCalendar`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/tabs/InspectionTab.tsx
git commit -m "refactor(admin): extract InspectionTab from AdminPanel inline JSX"
```

---

### Task 8: Create TimetableTab wrapper

**Files:**
- Create: `src/components/admin/tabs/TimetableTab.tsx`

The TIMETABLE tab (L3665-3677) is just a thin wrapper that renders `<ExamTimetableTab>` with props. Create it as a component.

- [ ] **Step 1: Create TimetableTab**

```typescript
import React from "react";
import { ExamTimetableTab } from "./ExamTimetableTab";
import { Teacher, TimetableEntry, Venue, Subject } from "../../types";

interface TimetableTabProps {
  timetableDate: string;
  setTimetableDate: (d: string) => void;
  entries: TimetableEntry[];
  teachers: Teacher[];
  venues: Venue[];
  isSaving: boolean;
  subjects: Subject[];
  lockedDates: string[];
  onBackup?: () => void;
}

export function TimetableTab({
  timetableDate,
  setTimetableDate,
  entries,
  teachers,
  venues,
  isSaving,
  subjects,
  lockedDates,
  onBackup,
}: TimetableTabProps) {
  return (
    <ExamTimetableTab
      date={timetableDate}
      setDate={setTimetableDate}
      entries={entries}
      teachers={teachers}
      venues={venues}
      isSaving={isSaving}
      allSubjectsList={subjects}
      lockedDates={lockedDates}
      onBackup={onBackup}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/tabs/TimetableTab.tsx
git commit -m "refactor(admin): create TimetableTab wrapper component"
```

---

### Task 9: Rebuild AdminPanel as shell

**Files:**
- Create: `src/components/admin/AdminPanel.tsx`
- Create: `src/components/admin/index.ts`
- Modify: `src/App.tsx` (update import path)

This is the critical task. We rewrite AdminPanel.tsx as a shell that:
1. Owns all shared state (useState, useMemo)
2. Defines all Firestore mutation handlers
3. Renders the tab bar
4. Renders the active tab component, passing needed state/callbacks as props

- [ ] **Step 1: Create the new AdminPanel shell**

The shell contains:
- All imports from the new sub-component files
- The `Props` interface (unchanged)
- All `useState` declarations (unchanged, still owned here)
- All `useMemo`/computed values (unchanged)
- All handler functions (`handleTimetableBackup`, `handleSubjectBackup`, `handleFacultyBackup`, `handleVenueBackup`, `handleAutoGenerate`, `handleEqualize`, `handleExportAssignmentsCSV`, `handleRemoveTeacher`, `handleUpdateTeacher`, `bootstrapFaculty`)
- The `getPeriodsForDate`, `getRelevantPeriodsIdx`, `isTeacherOnLeaveAtPeriod`, `isAssignedToGradeInPeriod`, `isFreeInPeriod` functions (these depend on state/data only available in AdminPanel)
- The tab bar JSX (`<Tabs>`, `<TabButton>` list)
- Tab content replaced with component renders:

```tsx
{activeTab === "SUBJECTS" && (
  <SubjectsTab subjects={subjects} teachers={teachers} entries={entries} isSaving={isSaving} onBackup={handleSubjectBackup} />
)}
{activeTab === "FACULTY" && (
  <FacultyTab
    teachers={teachers}
    // ... all props identified in Task 5
  />
)}
{activeTab === "ASSIGNMENTS" && (
  <AssignmentsTab
    // ... all props identified in Task 6
  />
)}
{activeTab === "TIMETABLE" && (
  <TimetableTab
    timetableDate={timetableDate}
    setTimetableDate={setTimetableDate}
    entries={entries}
    teachers={teachers}
    venues={venues}
    isSaving={isSaving}
    subjects={subjects}
    lockedDates={lockedDates}
    onBackup={handleTimetableBackup}
  />
)}
{activeTab === "VENUES" && (
  <VenuesTab venues={venues} isSaving={isSaving} onBackup={handleVenueBackup} />
)}
{activeTab === "SCHEDULER" && (
  <SchedulerTab
    // ... all existing props passed to SchedulerTab
  />
)}
{activeTab === "INSPECTION" && (
  <InspectionTab
    // ... all props identified in Task 7
  />
)}
```

The modals that are triggered from FacultyTab are rendered inside FacultyTab itself (they were already conditionally rendered based on `selectedTeacherFor*` state). The `ConfirmFromState` component and `confirmState` are passed to tabs that need them, or rendered at the AdminPanel level if shared.

- [ ] **Step 2: Create `index.ts` re-export**

```typescript
export { default } from "./AdminPanel";
```

- [ ] **Step 3: Update App.tsx import**

Change:
```typescript
const AdminPanel = lazy(() => import('./components/AdminPanel'));
```
To:
```typescript
const AdminPanel = lazy(() => import('./components/admin'));
```

- [ ] **Step 4: Delete the old AdminPanel.tsx**

```bash
rm src/components/AdminPanel.tsx
```

- [ ] **Step 5: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors. Fix any import path issues.

- [ ] **Step 6: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(admin): rebuild AdminPanel as shell, delete monolith"
```

---

### Task 10: Move test files and verify

**Files:**
- Move: `src/components/AdminPanel.confirm.test.tsx` → `src/components/admin/AdminPanel.confirm.test.tsx`
- Move: `src/components/AdminPanel.modals.test.tsx` → `src/components/admin/AdminPanel.modals.test.tsx`
- Move: `src/components/AdminPanel.toast.test.tsx` → `src/components/admin/AdminPanel.toast.test.tsx`

- [ ] **Step 1: Move test files**

```bash
mv src/components/AdminPanel.confirm.test.tsx src/components/admin/
mv src/components/AdminPanel.modals.test.tsx src/components/admin/
mv src/components/AdminPanel.toast.test.tsx src/components/admin/
```

- [ ] **Step 2: Update test file imports**

The test files import from `./ui` — update to `../ui` since they've moved one directory deeper. Check each file and fix the relative import path.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): move AdminPanel test files to admin/ directory"
```

---

### Task 11: Final verification and lint

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npx eslint src/components/admin/ --ext .ts,.tsx`
Expected: No errors (fix any that appear)

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Verify AdminPanel shell line count**

Run: `wc -l src/components/admin/AdminPanel.tsx`
Expected: Under 500 lines

- [ ] **Step 5: Verify no file exceeds 2,000 lines**

Run: `find src/components/admin/ -name "*.tsx" -exec wc -l {} + | sort -rn | head -5`
Expected: No file over 2,000 lines

- [ ] **Step 6: Verify the app builds**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 7: Commit any lint fixes**

```bash
git add -A
git commit -m "refactor(admin): fix lint issues after component split"
```
