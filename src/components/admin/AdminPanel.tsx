import React, { useState, useMemo } from "react";
import {
  Teacher,
  TimetableEntry,
  PeriodConfig,
  SchedulerSettings,
  Subject,
} from "../../types";
import { useSessions } from "../../hooks/useSessions";
import { useAssignments } from "../../hooks/useAssignments";
import { useLeaveRequests } from "../../hooks/useLeaveRequests";
import { useTimetableEntries } from "../../hooks/useTimetableEntries";
import { useVenues } from "../../hooks/useVenues";
import { useSubjects } from "../../hooks/useSubjects";
import { useDayPeriodConfigs } from "../../hooks/useDayPeriodConfigs";
import { useSchedulerSettings } from "../../hooks/useSchedulerSettings";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  writeBatch,
} from "firebase/firestore";
import {
  PERIODS,
  WEDNESDAY_PERIODS,
  getCycleForDate,
  getCurrentPeriodIndex,
} from "../../constants";
import {
  Users,
  Calendar,
  Clock,
  MapPin,
  Search,
  Plus,
  ArrowUpRight,
  Download,
  BookOpen,
  CheckCircle2,
  Database,
  AlertCircle,
  ClipboardCheck,
  CalendarRange,
  Minimize2,
  Maximize2,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { TabButton, Tabs, useToast } from "../ui";
import { INITIAL_TEACHERS } from "../../data";
import { motion, AnimatePresence } from "motion/react";
import {
  format,
  isWednesday,
  parseISO,
  isAfter,
  isBefore,
  eachDayOfInterval,
} from "date-fns";

// Tab components
import { SubjectsTab } from "./tabs/SubjectsTab";
import { FacultyTab } from "./tabs/FacultyTab";
import { AssignmentsTab } from "./tabs/AssignmentsTab";
import { TimetableTab } from "./tabs/TimetableTab";
import { VenuesTab } from "./tabs/VenuesTab";
import { SchedulerTab } from "./tabs/SchedulerTab";
import { InspectionTab } from "./tabs/InspectionTab";
import { generateSchedule } from "../../services/schedulingService";

// Modal components
import { TimetableModal } from "./modals/TimetableModal";
import { SubjectsModal } from "./modals/SubjectsModal";
import { TeacherFormModal } from "./modals/TeacherFormModal";
import { BreakDutyModal } from "./modals/BreakDutyModal";
import { HomeRoomModal } from "./modals/HomeRoomModal";
import { LeaveRequestModal } from "./modals/LeaveRequestModal";
import { StatsModal } from "./modals/StatsModal";

// Shared components
import { ConfirmFromState } from "./shared/ConfirmFromState";
import { ConfirmState } from "./shared/types";
import {
  getAssignmentKey,
  getEntryTimes,
  isITSpecialistTeacher,
  isLSSpecialistTeacher,
  isArtSpecialistTeacher,
  isTechnicalStaffEligible,
  getPeriodsForDate as _getPeriodsForDate,
  resolvePeriodsForDate as _resolvePeriodsForDate,
  periodDurationMinutes,
  isLSSubject,
  isExcludedFromInvigilation,
  isEligibleForInvigilation,
  isSHEHOverride,
  SHEH_OVERRIDE_DATES,
  isTeacherOnLeaveAtPeriod as _isTeacherOnLeaveAtPeriod,
  safeFirestoreWrite,
  getTimetableCell,
  hasGradeMarkerInPeriod,
  isTeacherAllowedForGradeOnDate as isTeacherAllowedForEntry,
} from "./shared/helpers";

interface Props {
  user: Teacher;
  teachers: Teacher[];
  lockedDates: string[];
  wideLayout?: boolean;
  onToggleWideLayout?: () => void;
}

export default function AdminPanel({
  user: activeUser,
  teachers,
  lockedDates,
  wideLayout = false,
  onToggleWideLayout,
}: Props) {
  const { data: sessions } = useSessions();
  useAssignments();
  const { data: leaveRequests } = useLeaveRequests();
  const { data: entries } = useTimetableEntries();
  const { data: venues } = useVenues();
  const { data: subjects } = useSubjects();
  const { data: dayPeriodConfigs } = useDayPeriodConfigs();
  const { data: rawSettings } = useSchedulerSettings();
  const settings = useMemo(() => {
    if (rawSettings && rawSettings.length > 0) return rawSettings[0];
    return {
      id: 'default',
      grade12Range: { start: '', end: '' },
      grade10_11Range: { start: '', end: '' },
      grade8_9Range: { start: '', end: '' },
      reserveRange: { start: '', end: '' },
      techAssignments: [],
      maxDailyMinutes: 360,
      techManualOnly: false,
      techTeachersNoInvigilationOnTechDay: false,
      equalizeMinutesWithTechDiscount: false,
      equalizeStandbySeparately: false,
      roleActiveRange: { start: '', end: '' },
      followDistributionPattern: false,
      wednesdayHomeroomInvigilation: false,
    } as SchedulerSettings;
  }, [rawSettings]);

  const handleUpdateSettings = async (newSettings: SchedulerSettings) => {
    try {
      const settingsRef = doc(db, 'settings', 'scheduler');
      await setDoc(settingsRef, {
        ...newSettings,
        updatedAt: new Date().toISOString()
      });
      toast.success('Scheduler settings updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/scheduler');
    }
  };

  const toast = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("ALL");
  const allSubjects = useMemo(() => {
    return Array.from(new Set(teachers.flatMap((t) => (t.subjects || []).map(s => typeof s === 'string' ? s : s.name)))).sort();
  }, [teachers]);

  const getPeriodsForDate = (dateStr: string) => _getPeriodsForDate(dateStr, dayPeriodConfigs);
  const resolvePeriodsForDate = (dateStr: string) => _resolvePeriodsForDate(dateStr, dayPeriodConfigs);
  const [showStats, setShowStats] = useState(false);
  const [enableCheckMode, setEnableCheckMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEqualizing, setIsEqualizing] = useState(false);
  const [eqProgress, setEqProgress] = useState(0);
  const [eqSwaps, setEqSwaps] = useState(0);
  const [eqResolvedConflicts, setEqResolvedConflicts] = useState(0);
  const [eqStages, setEqStages] = useState<{ label: string; progress: number; id: string }[]>([
    { id: "sanitation", label: "Sanitation", progress: 0 },
    { id: "rewards", label: "Rewards/Free Days", progress: 0 },
    { id: "autofill", label: "Auto-Fill", progress: 0 },
    { id: "conflicts", label: "Conflicts", progress: 0 },
    { id: "morning", label: "Morning", progress: 0 },
    { id: "afternoon", label: "Afternoon", progress: 0 },
    { id: "standby", label: "Standby", progress: 0 },
    { id: "optimization", label: "Optimization", progress: 0 },
    { id: "finalizing", label: "Finalizing", progress: 0 },
  ]);
  const [interactiveWorkload, setInteractiveWorkload] = useState<any[]>([]);
  const [genProgress, setGenProgress] = useState(0);
  const [repackCount, setRepackCount] = useState(0);
  const [genElapsedTime, setGenElapsedTime] = useState(0);
  const handleTimetableBackup = () => {
    const backup: { [date: string]: any } = {};
    const sortedDates = [...new Set(entries.map((e) => e.date))].sort();

    sortedDates.forEach((date) => {
      backup[date] = {};
      const dayEntries = entries.filter((e) => e.date === date);

      [8, 9, 10, 11, 12].forEach((grade) => {
        ["MORNING", "AFTERNOON"].forEach((session) => {
          const key = `Grade ${grade} ${session === "MORNING" ? "Morning" : "Afternoon"} Session`;
          const entry = dayEntries.find((e) => e.grade === grade && e.session === session);

          if (entry) {
            const entryVenues = (entry.venueIds || []).map((vId) => {
              const v = venues.find((vv) => vv.id === vId);
              return v ? v.name : vId;
            });

            backup[date][key] = {
              Subject: entry.subject,
              Type: entry.paperType || "Normal",
              Duration: entry.durationMinutes || 0,
              Boys: entry.totalBoys || 0,
              Girls: entry.totalGirls || 0,
              Total: entry.totalStudents || 0,
              Venues: entryVenues,
            };
          } else {
            backup[date][key] = null;
          }
        });
      });
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timetable_backup_${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubjectBackup = () => {
    const backup = subjects.reduce((acc, s) => {
      acc[s.code] = s.name;
      return acc;
    }, {} as { [code: string]: string });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subjects_backup_${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFacultyBackup = () => {
    const backup = teachers.map((t) => {
      const tLeaves = (leaveRequests || [])
        .filter((lr) => lr.teacherId === t.id && (lr.status === "APPROVED" || lr.status === "PENDING"))
        .map((lr) => lr.date);

      return {
        "Staff Code": t.id,
        Email: t.email || "",
        "First Name": t.firstName,
        "Last Name": t.lastName,
        Load: t.workloadPercentage || 100,
        Role: t.invigilationPreference || "SCATTERED",
        "Hall Access": t.hallPass || false,
        "BreakDuty dates": t.breakDutyDates || [],
        "Afternoon Breakduty dates": t.afternoonDutyDates || [],
        HomeRoom: {
          Grade: t.homeRoomGrade || null,
          Class: t.homeRoomClass || null,
        },
        "Leave Dates": tLeaves,
        Subjects: (t.subjects || []).map((s) => (typeof s === "string" ? s : s.name)),
        TimeTable: t.timetable || null,
      };
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `faculty_backup_${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleVenueBackup = () => {
    const backup = venues.map((v) => ({
      VenueID: v.id,
      DisplayName: v.name,
      "Venue Type": v.type || "Normal",
      Capacity: v.capacity || 0,
    }));

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `venues_backup_${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [autoFromDate, setAutoFromDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const activePeriods = useMemo(
    () => {
      const dateConfig = dayPeriodConfigs.find((c) => c.id === selectedDate);
      const d = parseISO(selectedDate);
      const dayName = format(d, "EEEE");
      const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);

      if (dateConfig && dateConfig.periods) {return dateConfig.periods;}
      if (dayConfig && dayConfig.periods) {return dayConfig.periods;}
      return dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS;
    },
    [dayPeriodConfigs, selectedDate],
  );

  const activePeriodEndOffsets = useMemo(() => {
    return activePeriods.map((p) => {
      const [h, m] = p.end.split(":").map(Number);
      return h * 60 + m - (7 * 60 + 50);
    });
  }, [activePeriods]);

  const getRelevantPeriodsIdx = (
    session: "MORNING" | "AFTERNOON",
    durationMinutes: number,
    entry?: TimetableEntry,
  ) => {
    const startIdx = session === "MORNING" ? 0 : 7;
    const duration = durationMinutes || 180;

    let sessionStartOffset = session === "MORNING" ? 30 : 330;
    if (entry) {
      const { startMinutes } = getEntryTimes(entry, entries);
      sessionStartOffset = startMinutes - (7 * 60 + 50);
    }
    const endOffset = sessionStartOffset + duration;

    return activePeriods.map((_, i) => i).filter((idx) => {
      const pStart = idx === 0 ? 0 : activePeriodEndOffsets[idx - 1];
      const pEnd = activePeriodEndOffsets[idx];
      const overlaps = Math.max(
        0,
        Math.min(endOffset, pEnd) - Math.max(sessionStartOffset, pStart),
      );
      return overlaps > 0 && idx >= startIdx;
    });
  };

  const isTeacherOnLeaveAtPeriod = (
    teacherId: string,
    periodIdx: number,
    dateStr: string,
  ) => _isTeacherOnLeaveAtPeriod(teacherId, periodIdx, dateStr, teachers, leaveRequests, dayPeriodConfigs);

  const hasIncompleteVenues = useMemo(() => {
    return entries.some(e => !e.venueIds || e.venueIds.length === 0);
  }, [entries]);

  const hasIncompleteVenuesForSelectedDate = useMemo(() => {
    return entries.filter(e => e.date === selectedDate).some(e => !e.venueIds || e.venueIds.length === 0);
  }, [entries, selectedDate]);

  const isAssignedToGradeInPeriod = (
    teacher: Teacher,
    grade: number,
    periodIdx: number,
    dateStr?: string,
  ) => {
    const targetDate = dateStr || selectedDate;
    const cell = getTimetableCell(teacher, periodIdx, targetDate);
    if (!cell) return false;
    const cellStr = String(cell);
    return cellStr.includes(`[${grade}]`) || cellStr.includes(String(grade));
  };

  const isFreeInPeriod = (
    teacher: Teacher,
    periodIdx: number,
    dateStr?: string,
  ) => {
    const targetDate = dateStr || selectedDate;
    const isOccupied = entries.some(
      (e) =>
        e.date === targetDate &&
        e.invigilatorAssignments &&
        Object.entries(e.invigilatorAssignments).some(
          ([k, tId]) => tId === teacher.id && k.startsWith(`${periodIdx}_`),
        ),
    );
    return !isOccupied && !isTeacherOnLeaveAtPeriod(teacher.id, periodIdx, targetDate);
  };

  const [autoUntilDate, setAutoUntilDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );

  const handleAutoGenerate = async () => {
    if (hasIncompleteVenues) {
      toast.error("Some sessions are missing venues. Assign venues first.");
      return;
    }
    setIsGenerating(true);
    setGenProgress(0);
    setGenElapsedTime(0);
    const startTime = Date.now();

    const timer = setInterval(() => {
      setGenElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const startDate = parseISO(autoFromDate);
      const endDate = parseISO(autoUntilDate);
      if (isAfter(startDate, endDate)) {
        toast.error("Start date cannot be after end date.");
        setIsGenerating(false);
        clearInterval(timer);
        return;
      }

      const entriesInRange = entries.filter(e => {
        const d = parseISO(e.date);
        return !isBefore(d, startDate) && !isAfter(d, endDate);
      });

      if (entriesInRange.length === 0) {
        toast.error("No entries found in the selected range.");
        setIsGenerating(false);
        clearInterval(timer);
        return;
      }

      setGenProgress(20);
      const result = await generateSchedule(
        entriesInRange,
        teachers,
        dayPeriodConfigs,
        settings,
        leaveRequests
      );

      setGenProgress(80);
      const batch = writeBatch(db);
      result.entries.forEach(entry => {
        batch.update(doc(db, "timetableEntries", entry.id), {
          invigilatorAssignments: entry.invigilatorAssignments,
          updatedAt: new Date().toISOString()
        });
      });
      
      await batch.commit();
      setGenProgress(100);
      toast.success(`Roster generated! Assigned ${result.stats.totalAssigned} slots.`);
      if (result.stats.unfilledSlots > 0) {
        toast.warning(`${result.stats.unfilledSlots} slots could not be filled.`);
      }
    } catch (error) {
      console.error("Auto-generate failed:", error);
      toast.error("Auto-generation failed. Please check the logs.");
    } finally {
      setIsGenerating(false);
      clearInterval(timer);
    }
  };

  const handleEqualize = async (deepIter: boolean = false) => {
    setEqProgress(0);
    setEqSwaps(0);
    setEqResolvedConflicts(0);
    setEqStages([
      { id: "sanitation", label: "Sanitation", progress: 0 },
      { id: "rewards", label: "Rewards/Free Days", progress: 0 },
      { id: "autofill", label: "Auto-Fill", progress: 0 },
      { id: "conflicts", label: "Conflicts", progress: 0 },
      { id: "morning", label: "Morning", progress: 0 },
      { id: "afternoon", label: "Afternoon", progress: 0 },
      { id: "standby", label: "Standby", progress: 0 },
      { id: "optimization", label: "Optimization", progress: 0 },
      { id: "finalizing", label: "Finalizing", progress: 0 },
    ]);
    setInteractiveWorkload([]);

    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

    const updateStageProgress = (id: string, progress: number) => {
      setEqStages(prev => prev.map(s => s.id === id ? { ...s, progress } : s));
    };

    const startTime = Date.now();
    const timer = setInterval(() => {
      setGenElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    try {
      const startDate = parseISO(autoFromDate);
      const endDate = parseISO(autoUntilDate);
      const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });

      const localTeachers = teachers.filter((t) =>
        t.invigilationPreference !== "OPS" && isEligibleForInvigilation(t)
      );

      const studentCountsPerDay: Record<string, number> = {};
      entries.forEach(e => {
        studentCountsPerDay[e.date] = (studentCountsPerDay[e.date] || 0) + (e.totalStudents || 0);
      });

      const uniqueEntryDates = Array.from(new Set(entries.filter(e => {
        const d = parseISO(e.date);
        return !isBefore(d, startDate) && !isAfter(d, endDate);
      }).map(e => e.date)));

      const entryDatesSortedByLearners = uniqueEntryDates.sort((a, b) =>
        (studentCountsPerDay[a] || 0) - (studentCountsPerDay[b] || 0)
      );

      const rewardDays: Record<string, string> = {};
      localTeachers.filter(t => t.hasReward).forEach((t, idx) => {
        const dayIdx = idx % Math.max(1, Math.min(3, entryDatesSortedByLearners.length));
        rewardDays[t.id] = entryDatesSortedByLearners[dayIdx];
      });

      const StaffInfo = localTeachers.map(t => ({
        Member: {
          Firstname: t.firstName,
          Lastname: t.lastName,
          TeacherCode: t.id,
          Timetable: t.timetable,
          Subjects: t.subjects,
          Leave: leaveRequests.filter(lr => lr.teacherId === t.id),
          HomeRoomClass: t.homeRoomClass,
          BreakDuty: t.breakDutyDates,
          AfternoonBreakduty: t.afternoonDutyDates,
          Role: t.invigilationPreference || 'SCATTERED',
          HallPass: t.hallPass,
          Reward: t.hasReward ? 'yes' : 'no'
        }
      }));

      const originalEntriesSnapshot: TimetableEntry[] = JSON.parse(JSON.stringify(entries));
      const localEntries: TimetableEntry[] = JSON.parse(JSON.stringify(entries));

      const Timetable = localEntries.map(e => ({
        TotalMinutes: e.durationMinutes || 120,
        ScheduledDate: e.date,
        MorningSession: e.session === 'MORNING' ? {
          Subject: e.subject,
          Type: e.paperType,
          Duration: e.durationMinutes || 120,
          Total: e.totalStudents || 0,
          AssignedVenue: e.venueIds?.[0]
        } : null
      }));

      const getSessionsOnDayMap = (ents: TimetableEntry[]) => {
        const map: Record<string, Record<string, number>> = {};
        localTeachers.forEach(t => map[t.id] = {});
        ents.forEach(e => {
          if (!e.invigilatorAssignments) {return;}
          Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
            if (!map[tid]) {return;}
            const vId = key.split("_")[1];
            const role = key.split("_")[2];
            const isStandby = vId === "GRADE" || role === "STANDBY";
            if (!isStandby && e.venueIds && !e.venueIds.includes(vId)) {return;}

            if (!map[tid][e.date]) {map[tid][e.date] = 0;}
            map[tid][e.date]++;
          });
        });
        return map;
      };

      const isTeacherEligibleForEqualizeSlot = (t: Teacher, entry: TimetableEntry, pIdx: number, role: string, venueId: string, passLimit: number, respectRestricted: boolean, currentEntries: TimetableEntry[], tIdToAvoid?: string, sessionsMap?: Record<string, Record<string, number>>) => {
        if (t.invigilationPreference === "OPS") {return false;}
        if (tIdToAvoid && t.id === tIdToAvoid) {return false;}
        const dateStr = entry.date;

        if (t.hasReward && rewardDays[t.id] === dateStr && passLimit < 20) {return false;}

        const isReserve = role === "STANDBY" || role === "RESERVE";
        if (!isTeacherAllowedForEntry(t, entry.grade, dateStr, isReserve)) {return false;}

        const eDate = parseISO(dateStr);
        const sCounts = (sessionsMap || getSessionsOnDayMap(currentEntries))[t.id] || {};
        const sessions = sCounts[dateStr] || 0;

        if (sessions >= passLimit) {return false;}

        // Check Daily Load Limit
        if (settings.maxDailyMinutes > 0) {
          const dayMinutes = currentEntries.filter(e => e.date === dateStr && e.invigilatorAssignments)
            .reduce((sum, e) => {
              const dateP = resolvePeriodsForDate(e.date);
              return sum + Object.entries(e.invigilatorAssignments!).reduce((s, [k, tid]) => {
                if (tid !== t.id) return s;
                const pI = parseInt(k.split("_")[0]);
                const per = dateP[pI];
                if (!per) return s;
                return s + periodDurationMinutes(per);
              }, 0);
            }, 0);
          
          const pDur = periodDurationMinutes(resolvePeriodsForDate(dateStr)[pIdx]);
          if (dayMinutes + pDur > settings.maxDailyMinutes) return false;
        }

        const isAfterJune1 = !isBefore(eDate, parseISO("2026-06-01"));
        if (!isAfterJune1) {
          const isWriting = writingGradesByDate[dateStr]?.some(grade =>
             isAssignedToGradeInPeriod(t, grade, pIdx, dateStr)
          );
          if (!isWriting) {return false;}
        }

        const isWed = isWednesday(eDate);
        const isWednesdayFirst = isWed && pIdx === 0;
        if (isWednesdayFirst && settings.wednesdayHomeroomInvigilation) {
          if (t.homeRoomGrade) {
            if (t.homeRoomGrade !== entry.grade) {return false;}
          } else {
            if (entry.grade !== 12) {return false;}
          }
        }

        if (isSHEHOverride(t.id, dateStr)) {
            const isArtTech = entry.subject.toLowerCase().includes("visual art") && (role === "TECH" || role === "TECHNICAL");
            if (!isArtTech) {return false;}
        }

        if (t.id === "SHEH" && role === "STANDBY" && passLimit < 20) {
          return false;
        }

        const techTidsToday = new Set();
        currentEntries.forEach(e2 => {
          if (e2.date === dateStr && e2.invigilatorAssignments) {
            Object.entries(e2.invigilatorAssignments).forEach(([k, tid]) => {
              if (k.split("_")[1] !== "GRADE" && e2.venueIds && !e2.venueIds.includes(k.split("_")[1])) {return;}
              if (k.includes("_TECH") || k.includes("_TECHNICAL")) {techTidsToday.add(tid);}
            });
          }
        });

        if (settings.techTeachersNoInvigilationOnTechDay && techTidsToday.has(t.id) && !(role === "TECH" || role === "TECHNICAL")) {return false;}
        if ((role === "TECH" || role === "TECHNICAL") && !isTechnicalStaffEligible(t, entry.subject)) {return false;}

        // Check if manual only
        if ((role === "TECH" || role === "TECHNICAL") && settings.techManualOnly && !respectRestricted) {return false;}

        const isLS = isLSSubject(entry.subject);
        const isPrac = entry.paperType === "Prac";
        if (isLS && isPrac && (role === "TECH" || role === "TECHNICAL")) {
          if (!isLSSpecialistTeacher(t)) {return false;}
        }

        const hasHallPass = t.hallPass === true;
        if (!hasHallPass) {
          const isG12 = entry.grade === 12;
          const venue = venues.find(v => v.id === venueId);
          const isHall = venue?.name?.toLowerCase().includes("hall") || venue?.name?.toLowerCase().includes("assembly hall") || venue?.type === "Hall";
          if (isG12 || isHall) {return false;}
        }

        if (role !== "TECH" && role !== "TECHNICAL" && role !== "STANDBY" && passLimit < 10) {
          const assignmentsToday: number[] = [];
          currentEntries.forEach(e => {
            if (e.date === dateStr && e.invigilatorAssignments) {
              Object.entries(e.invigilatorAssignments).forEach(([k, tid]) => {
                if (tid === t.id) {
                  const match = k.match(/(\d+)/);
                  if (match) {assignmentsToday.push(parseInt(match[1]));}
                }
              });
            }
          });

          if (t.invigilationPreference === "SCATTERED") {
            const hasAdjacent = assignmentsToday.some(ap => Math.abs(ap - pIdx) <= 1 && ap !== pIdx);
            if (hasAdjacent && assignmentsToday.length >= 2) {return false;}
          }
        }

        if (isTeacherOnLeaveAtPeriod(t.id, pIdx, dateStr)) {return false;}

        return true;
      };

      // Sanitation pass - remove assignments for teachers no longer eligible
      updateStageProgress("sanitation", 10);
      await yieldToMain();

      let totalSanitized = 0;
      localEntries.forEach(entry => {
        if (!entry.invigilatorAssignments) {return;}
        const datePeriods = getPeriodsForDate(entry.date);
        Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
          const t = localTeachers.find(lt => lt.id === tid);
          if (!t) {
            delete entry.invigilatorAssignments![key];
            totalSanitized++;
            return;
          }
          const pIdx = parseInt(key.split("_")[0]);
          if (isTeacherOnLeaveAtPeriod(tid, pIdx, entry.date)) {
            delete entry.invigilatorAssignments![key];
            totalSanitized++;
          }
        });
      });
      updateStageProgress("sanitation", 100);
      await yieldToMain();

      // Reward days pass
      updateStageProgress("rewards", 10);
      await yieldToMain();

      let totalRewardFreed = 0;
      localEntries.forEach(entry => {
        if (!entry.invigilatorAssignments) {return;}
        Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
          const t = localTeachers.find(lt => lt.id === tid);
          if (!t || !t.hasReward) {return;}
          if (rewardDays[tid] === entry.date) {
            delete entry.invigilatorAssignments![key];
            totalRewardFreed++;
          }
        });
      });
      updateStageProgress("rewards", 100);
      await yieldToMain();

      // Auto-fill pass
      updateStageProgress("autofill", 10);
      await yieldToMain();

      let totalAutoFilled = 0;
      for (const entry of localEntries) {
        const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);
        const assignedVenuesList = venues.filter((v) => entry.venueIds?.includes(v.id));

        // Tech staff for practicals
        if (entry.paperType === "Prac") {
          for (const pIdx of relevantPIdxs) {
            const venueId = entry.venueIds?.[0] || "MANUAL";
            const key = getAssignmentKey(pIdx, venueId, "TECH", 0);
            if (entry.invigilatorAssignments?.[key]) {continue;}

            const techCandidates = localTeachers.filter(t =>
              isTechnicalStaffEligible(t, entry.subject) &&
              !isTeacherOnLeaveAtPeriod(t.id, pIdx, entry.date)
            );
            if (techCandidates.length > 0) {
              if (!entry.invigilatorAssignments) {entry.invigilatorAssignments = {};}
              entry.invigilatorAssignments[key] = techCandidates[0].id;
              totalAutoFilled++;
            }
          }
        }

        // Invigilators for venues
        for (const venue of assignedVenuesList) {
          const invCount = (venue.name?.toLowerCase().includes("hall") || venue.type === "Hall")
            ? (entry.grade === 12 ? Math.ceil((entry.totalStudents || 0) / 30) || 1 : Math.ceil((entry.totalStudents || 0) / 25) || 1)
            : 1;

          for (let i = 0; i < invCount; i++) {
            for (const pIdx of relevantPIdxs) {
              const key = getAssignmentKey(pIdx, venue.id, "INVIGILATOR", i);
              if (entry.invigilatorAssignments?.[key]) {continue;}

              const candidates = localTeachers
                .filter(t => isTeacherEligibleForEqualizeSlot(t, entry, pIdx, "INVIGILATOR", venue.id, 10, true, localEntries))
                .sort((a, b) => {
                  const aHours = (workloadStats.assigned[a.id] || 0);
                  const bHours = (workloadStats.assigned[b.id] || 0);
                  return aHours - bHours;
                });

              if (candidates.length > 0) {
                if (!entry.invigilatorAssignments) {entry.invigilatorAssignments = {};}
                entry.invigilatorAssignments[key] = candidates[0].id;
                totalAutoFilled++;
              }
            }
          }
        }

        // Standby
        for (const pIdx of relevantPIdxs) {
          const key = getAssignmentKey(pIdx, "GRADE", "STANDBY", 0);
          if (entry.invigilatorAssignments?.[key]) {continue;}

          const candidates = localTeachers
            .filter(t => isTeacherEligibleForEqualizeSlot(t, entry, pIdx, "STANDBY", "GRADE", 20, true, localEntries))
            .sort((a, b) => {
              const aHours = (workloadStats.assigned[a.id] || 0);
              const bHours = (workloadStats.assigned[b.id] || 0);
              return aHours - bHours;
            });

          if (candidates.length > 0) {
            if (!entry.invigilatorAssignments) {entry.invigilatorAssignments = {};}
            entry.invigilatorAssignments[key] = candidates[0].id;
            totalAutoFilled++;
          }
        }
      }
      updateStageProgress("autofill", 100);
      await yieldToMain();

      // Conflict resolution pass
      updateStageProgress("conflicts", 10);
      await yieldToMain();

      let totalConflictsResolved = 0;
      const localConflictMap: { [tId: string]: { [date: string]: { [pIdx: number]: string[] } } } = {};
      localEntries.forEach(entry => {
        if (!entry.invigilatorAssignments) {return;}
        Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
          if (!tid) {return;}
          const match = key.match(/(\d+)/);
          if (!match) {return;}
          const pIdx = parseInt(match[1]);
          if (!localConflictMap[tid]) {localConflictMap[tid] = {};}
          if (!localConflictMap[tid][entry.date]) {localConflictMap[tid][entry.date] = {};}
          if (!localConflictMap[tid][entry.date][pIdx]) {localConflictMap[tid][entry.date][pIdx] = [];}
          localConflictMap[tid][entry.date][pIdx].push(key);
        });
      });

      Object.entries(localConflictMap).forEach(([tid, dateMap]) => {
        Object.entries(dateMap).forEach(([date, pMap]) => {
          Object.entries(pMap).forEach(([pIdxStr, keys]) => {
            if (keys.length <= 1) {return;}
            const pIdx = parseInt(pIdxStr);
            const entry = localEntries.find(e =>
              e.date === date && e.invigilatorAssignments && e.invigilatorAssignments[keys[0]] === tid
            );
            if (!entry) {return;}

            for (let i = 1; i < keys.length; i++) {
              const conflictKey = keys[i];
              const parts = conflictKey.split("_");
              const venueId = parts[1];
              const role = parts[2];

              const replacementCandidates = localTeachers
                .filter(t =>
                  t.id !== tid &&
                  isTeacherEligibleForEqualizeSlot(t, entry, pIdx, role, venueId, 10, true, localEntries, tid)
                )
                .sort((a, b) => {
                  const aHours = (workloadStats.assigned[a.id] || 0);
                  const bHours = (workloadStats.assigned[b.id] || 0);
                  return aHours - bHours;
                });

              if (replacementCandidates.length > 0 && entry.invigilatorAssignments) {
                entry.invigilatorAssignments[conflictKey] = replacementCandidates[0].id;
                totalConflictsResolved++;
              } else if (entry.invigilatorAssignments) {
                delete entry.invigilatorAssignments[conflictKey];
                totalConflictsResolved++;
              }
            }
          });
        });
      });
      updateStageProgress("conflicts", 100);
      setEqResolvedConflicts(totalConflictsResolved);
      await yieldToMain();

      // Optimization pass - swap teachers to balance workload
      updateStageProgress("optimization", 10);
      await yieldToMain();

      let totalSwaps = 0;
      const MAX_SWAP_ITERATIONS = deepIter ? 500 : 200;
      for (let swapIter = 0; swapIter < MAX_SWAP_ITERATIONS; swapIter++) {
        let swapped = false;

        const overworked = localTeachers
          .filter(t => (workloadStats.assigned[t.id] || 0) > (t.workloadPercentage ?? 100) * workloadStats.minsPerUnit * 1.2)
          .sort((a, b) => (workloadStats.assigned[b.id] || 0) - (workloadStats.assigned[a.id] || 0));

        const underworked = localTeachers
          .filter(t => (workloadStats.assigned[t.id] || 0) < (t.workloadPercentage ?? 100) * workloadStats.minsPerUnit * 0.8)
          .sort((a, b) => (workloadStats.assigned[a.id] || 0) - (workloadStats.assigned[b.id] || 0));

        if (overworked.length === 0 || underworked.length === 0) {break;}

        for (const overT of overworked) {
          for (const entry of localEntries) {
            if (!entry.invigilatorAssignments) {continue;}
            const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);

            for (const [key, tid] of Object.entries(entry.invigilatorAssignments)) {
              if (tid !== overT.id) {continue;}

              const pIdx = parseInt(key.split("_")[0]);
              const venueId = key.split("_")[1];
              const role = key.split("_")[2];

              const replacement = underworked.find(u =>
                isTeacherEligibleForEqualizeSlot(u, entry, pIdx, role, venueId, 10, true, localEntries, overT.id)
              );

              if (replacement) {
                entry.invigilatorAssignments[key] = replacement.id;
                totalSwaps++;
                setEqSwaps(totalSwaps);
                swapped = true;
                break;
              }
            }
            if (swapped) {break;}
          }
          if (swapped) {break;}
        }

        if (!swapped) {break;}
        updateStageProgress("optimization", Math.min(90, Math.floor((swapIter / MAX_SWAP_ITERATIONS) * 90)));
        if (swapIter % 10 === 0) {await yieldToMain();}
      }
      updateStageProgress("optimization", 100);
      await yieldToMain();

      // Finalizing - write back to Firestore
      updateStageProgress("finalizing", 10);
      await yieldToMain();

      const batch = writeBatch(db);
      let batchCount = 0;
      for (const entry of localEntries) {
        const original = originalEntriesSnapshot.find(e => e.id === entry.id);
        if (!original) {continue;}
        if (JSON.stringify(entry.invigilatorAssignments) !== JSON.stringify(original.invigilatorAssignments)) {
          batch.update(doc(db, "timetableEntries", entry.id), {
            invigilatorAssignments: entry.invigilatorAssignments || {},
            updatedAt: new Date().toISOString(),
          });
          batchCount++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      updateStageProgress("finalizing", 100);

      if (totalSanitized + totalRewardFreed + totalAutoFilled + totalConflictsResolved + totalSwaps > 0) {
        toast.success(`Equalized: ${totalSanitized} sanitized, ${totalRewardFreed} rewards freed, ${totalAutoFilled} auto-filled, ${totalConflictsResolved} conflicts resolved, ${totalSwaps} swaps`);
      } else {
        toast.info("No changes needed - schedule is already balanced.");
      }
    } catch (error) {
      console.error("Equalize failed:", error);
      toast.error("Equalization failed. Please try again.");
    } finally {
      setIsEqualizing(false);
      clearInterval(timer);
    }
  };

  const conflictMap = useMemo(() => {
    const map: {
      [tId: string]: { [date: string]: { [pIdx: number]: Set<string> } };
    } = {};
    entries.forEach((entry) => {
      if (!entry.invigilatorAssignments) {return;}
      const date = entry.date;
      Object.entries(entry.invigilatorAssignments).forEach(([key, tId]) => {
        if (!tId) {return;}
        const match = key.match(/(\d+)/);
        if (!match) {return;}
        const pIdx = parseInt(match[1]);

        const parts = key.split("_");
        const venueId = parts[1];
        const role = parts[2];

        if (venueId !== "GRADE" && !entry.venueIds?.includes(venueId)) {return;}

        if (!map[tId]) {map[tId] = {};}
        if (!map[tId][date]) {map[tId][date] = {};}
        if (!map[tId][date][pIdx]) {map[tId][date][pIdx] = new Set();}

        const assignmentSignature = role === "STANDBY" ? "STANDBY" : `${venueId}_${role}`;
        map[tId][date][pIdx].add(assignmentSignature);
      });
    });
    return map;
  }, [entries]);

  const writingGradesByDate = useMemo(() => {
    const map: { [date: string]: number[] } = {};
    entries.forEach((e) => {
      if (!map[e.date]) {map[e.date] = [];}
      if (!map[e.date].includes(e.grade)) {
        map[e.date].push(e.grade);
      }
    });
    Object.keys(map).forEach(dateStr => {
      const d = parseISO(dateStr);
      if (d.getMonth() === 5 && d.getDate() >= 1 && d.getDate() <= 19) {
        map[dateStr] = [8, 9, 10, 11, 12];
      }
    });
    return map;
  }, [entries]);

  const workloadStats = useMemo(() => {
    let totalInvigilationMinutesRequired = 0;
    const assignedMinutes: { [teacherId: string]: number } = {};
    const teacherBreakdown: {
      [teacherId: string]: {
        morning: number,
        afternoon: number,
        tech: number,
        standby: number
      }
    } = {};
    const teacherPotentials: { [teacherId: string]: number } = {};

    teachers.forEach((t) => {
      if (!isEligibleForInvigilation(t))
        {return;}

      const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
      assignedMinutes[t.id] = 0;
      teacherBreakdown[t.id] = { morning: 0, afternoon: 0, tech: 0, standby: 0 };
      teacherPotentials[t.id] = (t.workloadPercentage ?? 100) * (isSpec ? 0.7 : 1);
    });

    const totalPotentialUnits = Object.values(teacherPotentials).reduce(
      (a, b) => a + b,
      0,
    );

    entries.forEach((entry) => {
      const datePeriods = resolvePeriodsForDate(entry.date) as any[];

      const periodEndOffsets = datePeriods.map((p) => {
        const [h, m] = p.end.split(":").map(Number);
        return h * 60 + m - (7 * 60 + 50);
      });

      const { startMinutes, endMinutes } = getEntryTimes(entry, entries);
      const sessionStartOffset = startMinutes - (7 * 60 + 50);
      const endOffset = endMinutes - (7 * 60 + 50);

      const relevantPIdxs = datePeriods
        .map((_, i) => i)
        .filter((idx) => {
          const pStart = idx === 0 ? 0 : periodEndOffsets[idx - 1];
          const pEnd = periodEndOffsets[idx];
          const overlaps = Math.max(
            0,
            Math.min(endOffset, pEnd) - Math.max(sessionStartOffset, pStart),
          );
          return overlaps > 0;
        });

      const isPrac = entry.paperType === "Prac";
      const assignedVenueObjs = (entry.venueIds || [])
        .map((vid) => venues.find((v) => v.id === vid))
        .filter(Boolean);

      relevantPIdxs.forEach((pIdx) => {
        const period = datePeriods[pIdx];
        const pDuration = periodDurationMinutes(period);

        assignedVenueObjs.forEach((venue) => {
          if (!venue) {return;}
          const isHall =
            venue.name?.toLowerCase().includes("hall") || venue.type === "Hall";
          const isG12 = entry.grade === 12;

          let invCount = 1;
          if (isHall) {
            if (isG12) {
              invCount = Math.ceil((entry.totalStudents || 0) / 30) || 1;
            } else {
              invCount = Math.ceil((entry.totalStudents || 0) / 25) || 1;
            }
          }

          const slots = invCount + (isPrac ? 1 : 0) + 1;
          totalInvigilationMinutesRequired += slots * pDuration;

          for (let i = 0; i < invCount; i++) {
            const key = getAssignmentKey(pIdx, venue.id, "INVIGILATOR", i);
            const tid = entry.invigilatorAssignments?.[key];
            if (tid && assignedMinutes[tid] !== undefined) {
              assignedMinutes[tid] += pDuration;
              if (entry.session === "MORNING") {teacherBreakdown[tid].morning += pDuration;}
              else {teacherBreakdown[tid].afternoon += pDuration;}
            }
          }
          if (isPrac) {
            const key = getAssignmentKey(pIdx, venue.id, "TECH", 0);
            const tid = entry.invigilatorAssignments?.[key];
            if (tid && assignedMinutes[tid] !== undefined) {
              const techDuration = settings.equalizeMinutesWithTechDiscount ? pDuration * 0.75 : pDuration;
              assignedMinutes[tid] += techDuration;
              teacherBreakdown[tid].tech += pDuration;
            }
          }
          const standbyKey = getAssignmentKey(pIdx, "GRADE", "STANDBY", 0);
          const standbyTid = entry.invigilatorAssignments?.[standbyKey];
          if (standbyTid && assignedMinutes[standbyTid] !== undefined) {
            assignedMinutes[standbyTid] += pDuration;
            teacherBreakdown[standbyTid].standby += pDuration;
          }
        });
      });
    });

    const minsPerUnit =
      totalPotentialUnits > 0
        ? totalInvigilationMinutesRequired / totalPotentialUnits
        : 0;

    let totalConflicts = 0;
    Object.values(conflictMap).forEach((dayMap) => {
      Object.values(dayMap).forEach((pMap) => {
        Object.values(pMap).forEach((ids) => {
          if ((ids as unknown as Set<string>).size > 1) {totalConflicts++;}
        });
      });
    });

    return {
      totalRequired: totalInvigilationMinutesRequired,
      assigned: assignedMinutes,
      breakdown: teacherBreakdown,
      minsPerUnit,
      totalUnits: totalPotentialUnits,
      totalConflicts,
    };
  }, [entries, teachers, venues, dayPeriodConfigs, conflictMap]);

  const handleExportAssignmentsCSV = () => {
    const headers = [
      "Date",
      "Grade",
      "Subject",
      "Venue",
      "Period Slot",
      "Period Time",
      "Invigilator",
      "Exam Start",
      "Exam End",
    ];

    const rows = entries
      .flatMap((entry) => {
        const assignments = entry.invigilatorAssignments || {};
        return Object.entries(assignments).map(([key, teacherId]) => {
          const parts = key.split("_");
          const pIdx = parseInt(parts[0]);
          const vId = parts[1];
          const teacher = teachers.find((t) => t.id === teacherId);
          const venue = venues.find((v) => v.id === vId);

          const datePeriods = resolvePeriodsForDate(entry.date);
          const period = datePeriods[pIdx];

          const { start: startStr, end: endTimeStr } = getEntryTimes(entry, entries);

          return {
            date: entry.date,
            grade: entry.grade,
            subject: entry.subject,
            venueName: venue?.name || (vId === "GRADE" ? `Grade ${entry.grade} Standby` : (vId === "manual" ? "Manual Slot" : vId || "Unknown")),
            periodLabel: period?.label || `P${pIdx + 1}`,
            periodTime: period ? `${period.start} - ${period.end}` : "",
            periodStartTime: period?.start || "00:00",
            teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : (teacherId === "REMAINDER_OF_DAY_BUSY" ? "Specialist Prep" : teacherId),
            examStart: startStr,
            examEnd: endTimeStr,
          };
        });
      })
      .sort((a, b) => {
        const dComp = a.date.localeCompare(b.date);
        if (dComp !== 0) {return dComp;}
        if (a.grade !== b.grade) {return b.grade - a.grade;}
        const sComp = a.subject.localeCompare(b.subject);
        if (sComp !== 0) {return sComp;}
        const vComp = a.venueName.localeCompare(b.venueName);
        if (vComp !== 0) {return vComp;}
        return a.periodStartTime.localeCompare(b.periodStartTime);
      })
      .map((r) => [
        r.date,
        r.grade.toString(),
        `"${r.subject}"`,
        `"${r.venueName}"`,
        `"${r.periodLabel}"`,
        `"${r.periodTime}"`,
        `"${r.teacherName}"`,
        r.examStart,
        r.examEnd,
      ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `invigilation_schedule_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activeTab, setActiveTab] = useState<
    | "SUBJECTS"
    | "FACULTY"
    | "TIMETABLE"
    | "VENUES"
    | "SCHEDULER"
    | "ASSIGNMENTS"
    | "INSPECTION"
  >("SUBJECTS");
  const [assignmentsSubTab, setAssignmentsSubTab] = useState<"SUMMARY" | "TABLE">("SUMMARY");

  const lastUpdatedDate = useMemo(() => {
    const dates = entries
      .map(e => e.updatedAt)
      .filter(Boolean)
      .map(d => parseISO(d as string).getTime());
    if (dates.length === 0) {return null;}
    return new Date(Math.max(...dates));
  }, [entries]);
  const [timetableDate, setTimetableDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [selectedTeacherForTimetable, setSelectedTeacherForTimetable] =
    useState<Teacher | null>(null);
  const [selectedTeacherForSubjects, setSelectedTeacherForSubjects] =
    useState<Teacher | null>(null);
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] =
    useState<Teacher | null>(null);
  const [selectedTeacherForBreakDuty, setSelectedTeacherForBreakDuty] =
    useState<Teacher | null>(null);
  const [selectedTeacherForLeave, setSelectedTeacherForLeave] =
    useState<Teacher | null>(null);
  const [selectedTeacherForHomeRoom, setSelectedTeacherForHomeRoom] =
    useState<Teacher | null>(null);
  const [selectedInspectionTeacherId, setSelectedInspectionTeacherId] = useState<string>("");
  const [inspectionView, setInspectionView] = useState<"TABLE" | "CALENDAR">("TABLE");
  const [selectedInspectionDate, setSelectedInspectionDate] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<
    "IDLE" | "LOADING" | "SUCCESS" | "ERROR"
  >("IDLE");
  const [isSaving, setIsSaving] = useState(false);

  const now = new Date();
  const currentCycle = getCycleForDate(now);
  const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const currentPeriodIdx = getCurrentPeriodIndex(now);

  const getTeacherStatus = (t: Teacher) => {
    if (
      !t.timetable ||
      currentDayIdx > 4 ||
      currentPeriodIdx === null ||
      currentPeriodIdx === -1
    )
      {return null;}
    const cycleKey = currentCycle === 1 ? "cycle1" : "cycle2";
    const grade =
      t.timetable[cycleKey][currentDayIdx.toString()]?.[currentPeriodIdx];
    return grade ? grade : null;
  };

  const stats = [
    {
      label: "Total Teachers",
      value: teachers.length,
      icon: Users,
      color: "text-curro-blue",
      bg: "bg-blue-50",
    },
    {
      label: "Active Sessions",
      value: sessions.filter((s) => s.status === "IN_PROGRESS").length,
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending Leaves",
      value: leaveRequests.filter((r) => r.status === "PENDING").length,
      icon: Calendar,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total Hours",
      value: `${teachers.reduce((acc, t) => acc + (t.totalHours || 0), 0).toFixed(2)}h`,
      icon: ArrowUpRight,
      color: "text-curro-red",
      bg: "bg-red-50",
    },
  ];

  const handleRemoveTeacher = (teacher: Teacher) => {
    setConfirmState({
      open: true,
      title: "Remove teacher",
      message: `Are you sure you want to remove ${teacher.firstName} ${teacher.lastName}?`,
      variant: "destructive",
      confirmLabel: "Remove",
      onConfirm: async () => {
        setIsSaving(true);
        await safeFirestoreWrite(
          () => deleteDoc(doc(db, "users", teacher.uid || teacher.id)),
          OperationType.DELETE,
          `users/${teacher.id}`,
          handleFirestoreError,
        );
        setIsSaving(false);
      },
    });
  };

  const bootstrapFaculty = async () => {
    setBootstrapStatus("LOADING");
    setIsSaving(true);
    try {
      for (const t of INITIAL_TEACHERS) {
        await setDoc(
          doc(db, "users", t.id),
          {
            ...t,
            uid: "",
          },
          { merge: true },
        );
      }
      setBootstrapStatus("SUCCESS");
      setTimeout(() => setBootstrapStatus("IDLE"), 3000);
    } catch (error) {
      setBootstrapStatus("ERROR");
      handleFirestoreError(error, OperationType.WRITE, "users/bootstrap");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTeacher = async (
    teacherId: string,
    updates: Partial<Teacher>,
  ) => {
    setIsSaving(true);
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) { setIsSaving(false); return; }
    const targetId = teacher.uid || teacher.id;
    await safeFirestoreWrite(
      () => updateDoc(doc(db, "users", targetId), updates),
      OperationType.UPDATE,
      `users/${teacherId}`,
      handleFirestoreError,
    );
    setIsSaving(false);
  };


  return (
    <div className="flex flex-col gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight leading-none uppercase italic">
            Command Center
          </h2>
          <div className="flex items-center gap-3 mt-3">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
              Institutional Nexus
            </p>
            <div
              className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border transition-all duration-300 ${currentCycle === 1 ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}
            >
              Temporal Cycle: {currentCycle}
            </div>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          {onToggleWideLayout && (
            <button
              onClick={onToggleWideLayout}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-300 group ${
                wideLayout
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
              }`}
            >
              {wideLayout ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {wideLayout ? "Collapse UI" : "Expand UI"}
            </button>
          )}

          <div className="h-8 w-[1px] bg-white/10 mx-1 hidden lg:block" />

          {bootstrapStatus === "SUCCESS" ? (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Nexus Synced
            </div>
          ) : bootstrapStatus === "ERROR" ? (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              Sync Interrupted
            </div>
          ) : (
            <button
              onClick={bootstrapFaculty}
              disabled={isSaving || bootstrapStatus === "LOADING"}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-500 hover:bg-amber-500/10 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              {bootstrapStatus === "LOADING" ? "Initializing..." : "Seed Database"}
            </button>
          )}
          
          <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:text-white hover:border-slate-600 transition-all uppercase tracking-widest">
            <Download className="w-3.5 h-3.5" />
            Archive
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-105 transition-all">
            <Plus className="w-4 h-4" />
            Provision
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {workloadStats.totalConflicts > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group p-1 rounded-[2.5rem] bg-gradient-to-br from-rose-500 to-rose-700 shadow-2xl shadow-rose-500/20 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent)] pointer-events-none" />
          <div className="relative p-6 px-8 rounded-[2.25rem] bg-rose-600/10 backdrop-blur-sm border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[28px] flex items-center justify-center shadow-inner border border-white/20">
                <ShieldAlert className="w-10 h-10 text-white animate-pulse" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-2">
                  System Conflict Detected
                </h3>
                <p className="text-sm font-medium text-rose-100 max-w-xl leading-relaxed opacity-90">
                  Detected <span className="font-black text-white">{workloadStats.totalConflicts} overlaps</span> in the active schedule. 
                  Synchronicity failure detected in teacher assignments. Automated resolution recommended.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("ASSIGNMENTS")}
              className="bg-white text-rose-600 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
            >
              Resolve Matrix
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bento-card p-6 relative group overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-indigo-500/10" />
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border border-white/5 bg-slate-950 transition-all group-hover:scale-110`}
              >
                <stat.icon className={`w-5 h-5 ${stat.label.includes("Total") ? "text-indigo-400" : stat.label.includes("Active") ? "text-emerald-400" : "text-amber-400"}`} />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-black text-white tracking-tighter relative z-10">
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex justify-center -mb-4 relative z-10">
        <div className="p-1.5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-[2rem] flex flex-wrap gap-2 shadow-2xl">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            aria-label="Admin sections"
            className="flex-wrap bg-transparent border-none p-0 w-auto"
          >
            <TabButton value="SUBJECTS" icon={<BookOpen className="w-4 h-4" />}>
              Subjects
            </TabButton>
            <TabButton value="FACULTY" icon={<Users className="w-4 h-4" />}>
              Faculty
            </TabButton>
            <TabButton value="TIMETABLE" icon={<CalendarRange className="w-4 h-4" />}>
              Exams
            </TabButton>
            <TabButton value="VENUES" icon={<MapPin className="w-4 h-4" />}>
              Venues
            </TabButton>
            <TabButton value="SCHEDULER" icon={<ClipboardCheck className="w-4 h-4" />}>
              Scheduler
            </TabButton>
            <TabButton value="ASSIGNMENTS" icon={<Activity className="w-4 h-4" />}>
              Analytics
            </TabButton>
            <TabButton value="INSPECTION" icon={<Search className="w-4 h-4" />}>
              Audit
            </TabButton>
          </Tabs>
        </div>
      </div>

      <div className="min-h-[600px]">
        {activeTab === "SUBJECTS" && (
          <SubjectsTab
            subjects={subjects}
            teachers={teachers}
            entries={entries}
            isSaving={isSaving}
            onBackup={handleSubjectBackup}
          />
        )}
        {activeTab === "FACULTY" && (
          <FacultyTab
            teachers={teachers}
            leaveRequests={leaveRequests}
            allSubjects={allSubjects}
            workloadStats={workloadStats}
            searchTerm={searchTerm}
            selectedSubject={selectedSubject}
            wideLayout={wideLayout}
            setSearchTerm={setSearchTerm}
            setSelectedSubject={setSelectedSubject}
            setIsAddModalOpen={setIsAddModalOpen}
            setSelectedTeacherForTimetable={setSelectedTeacherForTimetable}
            setSelectedTeacherForSubjects={setSelectedTeacherForSubjects}
            setSelectedTeacherForEdit={setSelectedTeacherForEdit}
            setSelectedTeacherForBreakDuty={setSelectedTeacherForBreakDuty}
            setSelectedTeacherForHomeRoom={setSelectedTeacherForHomeRoom}
            setSelectedTeacherForLeave={setSelectedTeacherForLeave}
            setSelectedInspectionTeacherId={setSelectedInspectionTeacherId as (id: string) => void}
            setSelectedInspectionDate={setSelectedInspectionDate as (date: string | null) => void}
            setInspectionView={setInspectionView as (view: string) => void}
            setActiveTab={setActiveTab as (tab: string) => void}
            getTeacherStatus={getTeacherStatus}
            handleFacultyBackup={handleFacultyBackup}
            handleUpdateTeacher={handleUpdateTeacher}
            handleRemoveTeacher={handleRemoveTeacher}
          />
        )}
        {activeTab === "ASSIGNMENTS" && (
          <AssignmentsTab
            leaveRequests={leaveRequests}
            entries={entries}
            teachers={teachers}
            venues={venues}
            dayPeriodConfigs={dayPeriodConfigs}
            lastUpdatedDate={lastUpdatedDate}
            conflictMap={conflictMap}
            assignmentsSubTab={assignmentsSubTab}
            showStats={showStats}
            enableCheckMode={enableCheckMode}
            isGenerating={isGenerating}
            isEqualizing={isEqualizing}
            setAssignmentsSubTab={setAssignmentsSubTab}
            setShowStats={setShowStats}
            setEnableCheckMode={setEnableCheckMode}
            setActiveTab={setActiveTab}
            handleExportAssignmentsCSV={handleExportAssignmentsCSV}
            handleEqualize={handleEqualize}
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
          <VenuesTab
            venues={venues}
            isSaving={isSaving}
            onBackup={handleVenueBackup}
          />
        )}
        {activeTab === "SCHEDULER" && (
          <SchedulerTab
            teachers={teachers}
            entries={entries}
            venues={venues}
            subjects={subjects}
            dayPeriodConfigs={dayPeriodConfigs}
            conflictMap={conflictMap}
            leaveRequests={leaveRequests}
            writingGradesByDate={writingGradesByDate}
            workloadStats={workloadStats}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            isEqualizing={isEqualizing}
            setIsEqualizing={setIsEqualizing}
            eqProgress={eqProgress}
            setEqProgress={setEqProgress}
            eqSwaps={eqSwaps}
            setEqSwaps={setEqSwaps}
            eqResolvedConflicts={eqResolvedConflicts}
            setEqResolvedConflicts={setEqResolvedConflicts}
            eqStages={eqStages}
            setEqStages={setEqStages}
            interactiveWorkload={interactiveWorkload}
            setInteractiveWorkload={setInteractiveWorkload}
            genProgress={genProgress}
            setGenProgress={setGenProgress}
            repackCount={repackCount}
            setRepackCount={setRepackCount}
            genElapsedTime={genElapsedTime}
            setGenElapsedTime={setGenElapsedTime}
            autoFromDate={autoFromDate}
            setAutoFromDate={setAutoFromDate}
            autoUntilDate={autoUntilDate}
            setAutoUntilDate={setAutoUntilDate}
            handleEqualize={handleEqualize}
            handleAutoGenerate={handleAutoGenerate}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            getPeriodsForDate={getPeriodsForDate}
            activePeriods={activePeriods}
            activePeriodEndOffsets={activePeriodEndOffsets}
            isAssignedToGradeInPeriod={isAssignedToGradeInPeriod}
            isFreeInPeriod={isFreeInPeriod}
            getRelevantPeriodsIdx={getRelevantPeriodsIdx}
            hasIncompleteVenues={hasIncompleteVenues}
            hasIncompleteVenuesForSelectedDate={hasIncompleteVenuesForSelectedDate}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
        {activeTab === "INSPECTION" && (
          <InspectionTab
            teachers={teachers}
            entries={entries}
            dayPeriodConfigs={dayPeriodConfigs}
            venues={venues}
            selectedInspectionTeacherId={selectedInspectionTeacherId}
            inspectionView={inspectionView}
            selectedInspectionDate={selectedInspectionDate}
            confirmState={confirmState}
            isSaving={isSaving}
            setSelectedInspectionTeacherId={setSelectedInspectionTeacherId}
            setInspectionView={setInspectionView}
            setSelectedInspectionDate={setSelectedInspectionDate}
            setConfirmState={setConfirmState}
            setIsSaving={setIsSaving}
          />
        )}

        {/* Modals */}
        <AnimatePresence>
          {selectedTeacherForTimetable && (
            <TimetableModal
              teacher={selectedTeacherForTimetable}
              onClose={() => setSelectedTeacherForTimetable(null)}
              onSave={(updates) =>
                handleUpdateTeacher(selectedTeacherForTimetable.id, updates)
              }
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForSubjects && (
            <SubjectsModal
              teacher={selectedTeacherForSubjects}
              allSubjects={subjects}
              onClose={() => setSelectedTeacherForSubjects(null)}
              onSave={(updates) =>
                handleUpdateTeacher(selectedTeacherForSubjects.id, updates)
              }
              isSaving={isSaving}
            />
          )}
          {isAddModalOpen && (
            <TeacherFormModal
              mode="add"
              onClose={() => setIsAddModalOpen(false)}
              onSave={async (teacher) => {
                setIsSaving(true);
                const result = await safeFirestoreWrite(
                  () => setDoc(doc(db, "users", teacher.id!), {
                    ...teacher,
                    uid: "",
                  }),
                  OperationType.CREATE,
                  "users",
                  handleFirestoreError,
                );
                if (result !== undefined) { setIsAddModalOpen(false); }
                setIsSaving(false);
              }}
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForEdit && (
            <TeacherFormModal
              mode="edit"
              teacher={selectedTeacherForEdit}
              onClose={() => setSelectedTeacherForEdit(null)}
              onSave={(updates) =>
                handleUpdateTeacher(selectedTeacherForEdit.id, updates)
              }
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForBreakDuty && (
            <BreakDutyModal
              teacher={selectedTeacherForBreakDuty}
              onClose={() => setSelectedTeacherForBreakDuty(null)}
              onSave={(breakDates, afternoonDates) =>
                handleUpdateTeacher(selectedTeacherForBreakDuty.id, {
                  breakDutyDates: breakDates,
                  afternoonDutyDates: afternoonDates,
                })
              }
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForHomeRoom && (
            <HomeRoomModal
              teacher={selectedTeacherForHomeRoom}
              onClose={() => setSelectedTeacherForHomeRoom(null)}
              onSave={(grade, cls) =>
                handleUpdateTeacher(selectedTeacherForHomeRoom.id, {
                  homeRoomGrade: grade,
                  homeRoomClass: cls,
                })
              }
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForLeave && (
            <LeaveRequestModal
              teacher={selectedTeacherForLeave}
              onClose={() => setSelectedTeacherForLeave(null)}
              user={activeUser}
              requests={leaveRequests.filter(
                (r) => r.teacherId === selectedTeacherForLeave.id,
              )}
              onSave={async (request) => {
                setIsSaving(true);
                await safeFirestoreWrite(
                  () => {
                    const leaveRef = doc(collection(db, "leaveRequests"));
                    return setDoc(leaveRef, { ...request, id: leaveRef.id });
                  },
                  OperationType.WRITE,
                  "leaveRequests",
                  handleFirestoreError,
                );
                setIsSaving(false);
              }}
              onUpdateStatus={async (requestId, status) => {
                setIsSaving(true);
                await safeFirestoreWrite(
                  () => updateDoc(doc(db, "leaveRequests", requestId), {
                    status,
                  }),
                  OperationType.WRITE,
                  `leaveRequests/${requestId}`,
                  handleFirestoreError,
                );
                setIsSaving(false);
              }}
              onDelete={async (requestId) => {
                setIsSaving(true);
                await safeFirestoreWrite(
                  () => deleteDoc(doc(db, "leaveRequests", requestId)),
                  OperationType.DELETE,
                  `leaveRequests/${requestId}`,
                  handleFirestoreError,
                );
                setIsSaving(false);
              }}
              isSaving={isSaving}
            />
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showStats && (
          <StatsModal
            isOpen={showStats}
            onClose={() => setShowStats(false)}
            teachers={teachers}
            entries={entries}
            dayPeriodConfigs={dayPeriodConfigs}
          />
        )}
      </AnimatePresence>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
