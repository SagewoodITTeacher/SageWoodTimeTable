# AdminPanel Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all HIGH and MEDIUM severity code duplications across the AdminPanel codebase by extracting shared helpers, merging duplicate components, and replacing inline copies with canonical implementations.

**Architecture:** Centralize duplicated logic into `shared/helpers.ts` and new shared components. Fix the LS specialist bug. Merge duplicate modals. Extract repeated UI patterns into shared constants/components.

**Tech Stack:** React, TypeScript, Vitest, date-fns, firebase/firestore, lucide-react, Tailwind CSS

---

## File Structure

```
src/components/admin/shared/
  helpers.ts          — ADD: getPeriodsForDate, isTeacherOnLeaveAtPeriod, isEligibleForInvigilation, isExcludedFromInvigilation, isSHEHOverride, isITorCATSubject, isLSSubject, isArtSubject, safeFirestoreWrite, INPUT_CLASS, TH_CLASS
  types.ts            — existing (no changes)
  TeacherStatusBadges.tsx — NEW: shared badge component for M6
src/components/admin/modals/
  TeacherFormModal.tsx — NEW: merged AddTeacher/EditTeacher (replaces both)
  (AddTeacherModal.tsx and EditTeacherModal.tsx deleted)
```

---

### Task 1: Extract shared helpers — period resolution, leave check, eligibility, exclusions, subject detection, SHEH override, Firestore helper, UI constants

**Files:**
- Modify: `src/components/admin/shared/helpers.ts`

This task consolidates the highest-impact duplications into the existing helpers file.

- [ ] **Step 1: Add `getPeriodsForDate` to helpers.ts**

This function already exists in AdminPanel.tsx (lines 123-166). Move it to helpers.ts so all consumers can import it. The function needs `dayPeriodConfigs` as a parameter since helpers.ts can't access React state.

```typescript
export const getPeriodsForDate = (
  dateStr: string,
  dayPeriodConfigs: DayPeriodConfig[],
): PeriodConfig[] => {
  const d = parseISO(dateStr);
  const dayName = format(d, "EEEE");
  const dateConfig = dayPeriodConfigs.find((c) => c.id === dateStr);
  const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
  let basePeriods: PeriodConfig[] = [];

  if (dateConfig) {
    basePeriods = [...dateConfig.periods];
  } else if (dayConfig) {
    basePeriods = [...dayConfig.periods];
  } else if (dayName === "Wednesday") {
    basePeriods = [...WEDNESDAY_PERIODS];
  } else {
    basePeriods = [...PERIODS];
  }

  const standardDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];
  if (standardDays.includes(dayName)) {
    const extraSlots = [
      { id: 10, start: "14:30", end: "15:20", label: "A1" },
      { id: 11, start: "15:20", end: "16:10", label: "A2" },
      { id: 12, start: "16:10", end: "17:00", label: "A3" },
    ];

    extraSlots.forEach((slot) => {
      if (
        !basePeriods.some(
          (p) => p.label === slot.label || p.start === slot.start,
        )
      ) {
        basePeriods.push(slot);
      }
    });
  }

  return basePeriods.sort((a, b) => a.start.localeCompare(b.start));
};
```

Add required imports at top of helpers.ts: `DayPeriodConfig`, `PeriodConfig` from `../../../types`, `PERIODS`, `WEDNESDAY_PERIODS` from `../../../constants`, `format`, `parseISO` from `date-fns`.

- [ ] **Step 2: Add `isTeacherOnLeaveAtPeriod` to helpers.ts**

Extracted from the canonical version in AdminPanel.tsx (lines 358-405), but using `getPeriodsForDate` instead of inline period resolution:

