import React, { useState, useMemo } from "react";
import {
  Teacher,
  TimetableEntry,
  Venue,
  PeriodConfig,
  DayPeriodConfig,
  LeaveRequest,
} from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getCycleForDate } from "../../../constants";
import {
  Clock,
  Plus,
  Check,
  Trash2,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CalendarOff,
  ClipboardCheck,
  RefreshCw,
  Settings,
  FlaskConical,
  Zap,
  Scale,
  Wand2,
  AlertCircle,
  UserPlus,
  X,
  CheckCircle2,
} from "lucide-react";
import { Modal, useToast } from "../../ui";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  format,
  isWednesday,
  parseISO,
  isAfter,
  isBefore,
} from "date-fns";
import { PeriodConfigModal } from "../modals/PeriodConfigModal";
import { ConfirmFromState } from "../shared/ConfirmFromState";
import { TeacherStatusBadges } from "../shared/TeacherStatusBadges";
import { ConfirmState } from "../shared/types";
import {
  getAssignmentKey,
  getEntryTimes,
  isITSpecialistTeacher,
  isLSSpecialistTeacher,
  isArtSpecialistTeacher,
  isTeacherRestricted,
  isTechnicalStaffEligible,
  isITorCATSubject,
  isLSSubject,
  isArtSubject,
  isExcludedFromInvigilation,
  isEligibleForInvigilation,
  isSHEHOverride,
  isTeacherOnLeaveAtPeriod as _isTeacherOnLeaveAtPeriod,
} from "../shared/helpers";

