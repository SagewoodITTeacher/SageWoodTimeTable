# AdminPanel Component Split Design

## Problem

AdminPanel.tsx is 9,089 lines containing 21 components/functions. The main `AdminPanel` function alone is 3,145 lines. This makes the file extremely hard to navigate, understand, and maintain. Component boundaries are invisible — modals and tabs are defined as sibling functions in the same file with no structural separation.

## Current State

21 components in a single file:

| Component | Lines | Type |
|-----------|-------|------|
| AdminPanel (main) | 3,145 | Shell with inline tab JSX |
| SchedulerTab | 1,838 | Standalone function component |
| ExamTimetableTab | 645 | Standalone function component |
| SubjectsTab | 459 | Standalone function component |
| FacultyRow | 357 | Shared sub-component |
| ConfirmFromState | 252 | Shared sub-component |
| LeaveRequestModal | 258 | Modal |
| InspectionCalendar | 226 | Shared sub-component |
| TimetableField | 240 | Shared sub-component |
| BreakDutyModal | 191 | Modal |
| VenuesTab | 185 | Standalone function component |
| AddTeacherModal | 150 | Modal |
| TimetableModal | 142 | Modal |
| EditTeacherModal | 127 | Modal |
| SubjectsModal | 126 | Modal |
| PeriodConfigModal | 121 | Modal |
| VenueModal | 121 | Modal |
| StatsModal | 117 | Modal |
| HomeRoomModal | 101 | Modal |
| OverflowMenu | 103 | Shared sub-component |
| WorkloadBar | 83 | Shared sub-component |

7 tabs: SUBJECTS, FACULTY, TIMETABLE, VENUES, SCHEDULER, ASSIGNMENTS, INSPECTION

## Design Decisions

### State Management: Props Pattern

AdminPanel remains the state owner. Each tab/modal component receives needed state and callbacks as props. This is the simplest approach, follows existing React patterns in this codebase, and requires no new abstractions.

### File Organization: admin/ folder with subdirectories

```
src/components/admin/
  AdminPanel.tsx              — shell: shared state, tab bar, renders active tab
  index.ts                    — re-exports AdminPanel as default
  tabs/
    SubjectsTab.tsx
    FacultyTab.tsx
    AssignmentsTab.tsx
    TimetableTab.tsx
    VenuesTab.tsx
    SchedulerTab.tsx
    InspectionTab.tsx
    ExamTimetableTab.tsx
  modals/
    TimetableModal.tsx
    SubjectsModal.tsx
    AddTeacherModal.tsx
    EditTeacherModal.tsx
    BreakDutyModal.tsx
    HomeRoomModal.tsx
    LeaveRequestModal.tsx
    VenueModal.tsx
    PeriodConfigModal.tsx
    StatsModal.tsx
  shared/
    FacultyRow.tsx
    WorkloadBar.tsx
    OverflowMenu.tsx
    InspectionCalendar.tsx
    TimetableField.tsx
    ConfirmFromState.tsx
    helpers.ts
```

## Extraction Strategy

### Phase 1: Extract self-contained components (lowest risk)

Move components that are already defined as separate function components to their own files. These have clear boundaries — they receive props and return JSX. No inline JSX extraction needed.

Components to move:
- All 9 modals → `modals/`
- VenuesTab → `tabs/`
- SchedulerTab → `tabs/`
- SubjectsTab → `tabs/`
- ExamTimetableTab → `tabs/`
- FacultyRow, WorkloadBar, OverflowMenu, InspectionCalendar, TimetableField, ConfirmFromState → `shared/`
- Utility functions (getTimetableCell, getAssignmentKey, getEntryTimes, isITSpecialistTeacher, isLSSpecialistTeacher, isArtSpecialistTeacher, isTeacherRestricted, isTechnicalStaffEligible, isTechnicalSubject, periodDurationMinutes) → `shared/helpers.ts`

Each moved component gets its own typed props interface (extracted from the existing inline types or inferred from usage).

### Phase 2: Extract inline tab content (medium risk)

The SUBJECTS, FACULTY, ASSIGNMENTS, TIMETABLE, and INSPECTION tabs are inline JSX within AdminPanel's render. These need to be wrapped into new components.

For each inline tab:
1. Identify all state variables, computed values, and callbacks used by that tab's JSX
2. Define a props interface with only what that tab needs
3. Create the component file with the extracted JSX
4. Replace the inline JSX in AdminPanel with `<XTab {...props} />`
5. AdminPanel passes the required state/callbacks as props

### Phase 3: Update imports and move tests (low risk)

- Update the import in App.tsx (or wherever AdminPanel is imported) to use the new path
- Move existing test files to `admin/` directory
- Create `index.ts` re-exporting AdminPanel as default

## Props Interface Pattern

Each tab component gets a typed props interface containing only the state and callbacks it needs. Example:

```tsx
interface FacultyTabProps {
  teachers: Teacher[];
  assignments: Assignment[];
  searchTerm: string;
  selectedSubject: string;
  onEditTeacher: (teacher: Teacher) => void;
  onBreakDuty: (teacher: Teacher) => void;
  // ... only what this tab actually uses
}
```

## What Stays in AdminPanel

- The `Props` interface and `export default function AdminPanel`
- All `useState` declarations (state ownership stays here)
- All `useMemo`/`useEffect` for shared computed values
- The tab bar rendering (`<Tabs>`, `<TabButton>` list)
- Tab switching logic (`activeTab`, `setActiveTab`)
- Firestore mutation functions shared across tabs
- The `ConfirmState` type and `confirmState`/`setConfirmState` (used across multiple tabs)

## Import Updates

- `App.tsx` updates import path from `./components/AdminPanel` to `./components/admin`
- Existing test files (`AdminPanel.confirm.test.tsx`, `AdminPanel.modals.test.tsx`, `AdminPanel.toast.test.tsx`) move to `admin/` directory
- The old `AdminPanel.tsx` at `src/components/AdminPanel.tsx` is deleted after migration

## Testing

- Existing tests continue to work — they import AdminPanel which still exports the same default
- Each extracted component can be unit-tested independently once extracted
- No new tests required as part of this refactoring (behavior is unchanged)

## Success Criteria

- AdminPanel.tsx is under 500 lines (shell + state + tab bar)
- No single file exceeds 2,000 lines
- All existing tests pass
- No behavioral changes — purely structural refactoring