```typescript
export const isTeacherOnLeaveAtPeriod = (
  teacherId: string,
  periodIdx: number,
  dateStr: string,
  teachers: Teacher[],
  leaveRequests: LeaveRequest[],
  dayPeriodConfigs: DayPeriodConfig[],
): boolean => {
  if (isExcludedFromInvigilation(teachers.find(t => t.id === teacherId))) {
    return true;
  }

  const datePeriods = getPeriodsForDate(dateStr, dayPeriodConfigs);
  const period = datePeriods[periodIdx];
  if (!period) {return false;}

  const request = (leaveRequests || []).find(
    (lr) =>
      lr.teacherId === teacherId &&
      lr.date === dateStr &&
      (lr.status === "APPROVED" || lr.status === "PENDING"),
  );
  if (!request) {return false;}

  if (isSHEHOverride(teacherId, dateStr)) {
    return false;
  }

  if (request.isFullDay) {return true;}

  if (request.startTime || request.endTime) {
    const pStart = period.start;
    const pEnd = period.end;
    const lStart = request.startTime || "00:00";
    const lEnd = request.endTime || "23:59";
    return pStart < lEnd && lStart < pEnd;
  }

  return false;
};
```

Add `LeaveRequest` to imports from `../../../types`.

- [ ] **Step 3: Add `isExcludedFromInvigilation` to helpers.ts**

Replaces all 8 copies of the Merike van Dyk exclusion with a single ID-based check:

```typescript
const EXCLUDED_FROM_INVIGILATION_IDS = new Set(["MERV"]);

export const isExcludedFromInvigilation = (teacher: Teacher | undefined | null): boolean => {
  if (!teacher) {return false;}
  return EXCLUDED_FROM_INVIGILATION_IDS.has(teacher.id);
};
```

- [ ] **Step 4: Add `isEligibleForInvigilation` to helpers.ts**

Replaces all 4 copies of the teacher eligibility filter:

```typescript
const FRANZ_IDS = new Set(["NORT", "FRAN"]);

export const isEligibleForInvigilation = (teacher: Teacher): boolean => {
  const isSpec = isITSpecialistTeacher(teacher) || isLSSpecialistTeacher(teacher) || isArtSpecialistTeacher(teacher);
  const isFranz = FRANZ_IDS.has(teacher.id);
  return !isExcludedFromInvigilation(teacher) && (isSpec || isFranz || (teacher.activeRole !== "WEBMASTER" && teacher.canInvigilate !== false));
};
```

- [ ] **Step 5: Add `isSHEHOverride` to helpers.ts**

Replaces all 6 copies of the SHEH Visual Art date override:

```typescript
const SHEH_OVERRIDE_DATES = new Set(["2026-06-18", "2026-06-19"]);

export const isSHEHOverride = (teacherId: string, dateStr: string): boolean => {
  return teacherId === "SHEH" && SHEH_OVERRIDE_DATES.has(dateStr);
};
```

- [ ] **Step 6: Add subject detection helpers to helpers.ts**

Replaces all 4 inline copies of IT/LS/Art subject detection:

```typescript
export const isITorCATSubject = (subject: string): boolean => {
  const s = subject.toLowerCase().trim();
  return s === "it" || s === "cat" || s.startsWith("it ") || s.startsWith("cat ") || s.includes("information technology") || s.includes("computer application technology");
};

export const isLSSubject = (subject: string): boolean => {
  const s = subject.toLowerCase().trim();
  return s === "ls" || s === "life science" || s === "life sciences" || s.includes("life science");
};

export const isArtSubject = (subject: string): boolean => {
  const s = subject.toLowerCase().trim();
  return s === "visual art" || s.includes("visual art");
};
```

- [ ] **Step 7: Add `safeFirestoreWrite` to helpers.ts**

Replaces the 39 occurrences of the try/catch/finally Firestore pattern:

```typescript
export async function safeFirestoreWrite<T>(
  operation: () => Promise<T>,
  opType: OperationType,
  path: string,
  onError: (error: unknown, opType: OperationType, path: string) => void,
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    onError(error, opType, path);
    return undefined;
  }
}
```

Add `OperationType` import from `../../../firebase`.

- [ ] **Step 8: Add UI className constants to helpers.ts**

```typescript
export const INPUT_CLASS = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none";
export const TH_CLASS = "px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none";
```

- [ ] **Step 9: Add `resolvePeriodsForDate` (simpler version without extra slots) to helpers.ts**

