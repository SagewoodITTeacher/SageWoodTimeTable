import { Teacher, TimetableEntry, DayPeriodConfig, PeriodConfig, LeaveRequest } from "../../../types";
import { getCycleForDate, FAL_SUBJECTS, PERIODS, WEDNESDAY_PERIODS } from "../../../constants";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { OperationType } from "../../../firebase";

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
  const defaultStart = entry.session === "MORNING" ? "08:20" : "13:20";
  if (entry.sessionMode !== "SEQUENTIAL") {
    const [h, m] = defaultStart.split(":").map(Number);
    const startTotal = h * 60 + m;
    const duration = entry.durationMinutes || 180;
    const endTotal = startTotal + duration;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    return {
      start: defaultStart,
      end: endStr,
      startMinutes: startTotal,
      endMinutes: endTotal,
    };
  }

  const sessionEntries = allEntries
    .filter(
      (e) =>
        e.date === entry.date &&
        e.grade === entry.grade &&
        e.session === entry.session,
    )
    .sort((a, b) => {
      const getPriority = (type: string) => {
        if (type === "P1") {return 1;}
        if (type === "P2") {return 2;}
        if (type === "P3") {return 3;}
        if (type === "Prac") {return 0;}
        return 4;
      };
      const pA = getPriority(a.paperType);
      const pB = getPriority(b.paperType);
      if (pA !== pB) {return pA - pB;}
      return a.id.localeCompare(b.id);
    });

  const [hBase, mBase] = defaultStart.split(":").map(Number);
  let currentStartMinutes = hBase * 60 + mBase;

  for (const e of sessionEntries) {
    const duration = e.durationMinutes || 180;
    if (e.id === entry.id) {
      const endTotal = currentStartMinutes + duration;
      const startH = Math.floor(currentStartMinutes / 60);
      const startM = currentStartMinutes % 60;
      const endH = Math.floor(endTotal / 60);
      const endM = endTotal % 60;

      return {
        start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
        end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        startMinutes: currentStartMinutes,
        endMinutes: endTotal,
      };
    }
    currentStartMinutes += duration;
  }

  const startMins = hBase * 60 + mBase;
  return {
    start: defaultStart,
    end: defaultStart,
    startMinutes: startMins,
    endMinutes: startMins,
  };
};

export const IT_SPECIALIST_IDS = ["FRAN", "JACB", "NORT", "ORMA"];
export const LS_SPECIALIST_IDS = ["CHAM", "EZNY", "ORIM", "CPMO", "ENYA"];
export const ART_SPECIALIST_IDS = ["SHEH", "SHHU"];
export const ALL_SPECIALIST_IDS = [...IT_SPECIALIST_IDS, ...LS_SPECIALIST_IDS, ...ART_SPECIALIST_IDS];

export const isITSpecialistTeacher = (teacher: Teacher) => IT_SPECIALIST_IDS.includes(teacher.id);
export const isLSSpecialistTeacher = (teacher: Teacher) => LS_SPECIALIST_IDS.includes(teacher.id);
export const isArtSpecialistTeacher = (teacher: Teacher) => ART_SPECIALIST_IDS.includes(teacher.id);

export const isTeacherRestricted = (teacher: Teacher, subject: string) => {
  const isFAL = subject === "First Additional Languages";
  const teacherSubjects =
    teacher.subjects?.map((s) => (s.name || s.code).toLowerCase()) || [];

  if (isFAL) {
    return teacherSubjects.some(
      (ts) =>
        FAL_SUBJECTS.some((f) => f.toLowerCase() === ts) ||
        ts === "first additional languages",
    );
  }
  const targetSubject = subject.toLowerCase().trim();

  // Explicit tech constraints as per user:
  const isCAT = targetSubject === "cat" || targetSubject === "computer application technology";
  const isIT = targetSubject === "it" || targetSubject === "information technology";
  const isLS = targetSubject === "life science" || targetSubject === "life sciences";
  const isArt = targetSubject === "visual art";

  if (isCAT || isIT) {
    if (isITSpecialistTeacher(teacher)) {return true;}
  }
  if (isLS) {
    if (isLSSpecialistTeacher(teacher)) {return true;}
  }
  if (isArt) {
    if (isArtSpecialistTeacher(teacher)) {return true;}
  }

  return teacherSubjects.some((ts) => {
    const teacherSub = ts.toLowerCase().trim();
    return (
      teacherSub === targetSubject ||
      (teacherSub === "life science" && targetSubject === "life sciences") ||
      (teacherSub === "life sciences" && targetSubject === "life science") ||
      (teacherSub === "it" && targetSubject === "information technology") ||
      (teacherSub === "information technology" && targetSubject === "it") ||
      (teacherSub === "cat" && targetSubject === "computer application technology") ||
      (teacherSub === "computer application technology" && targetSubject === "cat")
    );
  });
};

export const isTechnicalStaffEligible = (teacher: Teacher, subject: string) => {
  const s = subject.toLowerCase().trim();
  const isCAT = s === "cat" || s.includes("computer application technology");
  const isIT = s === "it" || s.includes("information technology") || s.includes("coding") || s.includes("robotics");
  const isLS = s === "ls" || s === "life science" || s === "life sciences" || s.includes("life science");
  const isArt = s === "visual art" || s.includes("visual art");

  if (isCAT || isIT) {return isITSpecialistTeacher(teacher);}
  if (isLS) {return isLSSpecialistTeacher(teacher);}
  if (isArt) {return isArtSpecialistTeacher(teacher);}

  // Strictly only these people can do Tech
  return false;
};