export function SchedulerTab({
  teachers,
  entries,
  venues,
  dayPeriodConfigs,
  conflictMap,
  leaveRequests,
  writingGradesByDate,
  workloadStats,
  isGenerating,
  setIsGenerating,
  isEqualizing,
  setIsEqualizing,
  eqProgress,
  setEqProgress,
  eqSwaps,
  setEqSwaps,
  eqResolvedConflicts,
  setEqResolvedConflicts,
  eqStages,
  setEqStages,
  interactiveWorkload,
  setInteractiveWorkload,
  genProgress,
  setGenProgress,
  repackCount,
  setRepackCount,
  genElapsedTime,
  setGenElapsedTime,
  autoFromDate,
  setAutoFromDate,
  autoUntilDate,
  setAutoUntilDate,
  handleEqualize,
  handleAutoGenerate,
  selectedDate,
  setSelectedDate,
  getPeriodsForDate,
  activePeriods,
  activePeriodEndOffsets,
  isAssignedToGradeInPeriod,
  isFreeInPeriod,
  getRelevantPeriodsIdx,
  hasIncompleteVenues,
  hasIncompleteVenuesForSelectedDate,
}: {
  teachers: Teacher[];
  entries: TimetableEntry[];
  venues: Venue[];
  dayPeriodConfigs: DayPeriodConfig[];
  conflictMap: { [tId: string]: { [date: string]: { [pIdx: number]: Set<string> } } };
  leaveRequests: LeaveRequest[];
  writingGradesByDate: { [date: string]: number[] };
  workloadStats: any;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  isEqualizing: boolean;
  setIsEqualizing: (v: boolean) => void;
  eqProgress: number;
  setEqProgress: (v: number) => void;
  eqSwaps: number;
  setEqSwaps: (v: number) => void;
  eqResolvedConflicts: number;
  setEqResolvedConflicts: (v: number) => void;
  eqStages: { label: string; progress: number; id: string }[];
  setEqStages: (v: any) => void;
  interactiveWorkload: any[];
  setInteractiveWorkload: (v: any[]) => void;
  genProgress: number;
  setGenProgress: (v: number) => void;
  repackCount: number;
  setRepackCount: (v: number) => void;
  genElapsedTime: number;
  setGenElapsedTime: (v: number) => void;
  autoFromDate: string;
  setAutoFromDate: (v: string) => void;
  autoUntilDate: string;
  setAutoUntilDate: (v: string) => void;
  handleEqualize: (deepIter?: boolean) => Promise<void>;
  handleAutoGenerate: () => Promise<void>;
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  getPeriodsForDate: (dateStr: string) => PeriodConfig[];
  activePeriods: PeriodConfig[];
  activePeriodEndOffsets: number[];
  isAssignedToGradeInPeriod: (t: Teacher, g: number, pIdx: number, d?: string) => boolean;
  isFreeInPeriod: (t: Teacher, pIdx: number, d?: string) => boolean;
  getRelevantPeriodsIdx: (s: "MORNING" | "AFTERNOON", dur: number, e?: TimetableEntry) => number[];
  hasIncompleteVenues: boolean;
  hasIncompleteVenuesForSelectedDate: boolean;
}) {
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isConfiguringPeriods, setIsConfiguringPeriods] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSession, setActiveSession] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [searchStaff, setSearchStaff] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [viewMode, setViewMode] = useState<"DAILY" | "FACULTY">("DAILY");

  const dayName = format(parseISO(selectedDate), "EEEE");
  const cycle = getCycleForDate(parseISO(selectedDate));

  const dayEntries = useMemo(() => entries.filter((e) => e.date === selectedDate), [entries, selectedDate]);

  const entriesInRange = useMemo(() => {
    const start = parseISO(autoFromDate);
    const end = parseISO(autoUntilDate);
    return entries.filter(e => {
      const d = parseISO(e.date);
      return !isBefore(d, start) && !isAfter(d, end);
    });
  }, [entries, autoFromDate, autoUntilDate]);

  const handleToggleVenueOverride = async () => {
    try {
      const config = dayPeriodConfigs.find(c => c.id === selectedDate);
      const isOverridden = config?.venuesOverridden || false;
      await setDoc(doc(db, "dayPeriodConfigs", selectedDate), {
        venuesOverridden: !isOverridden
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignInvigilator = async (
    periodIdx: number,
    teacherId: string,
    entry: TimetableEntry,
    venueId: string,
    role: string = "INVIGILATOR",
    index: number = 0,
  ) => {
    try {
      const currentAssignments = { ...(entry.invigilatorAssignments || {}) };
      const key = getAssignmentKey(periodIdx, venueId, role, index);

      if (currentAssignments[key] === teacherId) {
        delete currentAssignments[key];
      } else {
        currentAssignments[key] = teacherId;
      }

      await updateDoc(doc(db, "timetableEntries", entry.id), {
        invigilatorAssignments: currentAssignments,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `timetableEntries/${entry.id}`);
    }
  };

  const handleSavePeriods = async () => {
     setIsSaving(true);
     // logic to save periods
     setIsSaving(false);
  };

  const handleResetPeriods = async () => {
     // logic to reset
  };

  const handleClearDay = () => {
    setConfirmState({
      open: true,
      title: "Clear all assignments",
      message: `Type CLEAR to confirm clearing all assignments for ${selectedDate}.`,
      variant: "destructive",
      requireTyped: "CLEAR",
      confirmLabel: "Clear assignments",
      onConfirm: async () => {
        try {
          setIsGenerating(true);
          const batch = writeBatch(db);
          dayEntries.forEach(entry => {
            batch.update(doc(db, "timetableEntries", entry.id), {
              invigilatorAssignments: {},
              updatedAt: new Date().toISOString()
            });
          });
          await batch.commit();
          toast.success("Cleared all assignments for today.");
        } catch (e) {
          console.error(e);
          toast.error("Failed to clear assignments.");
        } finally {
          setIsGenerating(false);
        }
      },
    });
  };

  const grade12SubjectsToday = useMemo(() =>
    Array.from(new Set(dayEntries.filter(e => e.grade === 12).map(e => e.subject))),
    [dayEntries]
  );

  const occupiedTeachersMap = useMemo(() => {
    const map: { [tId: string]: number[] } = {};
    dayEntries.forEach(entry => {
      if (entry.invigilatorAssignments) {
        Object.entries(entry.invigilatorAssignments).forEach(([key, tIdValue]) => {
          const tId = tIdValue as string;
          if (!map[tId]) {map[tId] = [];}
          const pIdxMatch = key.match(/^(\d+)_/);
          if (pIdxMatch) {
            const pIdx = parseInt(pIdxMatch[1]);
            if (!map[tId].includes(pIdx)) {map[tId].push(pIdx);}
          }
        });
      }
    });
    return map;
  }, [dayEntries]);

  const occupiedVenuesBySession = useMemo(() => {
    const map: { [session: string]: Set<string> } = {
      MORNING: new Set<string>(),
      AFTERNOON: new Set<string>(),
    };
    dayEntries.forEach((entry) => {
      if (!map[entry.session]) {map[entry.session] = new Set<string>();}
      if (entry.venueIds) {
        entry.venueIds.forEach((vId) => {
          map[entry.session].add(vId);
        });
      }
    });
    return map;
  }, [dayEntries]);

  const sortedDayEntries = useMemo(() => {
    return [...dayEntries].sort((a, b) => {
      if (a.session !== b.session) {return a.session === "MORNING" ? -1 : 1;}
      return (b.grade || 0) - (a.grade || 0);
    });
  }, [dayEntries]);

  const handleToggleAssignment = async (
    entry: TimetableEntry,
    teacherId: string,
  ) => {
    const isAssigned = Object.values(entry.invigilatorAssignments || {}).includes(teacherId);
    const newAssignments = { ...(entry.invigilatorAssignments || {}) };

    if (isAssigned) {
      // Remove all assignments for this teacher in this entry
      Object.entries(newAssignments).forEach(([k, tid]) => {
        if (tid === teacherId) {delete newAssignments[k];}
      });
    } else {
      // Find FIRST available slot for this teacher in this entry
      const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);
      const assignedVenues = venues.filter(v => entry.venueIds?.includes(v.id));

      let found = false;
      for (const venue of assignedVenues) {
        const count = (venue.name?.toLowerCase().includes("hall") || venue.type === "Hall")
             ? (entry.grade === 12 ? Math.ceil((entry.totalStudents || 0) / 30) || 1 : Math.ceil((entry.totalStudents || 0) / 25) || 1)
             : 1;
        for (let i = 0; i < count; i++) {
          for (const p of relevantPIdxs) {
            const key = getAssignmentKey(p, venue.id, "INVIGILATOR", i);
            if (!newAssignments[key]) {
              newAssignments[key] = teacherId;
              found = true;
              break;
            }
          }
          if (found) {break;}
        }
        if (found) {break;}
      }

      if (!found) {
        toast.error("No open slots found in this session for this teacher.");
        return;
      }
    }

    try {
      await updateDoc(doc(db, "timetableEntries", entry.id), {
        invigilatorAssignments: newAssignments,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "Assignment Toggle");
    }
  };






  const removeAssignment = async (
    entry: TimetableEntry,
    assignmentKey: string,
  ) => {
    try {
      const newAssignments = { ...(entry.invigilatorAssignments || {}) };
      const teacherId = newAssignments[assignmentKey];
      const teacher = teachers.find(t => t.id === teacherId);

      const isITorCAT = isITorCATSubject(entry.subject);

      const isPrac = entry.paperType === "Prac";
      const isSpecialist = teacher && isITSpecialistTeacher(teacher);
      const isStandby = assignmentKey.includes("_GRADE_STANDBY_");

      if (isStandby) {
        const sameGradeEntries = dayEntries.filter(
          (e) => e.grade === entry.grade && e.session === entry.session,
        );
        const batch = writeBatch(db);
        for (const e of sameGradeEntries) {
          const eAss = { ...(e.invigilatorAssignments || {}) };
          delete eAss[assignmentKey];
          batch.update(doc(db, "timetableEntries", e.id), {
            invigilatorAssignments: eAss,
          });
        }
        await batch.commit();
        return;
      }

      // If it's a specialist TECH assignment, remove from all periods of this session
      if (assignmentKey.includes("_TECH_") && isITorCAT && isPrac && isSpecialist) {
        const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);
        relevantPIdxs.forEach(p => {
          // Reconstruct the key for other periods
          const parts = assignmentKey.split('_');
          parts[0] = p.toString();
          const key = parts.join('_');
          if (newAssignments[key] === teacherId) {
            delete newAssignments[key];
          }
        });
      }

      // Always remove the specific clicked slot
      delete newAssignments[assignmentKey];

      await updateDoc(
        doc(db, "timetableEntries", entry.id),
        {
          invigilatorAssignments: newAssignments,
        },
      );
    } catch (e) {
      console.error("Remove Assignment Error:", e);
      toast.error("Failed to remove assignment. Please try again.");
    }
  };

  // FAL_SUBJECTS and SPECIAL_CIRCUMSTANCE_SUBJECTS imported from ../constants

  const getGradeDefaultVenues = (
    grade: number | string,
    count: number,
    allVenues: Venue[],
  ) => {
    const g = typeof grade === "string" ? parseInt(grade) : grade;
    if (g === 12)
      {return allVenues
        .filter(
          (v) => v.name?.toLowerCase().includes("hall") || v.type === "Hall",
        )
        .map((v) => v.id);}

    let list: string[] = [];
    if (g === 11) {list = ["Kunene", "Lubbe", "Rakhoabe", "Fourie", "Pienaar"];}
    else if (g === 10) {list = ["Ferreira", "Lezar", "Westhuizen", "Dlamini"];}
    else if (g === 9)
      {list = ["Mathabe", "Mngadi", "Sehlapelo", "Diaman", "Letswalo"];}
    else if (g === 8) {
       // Support specific IDs provided by user
       const specificIds = ["TB1", "TB2", "TB3", "TB4"];
       const g8Venues = allVenues.filter(v => specificIds.includes(v.id)).map(v => v.id);
       if (g8Venues.length > 0) {return g8Venues;}

       list = ["Makowa", "Moutan", "Pather", "Govender", "Mvuke"];
    }

    if (list.length === 0) {return [];}

    const needed = g === 11 ? 5 : Math.ceil(count / 25);
    const selectedNames = list.slice(0, needed);

    return allVenues
      .filter((v) =>
        selectedNames.some((name) =>
          v.name?.toLowerCase().includes(name.toLowerCase()),
        ),
      )
      .map((v) => v.id);
  };

  const handleAutoAssignVenues = async (entry: TimetableEntry) => {
    const vIds = getGradeDefaultVenues(
      entry.grade,
      entry.totalStudents || 0,
      venues,
    );
    if (vIds.length > 0) {
      await updateDoc(doc(db, "timetableEntries", entry.id), {
        venueIds: vIds,
      });
    }
  };

  const isTeacherOnLeaveAtPeriod = (
    teacherId: string,
    periodIdx: number,
    dateStr: string,
  ) => _isTeacherOnLeaveAtPeriod(teacherId, periodIdx, dateStr, teachers, leaveRequests, dayPeriodConfigs);


  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans pb-20">
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-blue-900/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h3 className="text-2xl font-black text-text-dark uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-curro-blue rounded-xl text-white shadow-lg shadow-blue-400/20">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          Invigilation Scheduler
        </h3>
        <div className="flex flex-col gap-1 mt-2">
          <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Real-time Timetable synchronization • {dayName} • Cycle {cycle}
          </p>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-curro-blue flex items-center gap-2">
                   <RefreshCw className="w-3 h-3 animate-spin" />
                   Generating Assignments...
                   <span className="text-text-muted ml-2">(Repacks: {repackCount})</span>
                </span>
                <span className="text-text-dark">{genProgress}% • {genElapsedTime}s</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <motion.div
                  className="h-full bg-curro-blue shadow-[0_0_10px_rgba(30,58,138,0.3)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${genProgress}%` }}
                />
              </div>
            </motion.div>
          )}
          <div className="flex gap-2 mt-1">
            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-100">
              Morning: Start 08:20 (Staff 07:50)
            </span>
            <span className="bg-curro-red bg-opacity-5 text-curro-red text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-curro-red border-opacity-10">
              Afternoon: Start 13:20 (Staff 12:50)
            </span>
            <span className="bg-amber-50 text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-100">
              Grade 12 Hall: Staff 07:30 / 12:30
            </span>
          </div>
        </div>
      </div>

          {/* Auto Generate Block */}
          <div className="flex-1 max-w-xl bg-gray-50/80 rounded-3xl p-4 border border-gray-100 flex flex-col md:flex-row items-end gap-3 shadow-inner">
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-full">
                <label htmlFor="auto-from-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1 ml-1">
                  Auto-generate FROM
                </label>
                <input
                  id="auto-from-date"
                  type="date"
                  value={autoFromDate}
                  onChange={(e) => setAutoFromDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                />
              </div>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <label htmlFor="auto-until-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest block">
                    Auto-complete UNTIL
                  </label>
                  {hasIncompleteVenues && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-black text-curro-red bg-red-50 px-2 py-0.5 rounded-full animate-pulse border border-red-100">
                        Venues missing
                      </span>
                      <button
                        onClick={handleToggleVenueOverride}
                        title="Override selected date"
                        className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-blue-600"
                      >
                        {dayPeriodConfigs.find((c) => c.id === selectedDate)
                          ?.venuesOverridden ? (
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <input
                  id="auto-until-date"
                  type="date"
                  min={autoFromDate}
                  value={autoUntilDate}
                  onChange={(e) => setAutoUntilDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setIsGenerating(true);
                  try {
                    for (const entry of entriesInRange) {
                      if (!entry.venueIds || entry.venueIds.length === 0) {
                        const vIds = getGradeDefaultVenues(entry.grade, entry.totalStudents || 0, venues);
                        if (vIds.length > 0) {
                          await updateDoc(doc(db, "timetableEntries", entry.id), { venueIds: vIds });
                        }
                      }
                    }
                    toast.success("Auto-assigned venues for all exams in range.");
                  } catch (err) {
                    console.error(err);
                    toast.error("Failed to auto-assign venues.");
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                disabled={isGenerating || entriesInRange.length === 0}
                className="w-full md:w-auto bg-curro-blue/10 text-curro-blue border border-curro-blue/20 rounded-xl px-4 py-2.5 font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-curro-blue/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Zap className="w-3 h-3" />
                Auto-Assign Venues (Range)
              </button>
              <button
                onClick={handleAutoGenerate}
                disabled={
                  isGenerating ||
                  isEqualizing ||
                  hasIncompleteVenues ||
                  isBefore(parseISO(autoUntilDate), parseISO(autoFromDate))
                }
                className="w-full md:w-auto bg-text-dark text-white rounded-xl px-4 py-2.5 font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                {isGenerating ? "GENERATING..." : "Auto Generate"}
              </button>
              <button
                onClick={handleClearDay}
                disabled={isGenerating || isEqualizing}
                className="w-full md:w-auto bg-red-600 text-white py-2.5 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                title="Remove all assignments for this day"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Day
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label htmlFor="timetable-select-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                Select Date
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEqualize}
                  disabled={isGenerating || isEqualizing}
                  className="bg-emerald-600 text-white rounded-xl px-3 py-1 font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Scale className="w-2.5 h-2.5" />
                  Equalize
                </button>
                <button
                  onClick={() => handleEqualize(true)}
                  disabled={isGenerating || isEqualizing}
                  className="bg-curro-blue text-white rounded-xl px-3 py-1 font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Wand2 className="w-2.5 h-2.5" />
                  Fix errors & Balance
                </button>
                <button
                  onClick={() => setIsConfiguringPeriods(true)}
                  className="text-[10px] font-black text-curro-blue uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Settings className="w-2.5 h-2.5" />
                  Configure Periods
                </button>
              </div>
            </div>
            <input
              id="timetable-select-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-6 py-3.5 text-sm font-bold transition-all outline-none shadow-sm"
            />
            {dayEntries.length > 0 && (
              <div className="mt-2 ml-1 flex items-center gap-3">
                {hasIncompleteVenuesForSelectedDate ? (
                  <span className="text-[10px] font-black text-curro-red uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-curro-red animate-pulse" />
                    Venues Missing
                  </span>
                ) : (
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {dayPeriodConfigs.find((c) => c.id === selectedDate)
                      ?.venuesOverridden
                      ? "Venues Overridden"
                      : "Venues selected."}
                  </span>
                )}
                <button
                  onClick={handleToggleVenueOverride}
                  className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 border-2 ${
                    dayPeriodConfigs.find((c) => c.id === selectedDate)
                      ?.venuesOverridden
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-600"
                  }`}
                  title={
                    dayPeriodConfigs.find((c) => c.id === selectedDate)
                      ?.venuesOverridden
                      ? "Remove Override"
                      : "Override Venue Check"
                  }
                >
                  {dayPeriodConfigs.find((c) => c.id === selectedDate)
                    ?.venuesOverridden ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : (
                    <ShieldAlert className="w-3 h-3" />
                  )}
                  <span className="text-[10px] font-black uppercase whitespace-nowrap">
                    {dayPeriodConfigs.find((c) => c.id === selectedDate)
                      ?.venuesOverridden
                      ? "Overridden"
                      : "Override"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {dayEntries.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-100">
          <CalendarOff className="w-16 h-16 text-gray-200 mb-6" />
          <h4 className="text-xl font-black text-text-dark uppercase tracking-tight">
            No Exams Today
          </h4>
          <p className="text-sm font-medium text-text-muted mt-2 max-w-xs">
            There are no exam sessions recorded for {dayName}, {selectedDate}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sortedDayEntries.map((entry) => {
            const relevantPIdxs = getRelevantPeriodsIdx(
              entry.session,
              entry.durationMinutes || 180,
              entry
            );
            const isPrac = entry.paperType === "Prac";

            const writingGradesToday: number[] = Array.from(
              new Set(dayEntries.map((e) => e.grade)),
            );

            const teachersWithStatus = teachers
              .filter((t) => isEligibleForInvigilation(t))
              .map((t) => {
                // Determine if teacher teaches ANY grade that is writing today
                const primaryFor = relevantPIdxs.filter((pIdx) =>
                  writingGradesToday.some((grade) =>
                    isAssignedToGradeInPeriod(t, grade, pIdx),
                  ),
                );
                // Determine if teacher is free (including those freed by exam sessions)
                const freeFor = relevantPIdxs.filter((pIdx) =>
                  isFreeInPeriod(t, pIdx),
                );
                const isRestricted = isTeacherRestricted(t, entry.subject);
                const isRestrictedByG12Day = entry.grade === 12 && grade12SubjectsToday.some(sub => isTeacherRestricted(t, sub));
                const techStaffEligible = isTechnicalStaffEligible(
                  t,
                  entry.subject,
                );

                const isITorCATEntry = isITorCATSubject(entry.subject);
                const isLSEntry = isLSSubject(entry.subject);
                const isArtEntry = isArtSubject(entry.subject);

                const tName = `${t.firstName} ${t.lastName} ${t.id}`.toLowerCase();
                const isITSpecialist = isITSpecialistTeacher(t);
                const isLSSpecialist = isLSSpecialistTeacher(t);
                const isArtSpecialist = isArtSpecialistTeacher(t);

                const isSpecialistForThisEntry = (isITorCATEntry && isITSpecialist) || (isLSEntry && isLSSpecialist) || (isArtEntry && isArtSpecialist);
                const skipBreakCheck = isSpecialistForThisEntry && entry.paperType === "Prac";

                const entryHasBreak = relevantPIdxs.some(p => activePeriods[p]?.break);
                const isBlockedByBreak = !skipBreakCheck && entryHasBreak && t.breakDutyDates?.includes(selectedDate);
                const isBlockedByAfternoon = entry.session === 'AFTERNOON' && t.afternoonDutyDates?.includes(selectedDate);

                const pBusyInOthers = occupiedTeachersMap[t.id] || [];
                const isBusyInPeriod = (pIdx: number, roleCheck?: string) => {
                  // Check if assigned to THIS entry
                  const assignments = entry.invigilatorAssignments || {};
                  const isAssignedHere = Object.keys(assignments).some(
                    (k) => k.startsWith(`${pIdx}_`) && assignments[k] === t.id,
                  );
                  if (isAssignedHere) {return false;}

                  // Specialist Exception: Allow simultaneous TECH roles for specialists
                  if (isSpecialistForThisEntry && roleCheck === "TECH") {
                    return false;
                  }

                  // Check if assigned to ANOTHER entry in this period
                  return pBusyInOthers.includes(pIdx);
                };

                const isUsed = relevantPIdxs.every((pIdx) =>
                  isBusyInPeriod(pIdx),
                );
                const isUsedTech = relevantPIdxs.every((pIdx) =>
                  isBusyInPeriod(pIdx, "TECH"),
                );

                return {
                  teacher: t,
                  primaryFor,
                  freeFor,
                  isRestricted,
                  isRestrictedByG12Day,
                  techStaffEligible,
                  isBusyInPeriod,
                  isBlockedByBreak,
                  isBlockedByAfternoon,
                  isEntrySpecialist: isSpecialistForThisEntry,
                  isUsed,
                  isUsedTech,
                };
              });

            const isWednesdayFirstPeriod = isWednesday(parseISO(selectedDate)) && relevantPIdxs.includes(0);

            // Filter out Merike van Dyk entirely
            const eligibleTeachersWithStatus = teachersWithStatus.filter(ts => {
              return !isExcludedFromInvigilation(ts.teacher);
            });

            const filteredTeachersWithStatus = eligibleTeachersWithStatus.filter(ts => {
              const isRestrictedByG12Day = entry.grade === 12 && grade12SubjectsToday.some(sub => isTeacherRestricted(ts.teacher, sub));
              if (isRestrictedByG12Day && !(ts.isEntrySpecialist && isPrac)) {return false;}

              if (isWednesdayFirstPeriod && !ts.isEntrySpecialist) {
                if (ts.teacher.homeRoomGrade) {
                  return ts.teacher.homeRoomGrade === entry.grade;
                }
                return true;
              }
              return true;
            });

            const idealTeachers = filteredTeachersWithStatus.filter(
              (ts) => ts.primaryFor.length > 0 && !ts.isRestricted,
            ).sort((a, b) => {
              const ln = (a.teacher.lastName || "").localeCompare(b.teacher.lastName || "");
              if (ln !== 0) {return ln;}
              return (a.teacher.firstName || "").localeCompare(b.teacher.firstName || "");
            });
            const techTeachers = isPrac
              ? filteredTeachersWithStatus
                  .filter((ts) => ts.techStaffEligible)
                  .sort((a, b) => {
                    const specDiff = (b.isEntrySpecialist ? 1 : 0) - (a.isEntrySpecialist ? 1 : 0);
                    if (specDiff !== 0) {return specDiff;}
                    const ln = (a.teacher.lastName || "").localeCompare(b.teacher.lastName || "");
                    if (ln !== 0) {return ln;}
                    return (a.teacher.firstName || "").localeCompare(b.teacher.firstName || "");
                  })
              : [];
            const reserveTeachers = filteredTeachersWithStatus.filter(
              (ts) =>
                ts.freeFor.length > 0 &&
                ts.primaryFor.length === 0 &&
                !ts.isRestricted &&
                (!isPrac || !ts.techStaffEligible),
            ).sort((a, b) => {
              const ln = (a.teacher.lastName || "").localeCompare(b.teacher.lastName || "");
              if (ln !== 0) {return ln;}
              return (a.teacher.firstName || "").localeCompare(b.teacher.firstName || "");
            });

            const assignedVenues = venues.filter((v) =>
              entry.venueIds?.includes(v.id),
            );
            const venuesRequired = entry.grade === 11 ? 5 : Math.ceil((entry.totalStudents || 0) / 25);

            const isGrade12HallRequirementMet =
              entry.grade === 12 && !isPrac
                ? assignedVenues.some((v) => v.type === "Hall")
                : true;

            const handleToggleVenue = async (vId: string) => {
              const entryRef = doc(db, "timetableEntries", entry.id);
              const currentIds = entry.venueIds || [];
              const newIds = currentIds.includes(vId)
                ? currentIds.filter((id) => id !== vId)
                : [...currentIds, vId].slice(0, 8);

              await setDoc(
                entryRef,
                { venueIds: newIds },
                { merge: true },
              ).catch((e) =>
                handleFirestoreError(
                  e,
                  OperationType.WRITE,
                  `timetableEntries/${entry.id}`,
                ),
              );
            };

            // Legacy handlers removed to avoid overshadowing top-level handlers

            return (
              <div
                key={entry.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white/50 p-1 rounded-[40px] border border-white/50 backdrop-blur-sm"
              >
                {/* Exam Details */}
                <div className="lg:col-span-3 bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-white flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 rotate-3 ${entry.session === "MORNING" ? "bg-amber-50 text-amber-600" : "bg-curro-red bg-opacity-10 text-curro-red"}`}
                  >
                    {entry.session === "MORNING" ? (
                      <Clock className="w-8 h-8" />
                    ) : (
                      <Clock className="w-8 h-8 rotate-180" />
                    )}
                  </div>
                  <h4 className="text-lg font-black text-text-dark uppercase tracking-tight leading-tight">
                    {entry.subject}
                  </h4>
                  <span className="text-[10px] font-black text-curro-blue uppercase tracking-widest mt-1">
                    Paper Type: {entry.paperType || "Normal"}
                  </span>

                  <div className="mt-2.5 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span className="text-[11px] font-mono font-bold text-text-dark">
                      {(() => {
                        const { start, end } = getEntryTimes(entry, entries);
                        return `${start} - ${end}`;
                      })()}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <span className="bg-curro-blue text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Grade {entry.grade}
                    </span>
                    <span className="bg-gray-100 text-text-dark px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest leading-none flex items-center">
                      {entry.totalStudents || 0} Learners
                    </span>
                  </div>

                  <div className="mt-2 flex flex-col items-center">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      Est. Required
                    </span>
                    <span className="text-xl font-black text-curro-blue">
                      {assignedVenues.some(
                        (v) =>
                          v.name?.toLowerCase().includes("hall") ||
                          v.type === "Hall",
                      )
                        ? (entry.grade === 12
                            ? Math.ceil((entry.totalStudents || 0) / 30) || 1
                            : Math.ceil((entry.totalStudents || 0) / 25) || 1)
                        : venuesRequired}
                    </span>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">
                        {assignedVenues.some(
                          (v) =>
                            v.name?.toLowerCase().includes("hall") ||
                            v.type === "Hall",
                        )
                          ? "Invigilators"
                          : "Venues"}
                      </span>
                      {assignedVenues.some(
                        (v) =>
                          v.name?.toLowerCase().includes("hall") ||
                          v.type === "Hall",
                      ) && (
                        <span className="text-[7px] font-bold text-emerald-600 uppercase tracking-tighter">
                          {entry.grade === 12 ? "1:30 Ratio" : "1:25 Ratio"}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAutoAssignVenues(entry)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-curro-blue rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100"
                  >
                    <Zap className="w-3 h-3" />
                    Auto-Assign Venues
                  </button>

                  <div className="mt-8 pt-8 border-t border-gray-50 w-full flex flex-col gap-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <span>Periods</span>
                      <span className="text-text-dark">
                        {relevantPIdxs.map((i) => activePeriods[i]?.label).join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                      <span>Venues</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {assignedVenues.length > 0 ? (
                          assignedVenues.map((v) => (
                            <span
                              key={v.id}
                              className="text-[10px] font-black text-curro-blue bg-blue-50 px-1.5 py-0.5 rounded"
                            >
                              {v.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-red-500 font-black">
                            NOT SET
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex flex-col gap-3">
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Assign Venues
                      </label>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {venues.map((v) => {
                          const isAssigned = entry.venueIds?.includes(v.id);
                          const isOccupiedElsewhere =
                            !isAssigned &&
                            occupiedVenuesBySession[
                              entry.session as "MORNING" | "AFTERNOON"
                            ]?.has(v.id);
                          return (
                            <button
                              key={v.id}
                              onClick={() => handleToggleVenue(v.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${
                                isAssigned
                                  ? "bg-curro-blue text-white shadow-lg shadow-blue-500/20 scale-105 ring-2 ring-blue-100"
                                  : isOccupiedElsewhere
                                    ? "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse hover:bg-amber-200"
                                    : "bg-gray-50 text-text-muted hover:bg-gray-200"
                              }`}
                            >
                              {isAssigned && (
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              )}
                              {v.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex flex-col gap-3">
                      {isPrac && (
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-1.5 rounded-xl">
                          <span>Special Status</span>
                          <FlaskConical className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="flex flex-col gap-4">
                        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest text-left ml-1">
                          Period Allocation
                        </label>
                        <div className="space-y-4">
                          {relevantPIdxs.map((pIdx) => {
                            return (
                              <div key={pIdx} className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                  <span className="text-[10px] font-black text-curro-blue uppercase tracking-widest">
                                    {activePeriods[pIdx]?.label}
                                  </span>
                                  <div className="h-px flex-1 bg-gray-100" />
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                  {/* Stand-By Slot */}
                                  {(() => {
                                    const role = "STANDBY";
                                    const venueId = "GRADE";
                                    const index = 0;
                                    const key = getAssignmentKey(
                                      pIdx,
                                      venueId,
                                      role,
                                      index,
                                    );
                                    const assignedId =
                                      entry.invigilatorAssignments?.[key];
                                    const teacher = teachers.find(
                                      (t) => t.id === assignedId,
                                    );
                                    const isAssigned = !!assignedId;

                                    const status = isAssigned
                                      ? "PINK"
                                      : idealTeachers.some((ts) =>
                                          ts.primaryFor.includes(pIdx),
                                        )
                                        ? "YELLOW"
                                        : "ORANGE";

                                    const statusColors = {
                                      GREEN: "bg-white border-emerald-200 text-emerald-700 shadow-emerald-50 ring-1 ring-emerald-100",
                                      PINK: "bg-purple-50 border-purple-200 text-purple-700 shadow-purple-50 ring-1 ring-purple-100",
                                      YELLOW:
                                        "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-50",
                                      ORANGE:
                                        "bg-orange-50 border-orange-200 text-orange-700 shadow-orange-50",
                                      RED: "bg-red-50 border-red-200 text-red-700 shadow-red-50",
                                    };

                                    return (
                                      <div
                                        key={key}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.currentTarget.classList.add(
                                            "bg-purple-50",
                                            "border-purple-400",
                                          );
                                        }}
                                        onDragLeave={(e) => {
                                          e.currentTarget.classList.remove(
                                            "bg-purple-50",
                                            "border-purple-400",
                                          );
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.currentTarget.classList.remove(
                                            "bg-purple-50",
                                            "border-purple-400",
                                          );
                                          const tId =
                                            e.dataTransfer.getData("teacherId");
                                          if (tId)
                                            {handleAssignInvigilator(
                                              pIdx,
                                              tId,
                                              entry,
                                              venueId,
                                              role,
                                              index,
                                            );}
                                        }}
                                        className={`group relative p-2 rounded-xl border-2 border-dashed transition-all min-h-[60px] flex flex-col items-center justify-center text-center ${statusColors[status]}`}
                                      >
                                        <div className="flex flex-col items-center gap-0.5">
                                          <div className="flex items-center gap-1">
                                            <Shield className="w-2.5 h-2.5 opacity-40 text-purple-600" />
                                            <span className="text-[7px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-1 rounded-sm">
                                              STAND-BY
                                            </span>
                                          </div>
                                          {teacher ? (
                                            <>
                                              <span className="text-[10px] font-black leading-tight">
                                                {teacher.lastName}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  removeAssignment(entry, key)
                                                }
                                                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-curro-red text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white hover:scale-110 active:scale-95 transition-all z-20"
                                                title="Remove Standby"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          ) : (
                                            <span className="text-[10px] font-bold opacity-30 italic">
                                              Unassigned
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {assignedVenues.map((venue) => {
                                    const isHall =
                                      venue.name
                                        ?.toLowerCase()
                                        .includes("hall") ||
                                      venue.type === "Hall";
                                    const isG12 = entry.grade === 12;

                                    let invigilatorCount = 1;
                                    if (isHall) {
                                      if (isG12) {
                                        invigilatorCount = Math.ceil((entry.totalStudents || 0) / 30) || 1;
                                      } else {
                                        invigilatorCount = Math.ceil((entry.totalStudents || 0) / 25) || 1;
                                      }
                                    }

                                    const activeRoles: {
                                      type: string;
                                      label: string;
                                      index: number;
                                    }[] = [];
                                    for (let i = 0; i < invigilatorCount; i++) {
                                      activeRoles.push({
                                        type: "INVIGILATOR",
                                        label:
                                          invigilatorCount > 1
                                            ? `INV ${i + 1}`
                                            : "INVIGILATOR",
                                        index: i,
                                      });
                                    }
                                    if (isPrac) {
                                      activeRoles.push({
                                        type: "TECH",
                                        label: "TECH",
                                        index: 0,
                                      });
                                    }

                                    return activeRoles.map(
                                      ({ type, label, index }) => {
                                        const key = getAssignmentKey(
                                          pIdx,
                                          venue.id,
                                          type,
                                          index,
                                        );
                                        const assignedId =
                                          entry.invigilatorAssignments?.[key];
                                        const teacher = teachers.find(
                                          (t) => t.id === assignedId,
                                        );

                                        const hasConflict = assignedId && conflictMap[assignedId]?.[entry.date]
                                          ? (conflictMap[assignedId][entry.date][pIdx]?.size || 0) > 1
                                          : false;

                                        const isAssigned = !!assignedId;

                                        const isITorCAT = isITorCATSubject(entry.subject);
                                        const isLS = isLSSubject(entry.subject);

                                        const isITSpecialist = teacher ? isITSpecialistTeacher(teacher) : false;
                                        const isLSSpecialist = teacher ? isLSSpecialistTeacher(teacher) : false;

                                        const isSpecialistForThisEntry = teacher && ((isITorCAT && isITSpecialist) || (isLS && isLSSpecialist));

                                        const status = isAssigned
                                          ? (isSpecialistForThisEntry ? "PINK" : "GREEN")
                                          : idealTeachers.some((ts) =>
                                              ts.primaryFor.includes(pIdx),
                                            )
                                            ? "YELLOW"
                                            : "ORANGE";

                                        const statusColors = {
                                          GREEN: hasConflict
                                            ? "bg-curro-red border-curro-red text-white shadow-red-500/20 animate-pulse scale-105 z-10"
                                            : "bg-white border-emerald-200 text-emerald-700 shadow-emerald-50 ring-1 ring-emerald-100",
                                          PINK: hasConflict
                                            ? "bg-curro-red border-curro-red text-white shadow-red-500/20 animate-pulse scale-105 z-10"
                                            : "bg-pink-50 border-pink-200 text-pink-700 shadow-pink-50 ring-1 ring-pink-100",
                                          YELLOW:
                                            "bg-amber-50 border-amber-200 text-amber-700 shadow-amber-50",
                                          ORANGE:
                                            "bg-orange-50 border-orange-200 text-orange-700 shadow-orange-50",
                                          RED: "bg-red-50 border-red-200 text-red-700 shadow-red-50",
                                        };

                                        return (
                                          <div
                                            key={key}
                                            onDragOver={(e) => {
                                              e.preventDefault();
                                              e.currentTarget.classList.add(
                                                "bg-blue-50",
                                                "border-curro-blue",
                                              );
                                            }}
                                            onDragLeave={(e) => {
                                              e.currentTarget.classList.remove(
                                                "bg-blue-50",
                                                "border-curro-blue",
                                              );
                                            }}
                                            onDrop={(e) => {
                                              e.preventDefault();
                                              e.currentTarget.classList.remove(
                                                "bg-blue-50",
                                                "border-curro-blue",
                                              );
                                              const tId =
                                                e.dataTransfer.getData(
                                                  "teacherId",
                                                );
                                              if (tId)
                                                {handleAssignInvigilator(
                                                  pIdx,
                                                  tId,
                                                  entry,
                                                  venue.id,
                                                  type,
                                                  index,
                                                );}
                                            }}
                                            className={`group relative p-2 rounded-xl border-2 border-dashed transition-all min-h-[60px] flex flex-col items-center justify-center text-center ${statusColors[status]}`}
                                          >
                                            <div className="flex flex-col items-center gap-0.5">
                                              <div className="flex items-center gap-1">
                                                <span className="text-[7px] font-black uppercase tracking-widest opacity-40">
                                                  {venue.name}
                                                </span>
                                                <span className="text-[7px] font-black uppercase tracking-widest text-curro-blue bg-blue-50 px-1 rounded-sm">
                                                  {label}
                                                </span>
                                              </div>
                                              {teacher ? (
                                                <>
                                                  <span className="text-[10px] font-black leading-tight">
                                                    {teacher.lastName}
                                                  </span>
                                                <button
                                                    onClick={() =>
                                                      removeAssignment(
                                                        entry,
                                                        key,
                                                      )
                                                    }
                                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-curro-red text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white hover:scale-110 active:scale-95 transition-all z-20"
                                                    title="Remove Assignment"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </>
                                              ) : (
                                                <span className="text-[10px] font-bold opacity-30 italic">
                                                  Unassigned
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      },
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/5 border border-white overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h5 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Invigilation Staff
                      </h5>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                        Scheduled to Grade
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[650px] max-h-[80vh]">
                      {/* Priority: Technical Staff for Prac */}
                      {isPrac && techTeachers.length > 0 && (
                        <div className="space-y-2 mb-6">
                          <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">
                            Technical Staff {techTeachers.some(ts => ts.isEntrySpecialist) ? "& Specialists" : "(Restricted)"}
                          </span>
                        {techTeachers.map((ts) => {
                          const t = ts.teacher;
                          const pIdx = relevantPIdxs[0];
                          const venueId = assignedVenues[0]?.id || "manual";
                          const assignmentKey = getAssignmentKey(pIdx, venueId, "TECH", 0);
                          const isAssigned = entry.invigilatorAssignments?.[assignmentKey] === t.id;

                          const isUsed = ts.isUsedTech && !isAssigned;

                          const isSpecialist = ts.isEntrySpecialist;

                          const isBlockedByBreak = ts.isBlockedByBreak;
                          const isBlockedByAfternoon = ts.isBlockedByAfternoon;

                          const isBlocked = isUsed || isBlockedByAfternoon;

                          return (
                            <div
                              key={t.id}
                              draggable={!isBlocked}
                              onDragStart={(e) =>
                                e.dataTransfer.setData("teacherId", t.id)
                              }
                              onClick={() => {
                                if (isBlocked) {return;}
                                handleAssignInvigilator(
                                  pIdx,
                                  t.id,
                                  entry,
                                  venueId,
                                  "TECH",
                                  0,
                                );
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border group transition-all ${
                                isAssigned
                                  ? "bg-curro-blue text-white border-curro-blue shadow-lg scale-[1.02] z-10"
                                  : isSpecialist
                                    ? "bg-pink-50 border-pink-200 shadow-pink-100 shadow-md scale-[1.02] z-10"
                                    : "bg-purple-50/50 border-purple-100 shadow-sm"
                              } ${
                                isBlocked
                                  ? "opacity-40 grayscale pointer-events-none"
                                  : isAssigned
                                    ? "cursor-pointer"
                                    : isSpecialist
                                      ? "hover:bg-pink-100 hover:border-pink-300 cursor-grab active:cursor-grabbing"
                                      : "hover:bg-purple-100 hover:border-purple-200 cursor-grab active:cursor-grabbing"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase tracking-tighter ${
                                    isAssigned
                                      ? "bg-white text-curro-blue"
                                      : isBlocked
                                        ? "bg-gray-200 text-gray-400"
                                        : isSpecialist
                                          ? "bg-pink-200 text-pink-700"
                                          : "bg-purple-100 text-purple-700"
                                  }`}
                                >
                                  {isAssigned ? <Check className="w-5 h-5" /> : "TECH"}
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-xs font-bold ${isAssigned ? "text-white" : isSpecialist ? "text-pink-900" : "text-text-dark"}`}>
                                    {t.firstName} {t.lastName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isAssigned ? "text-blue-100" : isSpecialist ? "text-pink-600" : "text-purple-600/60"}`}>
                                      {isAssigned ? "Assigned" : isUsed ? "Occupied" : isSpecialist ? "Technical Specialist" : "Subject Specialist"}
                                    </span>
                                    <TeacherStatusBadges isBlockedByBreak={isBlockedByBreak} isBlockedByAfternoon={isBlockedByAfternoon} />
                                  </div>
                                </div>
                              </div>
                              {!isBlocked && (
                                <div className={`${isAssigned ? "bg-white/20" : isSpecialist ? "bg-pink-600" : "bg-purple-600"} text-white p-2 rounded-lg ${isAssigned ? "" : "opacity-40 group-hover:opacity-100"} transition-all shadow-lg active:scale-95`}>
                                  {isAssigned ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                      {!isPrac && idealTeachers.length === 0 ? (
                      <p className="text-xs text-text-muted italic opacity-50 py-10 text-center">
                        No primary teachers scheduled for this grade...
                      </p>
                    ) : (
                      idealTeachers.map(
                        (ts) => {
                          const t = ts.teacher;
                          const primaryFor = ts.primaryFor;
                          const isBusyInPeriod = ts.isBusyInPeriod;
                          const isAssigned = Object.values(entry.invigilatorAssignments || {}).includes(t.id);
                          const isUsed = ts.isUsed && !isAssigned;
                          const isBlocked = isUsed || ts.isBlockedByAfternoon;
                          const isBlockedByBreak = ts.isBlockedByBreak;
                          const isBlockedByAfternoon = ts.isBlockedByAfternoon;

                          const hasConflict = relevantPIdxs.some(p => (conflictMap[t.id]?.[selectedDate]?.[p]?.size || 0) > 1);

                          return (
                            <div
                              key={t.id}
                              draggable={!isBlocked}
                              onDragStart={(e) =>
                                e.dataTransfer.setData("teacherId", t.id)
                              }
                              onClick={() => {
                                if (isBlocked) {return;}
                                handleToggleAssignment(entry, t.id);
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all group overflow-hidden ${
                                isAssigned
                                  ? "bg-curro-blue text-white border-curro-blue shadow-lg scale-[1.02] z-10"
                                  : hasConflict
                                    ? "bg-curro-red text-white border-curro-red shadow-xl scale-[1.02] z-10"
                                    : isBlocked
                                      ? "bg-gray-50/50 opacity-40 grayscale pointer-events-none border-transparent"
                                      : "bg-gray-50/50 border-transparent hover:bg-emerald-50/50 hover:border-emerald-100 cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase tracking-tighter ${
                                    isAssigned
                                      ? "bg-white text-curro-blue"
                                      : hasConflict
                                        ? "bg-white text-curro-red"
                                        : isBlocked
                                          ? "bg-gray-200 text-gray-500"
                                          : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {isAssigned ? <Check className="w-5 h-5" /> : hasConflict ? <AlertCircle className="w-5 h-5" /> : t.id.slice(0, 3)}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 text-wrap">
                                    <span className={`text-xs font-bold ${isAssigned || hasConflict ? "text-white" : "text-text-dark"}`}>
                                      {t.firstName} {t.lastName}
                                      {t.invigilationPreference === "MARATHON" && (
                                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black" title="Marathon Teacher">M</span>
                                      )}
                                      {t.invigilationPreference === "SCATTERED" && (
                                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black" title="Scattered Teacher">S</span>
                                      )}
                                    </span>
                                    {isAssigned && (
                                      <span className="text-[7px] font-black bg-white text-curro-blue px-1 rounded uppercase">
                                        Assigned
                                      </span>
                                    )}
                                    {hasConflict && (
                                      <span className="text-[7px] font-black bg-white text-curro-red px-1 rounded uppercase animate-pulse">
                                        CONFLICT!
                                      </span>
                                    )}
                                    <TeacherStatusBadges isBlockedByBreak={isBlockedByBreak} isBlockedByAfternoon={isBlockedByAfternoon} isUsed={isUsed} />
                                    {t.homeRoomGrade && (
                                      <span className={`text-[7px] font-black px-1 rounded uppercase ${isAssigned || hasConflict ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                                        HR Gr {t.homeRoomGrade} E{t.homeRoomClass}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {primaryFor.map((pIdx) => (
                                      <span
                                        key={pIdx}
                                        className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isAssigned ? "bg-white/20 text-white" : isBusyInPeriod(pIdx) ? "bg-gray-200 text-gray-500" : "bg-emerald-100 text-emerald-700"}`}
                                      >
                                        {activePeriods[pIdx]?.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {!isUsed && (
                                <div className={`${isAssigned ? "bg-white/20" : "bg-emerald-600"} text-white p-2 rounded-lg ${isAssigned ? "" : "opacity-0 group-hover:opacity-100"} transition-all shadow-lg active:scale-95`}>
                                  {isAssigned ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                                </div>
                              )}
                            </div>
                          );
                        },
                      )
                    )}
                  </div>
                </div>

                {/* Reserve Selection */}
                <div className="lg:col-span-4 bg-gray-50/50 rounded-[32px] p-6 border border-white border-dashed flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-[11px] font-black text-curro-red uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Reserve Selection
                    </h5>
                    <span className="text-[10px] font-bold text-curro-red bg-red-50 px-2 py-0.5 rounded-full">
                      FREE PERIODS
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[650px] max-h-[80vh]">
                    {reserveTeachers.length === 0 ? (
                      <p className="text-xs text-text-muted italic opacity-50 py-10 text-center">
                        No reserve teachers found...
                      </p>
                    ) : (
                      reserveTeachers.map(
                        (ts) => {
                          const t = ts.teacher;
                          const freeFor = ts.freeFor;
                          const isBusyInPeriod = ts.isBusyInPeriod;
                          const isAssigned = Object.values(entry.invigilatorAssignments || {}).includes(t.id);
                          const isUsed = ts.isUsed && !isAssigned;
                          const isBlocked = isUsed || ts.isBlockedByAfternoon;
                          const isBlockedByBreak = ts.isBlockedByBreak;
                          const isBlockedByAfternoon = ts.isBlockedByAfternoon;

                          const hasConflict = relevantPIdxs.some(p => (conflictMap[t.id]?.[selectedDate]?.[p]?.size || 0) > 1);

                          return (
                            <div
                              key={t.id}
                              draggable={!isBlocked}
                              onDragStart={(e) =>
                                e.dataTransfer.setData("teacherId", t.id)
                              }
                              onClick={() => {
                                if (isBlocked) {return;}
                                handleToggleAssignment(entry, t.id);
                              }}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all group overflow-hidden ${
                                isAssigned
                                  ? "bg-curro-blue text-white border-curro-blue shadow-lg scale-[1.02] z-10"
                                  : hasConflict
                                    ? "bg-curro-red text-white border-curro-red shadow-xl scale-[1.02] z-10"
                                    : isBlocked
                                      ? "bg-gray-50 opacity-40 grayscale border-transparent pointer-events-none"
                                      : "bg-white border-gray-50 hover:bg-red-50/50 hover:border-red-100 cursor-pointer"
                              }`}
                            >
                              <div className="flex flex-col gap-1.5 overflow-hidden">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold truncate ${isAssigned || hasConflict ? "text-white" : "text-text-dark"}`}>
                                    {t.firstName} {t.lastName}
                                    {t.invigilationPreference === "MARATHON" && (
                                      <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 bg-orange-100 text-orange-700 rounded-full text-[7px] font-black" title="Marathon Teacher">M</span>
                                    )}
                                    {t.invigilationPreference === "SCATTERED" && (
                                      <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 bg-sky-100 text-sky-700 rounded-full text-[7px] font-black" title="Scattered Teacher">S</span>
                                    )}
                                  </span>
                                  {isAssigned && (
                                    <span className="text-[7px] font-black bg-white text-curro-blue px-1 rounded uppercase">
                                      Assigned
                                    </span>
                                  )}
                                  {hasConflict && (
                                    <span className="text-[7px] font-black bg-white text-curro-red px-1 rounded uppercase animate-pulse">
                                      CONFLICT!
                                    </span>
                                  )}
                                  <TeacherStatusBadges isBlockedByBreak={isBlockedByBreak} isBlockedByAfternoon={isBlockedByAfternoon} isUsed={isUsed} />
                                  {t.homeRoomGrade && (
                                    <span className={`text-[7px] font-black px-1 rounded uppercase ${isAssigned || hasConflict ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                                      HR Gr {t.homeRoomGrade} E{t.homeRoomClass}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-black ${isAssigned || hasConflict ? "text-white/60" : "text-text-muted opacity-50"}`}>
                                    {t.id}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {freeFor.map((pIdx) => (
                                    <span
                                      key={pIdx}
                                      className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isAssigned ? "bg-white/20 text-white" : isBusyInPeriod(pIdx) ? "bg-gray-200 text-gray-500" : "bg-red-100 text-red-600"}`}
                                    >
                                      {activePeriods[pIdx]?.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {!isUsed && (
                                <div className={`${isAssigned ? "bg-white/20" : "bg-curro-red"} text-white p-2 rounded-lg ${isAssigned ? "" : "opacity-20 group-hover:opacity-100"} transition-all shadow-lg active:scale-95`}>
                                  {isAssigned ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3" />}
                                </div>
                              )}
                            </div>
                          );
                        },
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isConfiguringPeriods && (
          <PeriodConfigModal
            isOpen={isConfiguringPeriods}
            onClose={() => setIsConfiguringPeriods(false)}
            activePeriods={activePeriods}
            dayName={dayName}
            selectedDate={selectedDate}
            onSave={handleSavePeriods}
            onReset={handleResetPeriods}
          />
        )}
      </AnimatePresence>

      <Modal
        open={isEqualizing}
        onClose={() => {}}
        title="Equalizing Workload"
        size="md"
        hideClose
        dismissOnBackdrop={false}
        dismissOnEscape={false}
      >
            <div className="text-center relative overflow-hidden">
              <div className="absolute -top-6 -left-6 -right-6 h-2 bg-gray-100/50">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${eqProgress}%` }}
                />
              </div>

              <div className="mb-8 relative inline-block">
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Scale className="w-12 h-12 text-emerald-600" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-lg border border-emerald-100">
                  <div className="w-8 h-8 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              </div>

              <div className="my-6 h-32 w-full bg-gray-50 rounded-2xl p-2 border border-blue-100/30">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interactiveWorkload}>
                    <Bar dataKey="tech" stackId="a" fill="#0ea5e9" isAnimationActive={false} />
                    <Bar dataKey="morning" stackId="a" fill="#3b82f6" isAnimationActive={false} />
                    <Bar dataKey="afternoon" stackId="a" fill="#a855f7" isAnimationActive={false} />
                    <Bar dataKey="standby" stackId="a" fill="#10b981" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1">
                    Swaps
                  </span>
                  <span className="text-xl font-black text-curro-blue">
                    {eqSwaps}
                  </span>
                </div>
                <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                    Conflicts
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    {eqResolvedConflicts}
                  </span>
                </div>
              </div>

              {/* Multi-Stage Progress Bars */}
              <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100/50 mb-8">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {eqStages.map((stage) => (
                    <div key={stage.id} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {stage.label}
                        </span>
                        <span className="text-[10px] font-black text-curro-blue">
                          {stage.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.progress}%` }}
                          className={`h-full ${stage.progress === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200 p-1">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${eqProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest px-1">
                  <span className="text-emerald-600">{eqProgress < 100 ? "Processing..." : "Complete"}</span>
                  <span className="text-text-muted">{eqProgress}%</span>
                </div>
              </div>

              <p className="mt-8 text-[10px] font-bold text-text-muted opacity-50 uppercase tracking-widest">
                Please do not close or refresh this tab
              </p>
            </div>
      </Modal>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