For consumers that need the basic period resolution without the A1/A2/A3 extra slots (used in workload.ts, InspectionCalendar, etc.):

```typescript
export const resolvePeriodsForDate = (
  dateStr: string,
  dayPeriodConfigs: DayPeriodConfig[],
): PeriodConfig[] => {
  const d = parseISO(dateStr);
  const dayName = format(d, "EEEE");
  const dateConfig = dayPeriodConfigs.find((c) => c.id === dateStr);
  const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
  if (dateConfig) {return dateConfig.periods;}
  if (dayConfig) {return dayConfig.periods;}
  return dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS;
};
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/components/admin/shared/helpers.ts
git commit -m "refactor(admin): add shared helpers for period resolution, leave check, eligibility, exclusions, subject detection, SHEH override, Firestore helper, UI constants"
```

---

### Task 2: Replace all inline period-resolution copies with `getPeriodsForDate` / `resolvePeriodsForDate`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/AssignmentsTab.tsx`
- Modify: `src/components/admin/tabs/InspectionTab.tsx`
- Modify: `src/components/admin/shared/InspectionCalendar.tsx`
- Modify: `src/lib/workload.ts`

- [ ] **Step 1: Replace in AdminPanel.tsx**

AdminPanel.tsx already has a local `getPeriodsForDate` (lines 123-166). Replace it with an import from `./shared/helpers`. The local version takes no `dayPeriodConfigs` param (it closes over the hook data), so create a local wrapper:

```typescript
import { getPeriodsForDate as _getPeriodsForDate, resolvePeriodsForDate as _resolvePeriodsForDate } from "./shared/helpers";

// Then inside the component:
const getPeriodsForDate = (dateStr: string) => _getPeriodsForDate(dateStr, dayPeriodConfigs);
const resolvePeriodsForDate = (dateStr: string) => _resolvePeriodsForDate(dateStr, dayPeriodConfigs);
```

Delete the old local function definition (lines 123-166).

Replace the 3 inline IIFE period resolutions:
- In `isTeacherOnLeaveAtPeriod` (line 369): replace the IIFE with `const datePeriods = resolvePeriodsForDate(dateStr);`
- In `workloadStats` (line 1451): replace the IIFE with `const datePeriods = resolvePeriodsForDate(entry.date);`
- In `handleExportAssignmentsCSV` (line 1585): replace the inline resolution with `const datePeriods = resolvePeriodsForDate(entry.date);`

- [ ] **Step 2: Replace in AssignmentsTab.tsx**

Import `resolvePeriodsForDate` from `../shared/helpers`. Replace the inline period resolution (around line 433-437) with `const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);`.

- [ ] **Step 3: Replace in InspectionTab.tsx**

Import `resolvePeriodsForDate` from `../shared/helpers`. Replace both inline period resolutions (lines 88 and 275) with `const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);`.

- [ ] **Step 4: Replace in InspectionCalendar.tsx**

Import `resolvePeriodsForDate` from `./helpers`. Replace the inline period resolution (lines 33-41) with `const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);`. Note: `dayPeriodConfigs` is already a prop of this component.

- [ ] **Step 5: Replace in lib/workload.ts**

Import `resolvePeriodsForDate` from `../components/admin/shared/helpers` (or consider moving to a path that doesn't create a circular dep — if workload.ts is imported by helpers, this won't work. Check first). If circular dep is an issue, keep the inline version in workload.ts but update it to use the day-name config lookup:

```typescript
const dc = dayPeriodConfigs.find(c => c.id === entry.date);
const d = parseISO(entry.date);
const dayName = format(d, 'EEEE');
const dayConfig = dayPeriodConfigs.find(c => c.id === dayName);
const periodsToUse = dc ? dc.periods : (dayConfig ? dayConfig.periods : (dayName === 'Wednesday' ? WEDNESDAY_PERIODS : PERIODS));
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace inline period-resolution copies with shared helpers"
```

---

