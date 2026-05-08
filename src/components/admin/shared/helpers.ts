import { Teacher, TimetableEntry } from "../../../types";
import { getCycleForDate, FAL_SUBJECTS } from "../../../constants";
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