export const isTechnicalSubject = (subject: string) => {
  const s = subject.toLowerCase().trim();
  return s === "cat" ||
         s.includes("computer application technology") ||
         s === "it" ||
         s.includes("information technology") ||
         s.includes("coding") ||
         s.includes("robotics") ||
         s === "ls" ||
         s === "life science" ||
         s === "life sciences" ||
         s.includes("life science") ||
         s === "visual art" ||
         s.includes("visual art");
};

export const periodDurationMinutes = (period: { start: string; end: string }) => {
  const [sh, sm] = period.start.split(":").map(Number);
  const [eh, em] = period.end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

// --- Period resolution helpers ---

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

  const standardDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  if (standardDays.includes(dayName)) {
    const extraSlots = [
      { id: 10, start: "14:30", end: "15:20", label: "A1" },
      { id: 11, start: "15:20", end: "16:10", label: "A2" },
      { id: 12, start: "16:10", end: "17:00", label: "A3" },
    ];
    extraSlots.forEach((slot) => {
      if (!basePeriods.some((p) => p.label === slot.label || p.start === slot.start)) {
        basePeriods.push(slot);
      }
    });
  }

  return basePeriods.sort((a, b) => a.start.localeCompare(b.start));
};

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

// --- Invigilation eligibility helpers ---

const EXCLUDED_FROM_INVIGILATION_IDS = new Set(["MERV"]);

export const isExcludedFromInvigilation = (teacher: Teacher | undefined | null): boolean => {
  if (!teacher) {return false;}
  return EXCLUDED_FROM_INVIGILATION_IDS.has(teacher.id);
};

const FRANZ_IDS = new Set(["NORT", "FRAN"]);

export const isEligibleForInvigilation = (teacher: Teacher): boolean => {
  const isSpec = isITSpecialistTeacher(teacher) || isLSSpecialistTeacher(teacher) || isArtSpecialistTeacher(teacher);
  const isFranz = FRANZ_IDS.has(teacher.id);
  return !isExcludedFromInvigilation(teacher) && (isSpec || isFranz || (teacher.activeRole !== "WEBMASTER" && teacher.canInvigilate !== false));
};

// --- SHEH override ---

export const SHEH_OVERRIDE_DATES = new Set(["2026-06-18", "2026-06-19"]);

export const isSHEHOverride = (teacherId: string, dateStr: string): boolean => {
  return teacherId === "SHEH" && SHEH_OVERRIDE_DATES.has(dateStr);
};

export const hasGradeMarkerInPeriod = (
  teacher: Teacher,
  grade: number,
  periodIdx: number,
  dateStr: string,
) => {
  const cell = getTimetableCell(teacher, periodIdx, dateStr);
  if (!cell) return false;
  const cellStr = String(cell);
  return cellStr.includes(`[${grade}]`);
};

export const isTeacherAllowedForGradeOnDate = (
  teacher: any,
  grade: number,
  dateStr: string,
  settings: any,
  isStandby: boolean = false
) => {
  if (!dateStr || !settings) return true;
  const d = parseISO(dateStr);
  const isGrade12 = grade === 12;
  const isGrade10_11 = grade === 10 || grade === 11;
  const isGrade8_9 = grade === 8 || grade === 9;

  // Reserve Range check
  if (isStandby && settings.reserveRange?.start && settings.reserveRange?.end) {
    const s = parseISO(settings.reserveRange.start);
    const e = parseISO(settings.reserveRange.end);
    if (isBefore(d, s) || isAfter(d, e)) return false;
  }

  // Grade 12 check
  if (isGrade12 && settings.grade12Range?.start && settings.grade12Range?.end) {
    const s = parseISO(settings.grade12Range.start);
    const e = parseISO(settings.grade12Range.end);
    if (isBefore(d, s) || isAfter(d, e)) return false;
  }
  // Grade 10-11 check
  if (isGrade10_11 && settings.grade10_11Range?.start && settings.grade10_11Range?.end) {
    const s = parseISO(settings.grade10_11Range.start);
    const e = parseISO(settings.grade10_11Range.end);
    if (isBefore(d, s) || isAfter(d, e)) return false;
  }
  // Grade 8-9 check
  if (isGrade8_9 && settings.grade8_9Range?.start && settings.grade8_9Range?.end) {
    const s = parseISO(settings.grade8_9Range.start);
    const e = parseISO(settings.grade8_9Range.end);
    if (isBefore(d, s) || isAfter(d, e)) return false;
  }
  
  return true;
};

// --- Leave check ---

export const isTeacherOnLeaveAtPeriod = (
  teacherId: string,
  periodIdx: number,
  dateStr: string,
  teachers: Teacher[],
  leaveRequests: LeaveRequest[],
  dayPeriodConfigs: DayPeriodConfig[],
): boolean => {
  const t = teachers.find(t => t.id === teacherId);
  if (isExcludedFromInvigilation(t)) {return true;}

  const datePeriods = resolvePeriodsForDate(dateStr, dayPeriodConfigs);
  const period = datePeriods[periodIdx];
  if (!period) {return false;}

  const request = (leaveRequests || []).find(
    (lr) =>
      lr.teacherId === teacherId &&
      lr.date === dateStr &&
      (lr.status === "APPROVED" || lr.status === "PENDING"),
  );
  if (!request) {return false;}

  if (isSHEHOverride(teacherId, dateStr)) {return false;}

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

// --- Subject detection helpers ---

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

// --- Firestore helper ---

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

// --- UI className constants ---

export const INPUT_CLASS = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none";
export const TH_CLASS = "px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none";