### Task 3: Replace all inline period-duration copies with `periodDurationMinutes`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/InspectionTab.tsx`
- Modify: `src/lib/workload.ts`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `periodDurationMinutes` from `./shared/helpers`. Replace all inline duration calculations in `workloadStats` (line 1489) and `handleAutoGenerate` (lines 508, 544, 772, 826, 857) with calls to `periodDurationMinutes(period)`. For the copies that divide by 60 for hours, use `periodDurationMinutes(period) / 60`.

- [ ] **Step 2: Replace in InspectionTab.tsx**

Import `periodDurationMinutes` from `../shared/helpers`. Replace the inline calculation (line 293) with:
```typescript
const durationMinutes = period ? periodDurationMinutes(period) : 0;
```

- [ ] **Step 3: Replace in lib/workload.ts**

Import `periodDurationMinutes` from the appropriate path (check for circular deps). Replace the inline calculation (line 62) with `duration = periodDurationMinutes(p);`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace inline period-duration copies with periodDurationMinutes helper"
```

---

### Task 4: Replace inline subject detection copies with helpers + fix LS specialist bug

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `isLSSubject` from `./shared/helpers`. Replace the inline `isLS` check in `isTeacherEligibleForEqualizeSlot` (line 1054) with `const isLS = isLSSubject(entry.subject);`.

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `isITorCATSubject`, `isLSSubject`, `isArtSubject`, `isLSSpecialistTeacher` from `../shared/helpers`.

Replace the 3 inline copies:
- `removeAssignment` (line 372): replace `const isITorCAT = ...` with `const isITorCAT = isITorCATSubject(entry.subject);`
- `teachersWithStatus` (line 830): replace `isITorCATEntry`, `isLSEntry`, `isArtEntry` with `isITorCATSubject(s)`, `isLSSubject(s)`, `isArtSubject(s)`
- Assignment slot rendering (line 1306): replace `isITorCAT` and `isLS` with `isITorCATSubject(s)` and `isLSSubject(s)`

**Fix the LS specialist bug** (line 1309-1311): Replace the name-based `isLSSpecialist` check with `const isLSSpecialist = isLSSpecialistTeacher(teacher);`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(admin): replace inline subject detection with helpers, fix LS specialist bug in SchedulerTab"
```

---

### Task 5: Replace Merike exclusion copies with `isExcludedFromInvigilation`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`
- Modify: `src/components/admin/tabs/ExamTimetableTab.tsx`
- Modify: `src/lib/workload.ts`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `isExcludedFromInvigilation` from `./shared/helpers`. Replace all 4 occurrences:
- `isTeacherOnLeaveAtPeriod` (line 366): replace `if (name.includes("merike") && name.includes("van dyk")) {return true;}` with `if (isExcludedFromInvigilation(t)) {return true;}`
- `handleAutoGenerate` (line 479): replace `const isMerike = ...` with `const isMerike = isExcludedFromInvigilation(t);`
- `handleEqualize` (line 920): same replacement
- `workloadStats` (line 1432): same replacement

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `isExcludedFromInvigilation` from `../shared/helpers`. Replace:
- `isTeacherOnLeaveAtPeriod` (line 490): replace the Merike name check with `if (isExcludedFromInvigilation(t)) {return true;}`
- `teachersWithStatus` (line 802): replace `const isMerike = ...` with `const isMerike = isExcludedFromInvigilation(t);`
- `eligibleTeachersWithStatus` (line 892): replace `!name.includes("merike van dyk")` with `!isExcludedFromInvigilation(t)`

- [ ] **Step 3: Replace in ExamTimetableTab.tsx**

Import `isExcludedFromInvigilation` from `../shared/helpers`. Replace the name-based exclusion (lines 103-106) with `isExcludedFromInvigilation(t)`. Also replace `t.id !== "MERV"` (line 106) with `!isExcludedFromInvigilation(t)`.

- [ ] **Step 4: Replace in lib/workload.ts**

Import `isExcludedFromInvigilation` from the appropriate path. Replace the `excludedNames` config approach (line 26, 85-86) with `isExcludedFromInvigilation(t)`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace all Merike exclusion copies with isExcludedFromInvigilation helper"
```

---

### Task 6: Replace teacher eligibility filter copies with `isEligibleForInvigilation`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `isEligibleForInvigilation` from `./shared/helpers`. Replace the 3 occurrences:
- `handleAutoGenerate` (line 477): replace the entire `teachers.filter(...)` with `teachers.filter(t => t.invigilationPreference !== "OPS" && isEligibleForInvigilation(t))`
- `handleEqualize` (line 918): same replacement
- `workloadStats` (line 1430): replace the exclusion check with `if (!isEligibleForInvigilation(t)) {return;}` (note: this copy doesn't exclude OPS, but that's because workload stats should include OPS teachers — keep the original behavior)

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `isEligibleForInvigilation` from `../shared/helpers`. Replace the `teachersWithStatus` filter (line 794) with:
```typescript
const teachersWithStatus = teachers.filter(t => isEligibleForInvigilation(t))
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace teacher eligibility filter copies with isEligibleForInvigilation helper"
```

---

### Task 7: Replace SHEH override copies with `isSHEHOverride`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `isSHEHOverride` from `./shared/helpers`. Replace all 5 occurrences:
- `isTeacherOnLeaveAtPeriod` (line 390): `if (isSHEHOverride(teacherId, dateStr)) {return false;}`
- `handleAutoGenerate` SHEH auto-assign (line 600): `if (isSHEHOverride("", dateStr) ...` — this one is different, it checks the DATE only for Visual Art entries. Keep the date check but use the constant: `if (SHEH_OVERRIDE_DATES.has(e.date) && e.subject.toLowerCase().includes("visual art"))`. Export `SHEH_OVERRIDE_DATES` from helpers.
- `handleAutoGenerate` invigilator filter (line 740): `if (isSHEHOverride(t.id, dateStr)) {continue;}`
- `handleAutoGenerate` standby filter (line 800): `if (isSHEHOverride(t.id, dateStr)) {continue;}`
- `isTeacherEligibleForEqualizeSlot` (line 1032): `if (isSHEHOverride(t.id, dateStr)) {const isArtTech = ...; if (!isArtTech) {return false;}}`

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `isSHEHOverride` from `../shared/helpers`. Replace:
- `isTeacherOnLeaveAtPeriod` (line 506): `if (isSHEHOverride(teacherId, dateStr)) {return false;}`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace SHEH override copies with isSHEHOverride helper"
```

---

### Task 8: Replace `isTeacherOnLeaveAtPeriod` copy in SchedulerTab with shared helper

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Replace in AdminPanel.tsx**

Import `isTeacherOnLeaveAtPeriod` from `./shared/helpers`. Delete the local function definition (lines 358-405). Update all call sites to pass the additional parameters (`teachers`, `leaveRequests`, `dayPeriodConfigs`).

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `isTeacherOnLeaveAtPeriod` from `../shared/helpers`. Delete the local function definition (lines 482-521). Update all call sites to pass the additional parameters.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace isTeacherOnLeaveAtPeriod copies with shared helper"
```

---

### Task 9: Merge AddTeacherModal and EditTeacherModal into TeacherFormModal

**Files:**
- Create: `src/components/admin/modals/TeacherFormModal.tsx`
- Delete: `src/components/admin/modals/AddTeacherModal.tsx`
- Delete: `src/components/admin/modals/EditTeacherModal.tsx`
- Modify: `src/components/admin/tabs/FacultyTab.tsx` (update imports)
- Modify: `src/components/admin/AdminPanel.tsx` (update imports if needed)

- [ ] **Step 1: Create TeacherFormModal.tsx**

The merged component takes a `mode` prop:

```typescript
import React, { useState } from "react";
import { Teacher } from "../../../types";
import { Modal } from "../../ui";
import { X, Save } from "lucide-react";
import { INPUT_CLASS } from "../shared/helpers";

interface TeacherFormModalProps {
  mode: "add" | "edit";
  teacher?: Teacher;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}

export function TeacherFormModal({ mode, teacher, onClose, onSave, isSaving }: TeacherFormModalProps) {
  const isAdd = mode === "add";
  const [formData, setFormData] = useState({
    id: teacher?.id || "",
    firstName: teacher?.firstName || "",
    lastName: teacher?.lastName || "",
    email: teacher?.email || "",
    workloadPercentage: teacher?.workloadPercentage || 100,
  });

  const handleSubmit = async () => {
    if (isAdd) {
      await onSave({
        ...formData,
        roles: ["TEACHER"],
        activeRole: "TEACHER",
        totalHours: 0,
        workloadPercentage: formData.workloadPercentage,
      });
    } else {
      await onSave(formData);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isAdd ? "Register New Staff" : "Edit Staff Profile"}
    >
      <div className="space-y-4">
        {isAdd && (
          <div>
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Staff Code
            </label>
            <input
              className={`${INPUT_CLASS} placeholder:text-gray-300 font-black`}
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
              placeholder="e.g. SMIT01"
            />
          </div>
        )}
        <div>
          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
            {isAdd ? "Email" : "Email Association"}
          </label>
          <input
            className={`${INPUT_CLASS} ${isAdd ? "placeholder:text-gray-300" : ""}`}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder={isAdd ? "email@example.com" : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              First Name
            </label>
            <input
              className={`${INPUT_CLASS} ${isAdd ? "placeholder:text-gray-300" : ""}`}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder={isAdd ? "First name" : undefined}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Last Name
            </label>
            <input
              className={`${INPUT_CLASS} ${isAdd ? "placeholder:text-gray-300" : ""}`}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder={isAdd ? "Last name" : undefined}
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
            Workload %
          </label>
          <input
            className={INPUT_CLASS}
            type="number"
            min={0}
            max={100}
            value={formData.workloadPercentage}
            onChange={(e) => setFormData({ ...formData, workloadPercentage: Number(e.target.value) })}
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className={`flex-1 ${isAdd ? "bg-curro-blue" : "bg-zinc-800 border-b-2 border-curro-blue"} text-white font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50`}
          >
            {isSaving ? "Saving..." : isAdd ? "REGISTER STAFF" : "UPDATE PROFILE"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
          >
            {isAdd ? "Cancel" : "Discard"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Update FacultyTab.tsx imports**

Replace `import { AddTeacherModal } from "../modals/AddTeacherModal"` and `import { EditTeacherModal } from "../modals/EditTeacherModal"` with `import { TeacherFormModal } from "../modals/TeacherFormModal"`.

Update JSX:
- Replace `<AddTeacherModal ...>` with `<TeacherFormModal mode="add" ...>`
- Replace `<EditTeacherModal teacher={...} ...>` with `<TeacherFormModal mode="edit" teacher={...} ...>`

- [ ] **Step 3: Delete old modal files**

```bash
rm src/components/admin/modals/AddTeacherModal.tsx
rm src/components/admin/modals/EditTeacherModal.tsx
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): merge AddTeacherModal and EditTeacherModal into TeacherFormModal"
```

---

### Task 10: Extract Morning/Afternoon session blocks in ExamTimetableTab

**Files:**
- Modify: `src/components/admin/tabs/ExamTimetableTab.tsx`

- [ ] **Step 1: Create a `renderSessionBlock` function inside ExamTimetableTab**

Extract the duplicated session block into a local function that parameterizes the differences:

```typescript
const renderSessionBlock = (
  session: "MORNING" | "AFTERNOON",
  colorScheme: {
    text: string;
    bg: string;
    border: string;
    hover: string;
    btnBg: string;
  },
  startTimeNote: string,
  emptyText: string,
  addBtnText: string,
) => {
  // ... the shared JSX structure, using the parameters for differences
};
```

Then replace the two blocks with:
```tsx
{renderSessionBlock("MORNING", { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", hover: "hover:bg-emerald-50", btnBg: "bg-emerald-600" }, "Start: 08:20 (Arrive 07:50 / 07:30 Gr12)", "No morning exams planned", "Add Morning Subject")}
{renderSessionBlock("AFTERNOON", { text: "text-curro-red", bg: "bg-red-50", border: "border-red-100", hover: "hover:bg-red-50", btnBg: "bg-curro-red" }, "Start: 13:20 (Arrive 12:50 / 12:30 Gr12)", "No afternoon exams planned", "Add Afternoon Subject")}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(admin): extract Morning/Afternoon session blocks into renderSessionBlock"
```

---

### Task 11: Extract TeacherStatusBadges component for M6

**Files:**
- Create: `src/components/admin/shared/TeacherStatusBadges.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Create TeacherStatusBadges.tsx**

```typescript
import React from "react";

interface TeacherStatusBadgesProps {
  isBlockedByBreak?: boolean;
  isBlockedByAfternoon?: boolean;
  isUsed?: boolean;
}

export function TeacherStatusBadges({
  isBlockedByBreak,
  isBlockedByAfternoon,
  isUsed,
}: TeacherStatusBadgesProps) {
  return (
    <>
      {isBlockedByBreak && (
        <span className="text-[7px] font-black bg-amber-600 text-white px-1 rounded uppercase whitespace-nowrap">
          Break Duty
        </span>
      )}
      {isBlockedByAfternoon && (
        <span className="text-[7px] font-black bg-blue-600 text-white px-1 rounded uppercase whitespace-nowrap">
          Afternoon Duty
        </span>
      )}
      {isUsed && !isBlockedByBreak && !isBlockedByAfternoon && (
        <span className="text-[7px] font-black bg-gray-500 text-white px-1 rounded uppercase whitespace-nowrap">
          Occupied
        </span>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace in SchedulerTab.tsx**

Import `TeacherStatusBadges` from `../shared/TeacherStatusBadges`. Replace all 3 copies of the badge JSX with `<TeacherStatusBadges isBlockedByBreak={isBlockedByBreak} isBlockedByAfternoon={isBlockedByAfternoon} isUsed={isUsed} />`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): extract TeacherStatusBadges component, replace 3 copies in SchedulerTab"
```

---

### Task 12: Replace FAL subject matching in ExamTimetableTab with `isTeacherRestricted`

**Files:**
- Modify: `src/components/admin/tabs/ExamTimetableTab.tsx`

- [ ] **Step 1: Import and use `isTeacherRestricted` from helpers**

In the `getTeacherCodes` function (lines 211-224), replace the inline FAL matching with `isTeacherRestricted(t, subject)`. The function already handles FAL subjects correctly.

Update the filter:
```typescript
return teachers
  .filter((t) => isTeacherRestricted(t, subject))
  .map((t) => t.id)
  .join(", ");
```

Import `isTeacherRestricted` from `../shared/helpers`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace inline FAL matching in ExamTimetableTab with isTeacherRestricted helper"
```

---

### Task 13: Consolidate specialist ID lists — staff-config.ts uses helpers

**Files:**
- Modify: `src/lib/staff-config.ts`

- [ ] **Step 1: Import specialist functions from helpers and derive IDs**

Replace the hardcoded `specialistIds` array in staff-config.ts with imports from helpers:

```typescript
import { isITSpecialistTeacher, isLSSpecialistTeacher, isArtSpecialistTeacher } from "../components/admin/shared/helpers";

// Derive the combined list from the helper functions
// Since the helpers use closures over ID arrays, we need to export the IDs from helpers too
```

Actually, the cleanest approach is to export the ID arrays from helpers.ts and import them in staff-config.ts:

In helpers.ts, add:
```typescript
export const IT_SPECIALIST_IDS = ["FRAN", "JACB", "NORT", "ORMA"];
export const LS_SPECIALIST_IDS = ["CHAM", "EZNY", "ORIM", "CPMO", "ENYA"];
export const ART_SPECIALIST_IDS = ["SHEH", "SHHU"];
export const ALL_SPECIALIST_IDS = [...IT_SPECIALIST_IDS, ...LS_SPECIALIST_IDS, ...ART_SPECIALIST_IDS];
```

Then update the helper functions to use these arrays:
```typescript
export const isITSpecialistTeacher = (teacher: Teacher) => IT_SPECIALIST_IDS.includes(teacher.id);
export const isLSSpecialistTeacher = (teacher: Teacher) => LS_SPECIALIST_IDS.includes(teacher.id);
export const isArtSpecialistTeacher = (teacher: Teacher) => ART_SPECIALIST_IDS.includes(teacher.id);
```

In staff-config.ts:
```typescript
import { ALL_SPECIALIST_IDS } from "../components/admin/shared/helpers";
// Use ALL_SPECIALIST_IDS instead of the hardcoded array
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(admin): consolidate specialist ID lists, staff-config imports from helpers"
```

---

### Task 14: Replace UI className constants (INPUT_CLASS, TH_CLASS)

**Files:**
- Modify: All modal files that use the input className
- Modify: All tab files that use the table header className

- [ ] **Step 1: Replace INPUT_CLASS in modal files**

Import `INPUT_CLASS` from `../shared/helpers` (or `../../shared/helpers` for modals). Replace all occurrences of the input className string with `INPUT_CLASS` or `${INPUT_CLASS} placeholder:text-gray-300` where the placeholder variant is needed.

Files to update:
- `modals/TeacherFormModal.tsx` (already done in Task 9)
- `modals/BreakDutyModal.tsx`
- `modals/LeaveRequestModal.tsx`
- `modals/VenueModal.tsx`
- `modals/SubjectsModal.tsx`
- `modals/TimetableModal.tsx`
- `modals/HomeRoomModal.tsx`
- `tabs/SubjectsTab.tsx`
- `tabs/VenuesTab.tsx`
- `tabs/ExamTimetableTab.tsx`
- `tabs/SchedulerTab.tsx`

- [ ] **Step 2: Replace TH_CLASS in tab files**

Import `TH_CLASS` from the appropriate relative path. Replace `<th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">` with `<th className={TH_CLASS}>`.

Files to update:
- `tabs/AssignmentsTab.tsx`
- `tabs/InspectionTab.tsx`
- `modals/StatsModal.tsx`
- `tabs/SubjectsTab.tsx`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace inline className strings with INPUT_CLASS and TH_CLASS constants"
```

---

### Task 15: Replace Firestore write+error pattern with `safeFirestoreWrite`

**Files:**
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/tabs/AssignmentsTab.tsx`
- Modify: `src/components/admin/tabs/InspectionTab.tsx`
- Modify: `src/components/admin/tabs/SubjectsTab.tsx`
- Modify: `src/components/admin/tabs/VenuesTab.tsx`
- Modify: `src/components/admin/tabs/ExamTimetableTab.tsx`
- Modify: `src/components/admin/tabs/SchedulerTab.tsx`

- [ ] **Step 1: Replace in all files**

For each file, import `safeFirestoreWrite` from the appropriate relative path. Replace try/catch blocks that follow the pattern:

```typescript
// Before:
try {
  await updateDoc(doc(db, "users", id), data);
} catch (error) {
  handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
}

// After:
await safeFirestoreWrite(
  () => updateDoc(doc(db, "users", id), data),
  OperationType.UPDATE,
  `users/${id}`,
  handleFirestoreError,
);
```

For patterns with `setIsSaving`:
```typescript
// Before:
setIsSaving(true);
try {
  await updateDoc(doc(db, "users", id), data);
} catch (error) {
  handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
} finally {
  setIsSaving(false);
}

// After:
setIsSaving(true);
await safeFirestoreWrite(
  () => updateDoc(doc(db, "users", id), data),
  OperationType.UPDATE,
  `users/${id}`,
  handleFirestoreError,
);
setIsSaving(false);
```

Note: The `finally` block is replaced by a statement after the `await` since `safeFirestoreWrite` always resolves (never throws).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(admin): replace Firestore write+error pattern with safeFirestoreWrite helper"
```

---

### Task 16: Final verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (except pre-existing Firestore rules test)

- [ ] **Step 3: Run linter**

Run: `npx eslint src/components/admin/ src/lib/ --ext .ts,.tsx`
Expected: No new errors

- [ ] **Step 4: Verify the app builds**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "refactor(admin): fix lint issues after deduplication"
```
