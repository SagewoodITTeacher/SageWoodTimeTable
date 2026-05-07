import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Teacher,
  Assignment,
  Subject,
  TeacherTimetable,
  LeaveRequest,
  TimetableEntry,
  Venue,
  PeriodConfig,
  DayPeriodConfig,
} from "../types";
import { useSessions } from "../hooks/useSessions";
import { useAssignments } from "../hooks/useAssignments";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useTimetableEntries } from "../hooks/useTimetableEntries";
import { useVenues } from "../hooks/useVenues";
import { useSubjects } from "../hooks/useSubjects";
import { useDayPeriodConfigs } from "../hooks/useDayPeriodConfigs";
import { db, handleFirestoreError, OperationType } from "../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import {
  PERIODS,
  WEDNESDAY_PERIODS,
  DAYS,
  SHORT_DAYS,
  getCycleForDate,
  getCurrentPeriodIndex,
  normalizeSubjectName,
  FAL_SUBJECTS,
  SPECIAL_CIRCUMSTANCE_SUBJECTS,
} from "../constants";
import {
  Users,
  Home,
  Calendar,
  Clock,
  MapPin,
  Search,
  Plus,
  Check,
  ArrowUpRight,
  Download,
  BookOpen,
  X,
  Save,
  Trash2,
  Circle,
  UserPlus,
  Database,
  Edit2,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Coffee,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CalendarOff,
  ClipboardCheck,
  CalendarRange,
  RefreshCw,
  Building2,
  Settings,
  History,
  Clock3,
  FlaskConical,
  School,
  Repeat,
  Zap,
  Lock,
  LockOpen,
  SquareStack,
  ArrowRightCircle,
  Scale,
  Gift,
  Trophy,
  Wand2,
  MoreVertical,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ConfirmDialog, Modal, TabButton, Tabs, useToast } from "./ui";

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  variant?: "default" | "destructive";
  requireTyped?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
} | null;

function ConfirmFromState({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  if (!state) {
    return null;
  }
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
import { INITIAL_TEACHERS } from "../data";
import { motion, AnimatePresence } from "motion/react";

const getTimetableCell = (
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

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  format,
  isWednesday,
  addDays,
  subDays,
  startOfToday,
  parseISO,
  isSameDay,
  eachDayOfInterval,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  endOfMonth,
  getDay,
} from "date-fns";

interface Props {
  user: Teacher;
  teachers: Teacher[];
  lockedDates: string[];
  wideLayout?: boolean;
  onToggleWideLayout?: () => void;
}

const getAssignmentKey = (
  pIdx: number,
  vId: string,
  role: string,
  index: number = 0,
) => {
  return `${pIdx}_${vId}_${role}${index > 0 ? `_${index}` : ""}`;
};

const getEntryTimes = (entry: TimetableEntry, allEntries: TimetableEntry[]) => {
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

const isITSpecialistTeacher = (teacher: Teacher) => {
  return ["FRAN", "JACB", "NORT", "ORMA"].includes(teacher.id);
};

const isLSSpecialistTeacher = (teacher: Teacher) => {
  return ["CHAM", "EZNY", "ORIM", "CPMO", "ENYA"].includes(teacher.id);
};

const isArtSpecialistTeacher = (teacher: Teacher) => {
  return ["SHEH", "SHHU"].includes(teacher.id);
};

const isTeacherRestricted = (teacher: Teacher, subject: string) => {
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

const isTechnicalStaffEligible = (teacher: Teacher, subject: string) => {
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

const isTechnicalSubject = (subject: string) => {
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

type WorkloadBreakdown = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};

function WorkloadBar({
  breakdown,
  assigned,
  target,
  onClick,
}: {
  breakdown: WorkloadBreakdown;
  assigned: number;
  target: number;
  onClick?: () => void;
}) {
  const overload = target > 0 && assigned > target;
  const segments: Array<{ v: number; cls: string; label: string }> = [
    { v: breakdown.morning, cls: "bg-gray-300", label: "Morning" },
    { v: breakdown.afternoon, cls: "bg-gray-500", label: "Afternoon" },
    { v: breakdown.tech, cls: "bg-blue-500", label: "Tech" },
    { v: breakdown.standby, cls: "bg-emerald-500", label: "Standby" },
  ];

  let used = 0;
  const rendered = segments.map((seg) => {
    const raw = target > 0 ? (seg.v / target) * 100 : 0;
    const headroom = Math.max(0, 100 - used);
    const w = Math.max(0, Math.min(raw, headroom));
    used += w;
    return { ...seg, w };
  });

  const overflowPct = overload
    ? Math.min(((assigned - target) / target) * 100, 35)
    : 0;
  const tooltip = onClick
    ? `Morning ${breakdown.morning} · Afternoon ${breakdown.afternoon} · Tech ${breakdown.tech} · Standby ${breakdown.standby} — click to inspect`
    : `Morning ${breakdown.morning} · Afternoon ${breakdown.afternoon} · Tech ${breakdown.tech} · Standby ${breakdown.standby}`;

  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex flex-col gap-1 min-w-[140px] text-left ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity rounded" : ""}`}
      title={tooltip}
      aria-label={onClick ? "Inspect workload details" : undefined}
    >
      <div className="flex items-stretch h-2 rounded-full overflow-hidden bg-gray-100">
        <div className="flex flex-1">
          {rendered.map((s) =>
            s.w > 0 ? (
              <div
                key={s.label}
                className={s.cls}
                style={{ width: `${s.w}%` }}
              />
            ) : null,
          )}
        </div>
        {overload && (
          <div
            className="bg-curro-red"
            style={{ width: `${overflowPct}%`, marginLeft: 1 }}
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] font-mono leading-none">
        <span
          className={`font-black ${overload ? "text-curro-red" : "text-curro-blue"}`}
        >
          {assigned.toLocaleString()}
        </span>
        <span className="text-text-muted">
          / {target.toLocaleString()} min
        </span>
      </div>
    </Wrapper>
  );
}

type OverflowItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function OverflowMenu({
  items,
  danger,
}: {
  items: OverflowItem[];
  danger?: OverflowItem;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-lg transition-colors ${open ? "bg-gray-100 text-text-dark" : "hover:bg-gray-100 text-text-muted hover:text-text-dark"}`}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-text-dark hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-text-muted">{it.icon}</span>
              {it.label}
            </button>
          ))}
          {danger && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  danger.onClick();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                {danger.icon}
                {danger.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type FacultyRowProps = {
  teacher: Teacher;
  hasPendingLeave: boolean;
  currentTeachingGrade: string | number | null;
  assigned: number;
  target: number;
  breakdown: WorkloadBreakdown;
  wideMode?: boolean;
  onUpdate: (id: string, updates: Partial<Teacher>) => void;
  onBreakDuty: () => void;
  onHomeRoom: () => void;
  onLeave: () => void;
  onSubjects: () => void;
  onTimetable: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onInspect?: () => void;
};

const FacultyRow: React.FC<FacultyRowProps> = ({
  teacher: t,
  hasPendingLeave,
  currentTeachingGrade,
  assigned,
  target,
  breakdown,
  wideMode = false,
  onUpdate,
  onBreakDuty,
  onHomeRoom,
  onLeave,
  onSubjects,
  onTimetable,
  onEdit,
  onRemove,
  onInspect,
}) => {
  const isOps = t.invigilationPreference === "OPS";
  const isMarathon = t.invigilationPreference === "MARATHON";
  const isMerikeVanDyk =
    t.firstName.toLowerCase().includes("merike") &&
    t.lastName.toLowerCase().includes("van dyk");
  const hasHall = t.hallPass ?? !isMerikeVanDyk;
  const subjectCode = t.subjects?.[0]?.code;
  const subjectExtra =
    (t.subjects?.length ?? 0) > 1
      ? `+${(t.subjects?.length ?? 0) - 1}`
      : null;

  const cyclePref = () => {
    let next: "SCATTERED" | "MARATHON" | "OPS" = "SCATTERED";
    if (t.invigilationPreference === "SCATTERED") {
      next = "MARATHON";
    } else if (t.invigilationPreference === "MARATHON") {
      next = "OPS";
    } else {
      next = "SCATTERED";
    }
    const updates: Partial<Teacher> = { invigilationPreference: next };
    if (next === "OPS") {
      updates.workloadPercentage = 0;
      updates.canInvigilate = false;
      updates.hallPass = false;
    } else if (t.invigilationPreference === "OPS") {
      updates.workloadPercentage = 100;
      updates.canInvigilate = true;
    }
    onUpdate(t.id, updates);
  };

  return (
    <div
      className={`group p-3 px-4 transition-colors ${
        hasPendingLeave
          ? "bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100/60"
          : isOps
            ? "bg-purple-50/40 hover:bg-purple-50/70"
            : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center font-black text-sm transition-all ${
            isOps
              ? "bg-purple-100 text-purple-700 ring-1 ring-purple-200"
              : "bg-bg-gray text-curro-blue group-hover:bg-curro-blue group-hover:text-white"
          }`}
        >
          {t.lastName[0]}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-sm font-black text-text-dark leading-tight truncate max-w-[260px]">
              {t.firstName} {t.lastName}
            </span>
            {t.hasReward && (
              <Gift className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
            )}
            {subjectCode && (
              <span className="text-[10px] font-black text-curro-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">
                {subjectCode}
                {subjectExtra ? ` ${subjectExtra}` : ""}
              </span>
            )}
            {currentTeachingGrade && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-emerald-100 shrink-0">
                <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                Now Gr {currentTeachingGrade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium min-w-0 flex-wrap leading-none">
            <span className="font-black uppercase tracking-tighter">
              {t.id}
            </span>
            {t.email && (
              <>
                <span className="text-gray-300">·</span>
                <span
                  className="truncate max-w-[140px]"
                  title={t.email}
                >
                  {t.email}
                </span>
              </>
            )}
            {t.homeRoomGrade && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-indigo-600">
                  HR {t.homeRoomGrade}E{t.homeRoomClass}
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span
              className={`font-black uppercase tracking-tighter ${isMarathon ? "text-orange-600" : isOps ? "text-purple-600" : "text-sky-600"}`}
            >
              {t.invigilationPreference || "SCATTERED"}
            </span>
            {(t.breakDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-rose-600 inline-flex items-center gap-0.5">
                  <Coffee className="w-2.5 h-2.5" />
                  BD {t.breakDutyDates?.length}
                </span>
              </>
            )}
            {(t.afternoonDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-amber-600 inline-flex items-center gap-0.5">
                  <Clock3 className="w-2.5 h-2.5" />
                  AD {t.afternoonDutyDates?.length}
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span
              className={`font-black uppercase tracking-tighter inline-flex items-center gap-0.5 ${hasHall ? "text-curro-blue" : "text-curro-red"}`}
            >
              {hasHall ? (
                <ShieldCheck className="w-2.5 h-2.5" />
              ) : (
                <ShieldAlert className="w-2.5 h-2.5" />
              )}
              {hasHall ? "Hall" : "Restricted"}
            </span>
          </div>
        </div>

        <WorkloadBar
          breakdown={breakdown}
          assigned={assigned}
          target={target}
          onClick={onInspect}
        />

        <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-1 rounded border border-gray-100 shrink-0">
          <input
            type="number"
            value={t.workloadPercentage ?? 100}
            onChange={(e) =>
              onUpdate(t.id, {
                workloadPercentage: parseInt(e.target.value) || 0,
              })
            }
            className="w-8 bg-transparent text-[10px] font-black text-curro-blue text-right focus:outline-none focus:ring-1 focus:ring-curro-blue rounded border-none p-0"
            title="Workload weighting %"
          />
          <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
            %
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={cyclePref}
            className={`p-2 rounded-lg transition-all ${
              isMarathon
                ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                : isOps
                  ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                  : "bg-sky-50 text-sky-600 hover:bg-sky-100"
            }`}
            title={`Preference: ${t.invigilationPreference || "SCATTERED"} (click to cycle)`}
            aria-label="Cycle invigilation preference"
          >
            {isMarathon ? (
              <Clock3 className="w-3.5 h-3.5" />
            ) : isOps ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
            title="Edit profile"
            aria-label="Edit profile"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {wideMode ? (
            <>
              <button
                onClick={() => onUpdate(t.id, { hasReward: !t.hasReward })}
                className={`p-2 rounded-lg transition-colors ${t.hasReward ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "hover:bg-amber-50 text-text-muted hover:text-amber-600"}`}
                title={t.hasReward ? "Disable reward" : "Enable reward"}
                aria-label="Toggle reward"
              >
                <Trophy
                  className={`w-3.5 h-3.5 ${t.hasReward ? "fill-amber-400" : ""}`}
                />
              </button>
              <button
                onClick={() => onUpdate(t.id, { hallPass: !hasHall })}
                className={`p-2 rounded-lg transition-colors ${hasHall ? "bg-blue-50 text-curro-blue hover:bg-blue-100" : "bg-red-50 text-curro-red hover:bg-red-100"}`}
                title={hasHall ? "Restrict hall pass" : "Grant hall pass"}
                aria-label="Toggle hall pass"
              >
                {hasHall ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onBreakDuty}
                className={`p-2 rounded-lg transition-colors ${(t.breakDutyDates?.length || 0) > 0 ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "hover:bg-rose-50 text-text-muted hover:text-rose-600"}`}
                title="Break duty dates"
                aria-label="Break duty dates"
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onHomeRoom}
                className={`p-2 rounded-lg transition-colors ${t.homeRoomGrade ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" : "hover:bg-indigo-50 text-text-muted hover:text-indigo-600"}`}
                title="Home room class"
                aria-label="Home room class"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onLeave}
                className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                title="Schedule leave"
                aria-label="Schedule leave"
              >
                <CalendarOff className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onSubjects}
                className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                title="Manage subjects"
                aria-label="Manage subjects"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onTimetable}
                className="p-2 hover:bg-red-50 text-text-muted hover:text-curro-red rounded-lg transition-colors"
                title="Edit timetable"
                aria-label="Edit timetable"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-0.5" />
              <button
                onClick={onRemove}
                className="p-2 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-colors"
                title="Remove staff"
                aria-label="Remove staff"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <OverflowMenu
              items={[
                {
                  label: t.hasReward ? "Disable reward" : "Enable reward",
                  icon: (
                    <Trophy
                      className={`w-3.5 h-3.5 ${t.hasReward ? "text-amber-500 fill-amber-400" : ""}`}
                    />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hasReward: !t.hasReward }),
                },
                {
                  label: hasHall ? "Restrict hall pass" : "Grant hall pass",
                  icon: hasHall ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-curro-blue" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-curro-red" />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hallPass: !hasHall }),
                },
                {
                  label: "Break duty dates",
                  icon: <Coffee className="w-3.5 h-3.5" />,
                  onClick: onBreakDuty,
                },
                {
                  label: "Home room class",
                  icon: <Home className="w-3.5 h-3.5" />,
                  onClick: onHomeRoom,
                },
                {
                  label: "Schedule leave",
                  icon: <CalendarOff className="w-3.5 h-3.5" />,
                  onClick: onLeave,
                },
                {
                  label: "Manage subjects",
                  icon: <BookOpen className="w-3.5 h-3.5" />,
                  onClick: onSubjects,
                },
                {
                  label: "Edit timetable",
                  icon: <Calendar className="w-3.5 h-3.5" />,
                  onClick: onTimetable,
                },
              ]}
              danger={{
                label: "Remove staff",
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: onRemove,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

type DayMinutes = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};

const periodDurationMinutes = (period: { start: string; end: string }) => {
  const [sh, sm] = period.start.split(":").map(Number);
  const [eh, em] = period.end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

const InspectionCalendar: React.FC<{
  teacherId: string;
  entries: TimetableEntry[];
  dayPeriodConfigs: DayPeriodConfig[];
  onPickDate: (dateIso: string) => void;
}> = ({ teacherId, entries, dayPeriodConfigs, onPickDate }) => {
  const dateBuckets = useMemo<Map<string, DayMinutes>>(() => {
    const buckets = new Map<string, DayMinutes>();
    for (const entry of entries) {
      if (!entry.invigilatorAssignments) {
        continue;
      }
      const d = parseISO(entry.date);
      const dayName = format(d, "EEEE");
      const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
      const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
      const datePeriods = dateConfig
        ? dateConfig.periods
        : dayConfig
          ? dayConfig.periods
          : dayName === "Wednesday"
            ? WEDNESDAY_PERIODS
            : PERIODS;
      for (const [key, tId] of Object.entries(entry.invigilatorAssignments)) {
        if (tId !== teacherId) {
          continue;
        }
        const parts = key.split("_");
        const pIdx = parseInt(parts[0]);
        const vId = parts[1];
        const role = parts[2];
        const period = datePeriods[pIdx] || datePeriods[0];
        if (!period) {
          continue;
        }
        const minutes = periodDurationMinutes(period);
        const isTech =
          key.includes("_TECH") ||
          key.includes("_TECHNICAL") ||
          role === "TECH" ||
          role === "TECHNICAL";
        const isStandby =
          vId === "GRADE" || key.includes("_STANDBY") || role === "STANDBY";
        const bucket = buckets.get(entry.date) || {
          morning: 0,
          afternoon: 0,
          tech: 0,
          standby: 0,
        };
        if (isTech) {
          bucket.tech += minutes;
        } else if (isStandby) {
          bucket.standby += minutes;
        } else if (entry.session === "MORNING") {
          bucket.morning += minutes;
        } else {
          bucket.afternoon += minutes;
        }
        buckets.set(entry.date, bucket);
      }
    }
    return buckets;
  }, [entries, teacherId, dayPeriodConfigs]);

  const monthGrids = useMemo(() => {
    if (dateBuckets.size === 0) {
      return [];
    }
    const sortedDates: string[] = [...dateBuckets.keys()].sort();
    const minDate = startOfMonth(parseISO(sortedDates[0]));
    const maxDate = endOfMonth(parseISO(sortedDates[sortedDates.length - 1]));
    const monthsSet = new Set<string>();
    let cursor = minDate;
    while (cursor <= maxDate) {
      monthsSet.add(format(cursor, "yyyy-MM"));
      cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
    }
    return Array.from(monthsSet).map((monthKey) => {
      const anchor = parseISO(`${monthKey}-01`);
      const days = eachDayOfInterval({
        start: startOfMonth(anchor),
        end: endOfMonth(anchor),
      });
      // Pad start so Monday is first column (getDay: 0=Sun..6=Sat)
      const firstDow = getDay(days[0]);
      const leadingBlanks = (firstDow + 6) % 7;
      return {
        monthKey,
        title: format(anchor, "MMMM yyyy"),
        leadingBlanks,
        days,
      };
    });
  }, [dateBuckets]);

  if (dateBuckets.size === 0) {
    return (
      <div className="p-20 text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <CalendarRange className="w-8 h-8 text-gray-300" />
        </div>
        <h4 className="text-lg font-black text-text-dark uppercase tracking-tight">
          No assignments yet
        </h4>
        <p className="text-text-muted text-xs font-medium max-w-xs mx-auto mt-2 leading-relaxed">
          This teacher has no invigilation assignments. Check back once the
          scheduler has run.
        </p>
      </div>
    );
  }

  const today = startOfToday();
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-6 overflow-y-auto max-h-[calc(100vh-22rem)] min-h-[500px]">
      <div className="flex items-center gap-4 mb-4 text-[10px] font-black text-text-muted uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-curro-blue" /> Morning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500" /> Afternoon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-curro-red" /> Tech
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500" /> Standby
        </span>
        <span className="ml-2 text-text-muted">Numbers are minutes assigned</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {monthGrids.map((m) => (
          <div
            key={m.monthKey}
            className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm"
          >
            <h4 className="text-sm font-black text-text-dark uppercase tracking-tight mb-3">
              {m.title}
            </h4>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDayLabels.map((d) => (
                <div
                  key={d}
                  className="text-[9px] font-black text-text-muted uppercase tracking-widest text-center py-1"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: m.leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {m.days.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                const bucket = dateBuckets.get(iso);
                const isToday = isSameDay(d, today);
                if (!bucket) {
                  return (
                    <div
                      key={iso}
                      className={`min-h-[64px] rounded-lg flex items-center justify-center text-[11px] font-bold text-gray-300 ${isToday ? "ring-1 ring-curro-blue/40" : ""}`}
                    >
                      {format(d, "d")}
                    </div>
                  );
                }
                const total =
                  bucket.morning +
                  bucket.afternoon +
                  bucket.tech +
                  bucket.standby;
                return (
                  <button
                    key={iso}
                    onClick={() => onPickDate(iso)}
                    className={`min-h-[64px] rounded-lg overflow-hidden bg-white border border-gray-100 hover:border-curro-blue hover:shadow-md transition-all flex flex-col text-left ${isToday ? "ring-2 ring-curro-blue" : ""}`}
                    title={`${format(d, "EEEE d MMM")} — Morning ${bucket.morning} min · Afternoon ${bucket.afternoon} min · Tech ${bucket.tech} min · Standby ${bucket.standby} min · Total ${total} min`}
                  >
                    <div className="flex items-center justify-between px-1 pt-0.5">
                      <span className="text-[11px] font-black text-text-dark leading-none">
                        {format(d, "d")}
                      </span>
                      <span className="text-[8px] font-black text-text-muted leading-none">
                        {total}m
                      </span>
                    </div>
                    <div className="grid grid-cols-2 grid-rows-2 flex-1 gap-px mt-0.5 bg-gray-100">
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.morning > 0 ? "bg-curro-blue text-white" : "bg-blue-50 text-blue-200"}`}
                        title={`Morning: ${bucket.morning} min`}
                      >
                        {bucket.morning || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.afternoon > 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-200"}`}
                        title={`Afternoon: ${bucket.afternoon} min`}
                      >
                        {bucket.afternoon || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.tech > 0 ? "bg-curro-red text-white" : "bg-red-50 text-red-200"}`}
                        title={`Tech: ${bucket.tech} min`}
                      >
                        {bucket.tech || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.standby > 0 ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-200"}`}
                        title={`Standby: ${bucket.standby} min`}
                      >
                        {bucket.standby || ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AdminPanel({
  user: activeUser,
  teachers,
  lockedDates,
  wideLayout = false,
  onToggleWideLayout,
}: Props) {
  const { data: sessions } = useSessions();
  const { data: assignments } = useAssignments();
  const { data: leaveRequests } = useLeaveRequests();
  const { data: entries } = useTimetableEntries();
  const { data: venues } = useVenues();
  const { data: subjects } = useSubjects();
  const { data: dayPeriodConfigs } = useDayPeriodConfigs();
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

  const getPeriodsForDate = (dateStr: string) => {
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
  ) => {
    const t = teachers.find(t => t.id === teacherId);
    if (t) {
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      if (name.includes("merike") && name.includes("van dyk")) {return true;}
    }

    const datePeriods = (() => {
        const dateConfig = dayPeriodConfigs.find((c) => c.id === dateStr);
        const d = parseISO(dateStr);
        const dayName = format(d, "EEEE");
        const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
        if (dateConfig && dateConfig.periods) {return dateConfig.periods;}
        if (dayConfig && dayConfig.periods) {return dayConfig.periods;}
        return dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS;
    })();

    const period = datePeriods[periodIdx];
    if (!period) {return false;}

    const request = (leaveRequests || []).find(
      (lr) =>
        lr.teacherId === teacherId &&
        lr.date === dateStr &&
        (lr.status === "APPROVED" || lr.status === "PENDING"),
    );
    if (!request) {return false;}

    if (teacherId === "SHEH" && (dateStr === "2026-06-18" || dateStr === "2026-06-19")) {
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
    return entries.some(
      (e) =>
        e.date === targetDate &&
        e.grade === grade &&
        e.invigilatorAssignments &&
        Object.keys(e.invigilatorAssignments).some((k) =>
          k.startsWith(`${periodIdx}_`),
        ) &&
        Object.values(e.invigilatorAssignments).includes(teacher.id),
    );
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
    if (hasIncompleteVenues) {return;}
    setIsGenerating(true);
    setGenProgress(0);
    setRepackCount(0);
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
      const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
      const localTeachers = teachers.filter((t) => {
        const name = `${t.firstName} ${t.lastName}`.toLowerCase();
        const isMerike = name.includes("merike") && name.includes("van dyk");
        const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
        const isFranz = t.id === "NORT" || t.id === "FRAN" || name.includes("franz") || name.includes("nortje");
        return (
          t.invigilationPreference !== "OPS" &&
          (t.activeRole !== "WEBMASTER" || isSpec || isFranz) &&
          (t.canInvigilate !== false || isSpec || isFranz) &&
          !isMerike
        );
      });
      
      const uniqueEntryDates = new Set(entries.filter(e => {
        const d = parseISO(e.date);
        return !isBefore(d, startDate) && !isAfter(d, endDate);
      }).map(e => e.date));
      const totalDays = uniqueEntryDates.size || 1;
      const activeInvigilatorCount = localTeachers.length || 36;
      
      // Calculate Total Required Minutes in range to set fair quotas
      let totalReqMinutes = 0;
      entries.forEach(e => {
        const eDate = parseISO(e.date);
        if (isBefore(eDate, startDate) || isAfter(eDate, endDate)) {return;}
        const relevantPIdxs = getRelevantPeriodsIdx(e.session, e.durationMinutes || 180, e);
        const assignedVenuesList = venues.filter((v) => e.venueIds?.includes(v.id));
        const datePeriods = getPeriodsForDate(e.date);
        
        relevantPIdxs.forEach(pIdx => {
          const p = datePeriods[pIdx];
          if (!p) {return;}
          const [h1, m1] = p.start.split(":").map(Number);
          const [h2, m2] = p.end.split(":").map(Number);
          const dur = (h2 * 60 + m2 - (h1 * 60 + m1));
          
          // Standby
          totalReqMinutes += dur;
          // Invigilators
          assignedVenuesList.forEach(venue => {
            const invCount = (venue.name?.toLowerCase().includes("hall") || venue.type === "Hall") 
              ? (e.grade === 12 ? Math.ceil((e.totalStudents || 0) / 30) || 1 : Math.ceil((e.totalStudents || 0) / 25) || 1)
              : 1;
            totalReqMinutes += dur * invCount;
          });
        });
      });

      const totalWorkloadUnits = localTeachers.reduce((sum, t) => sum + (t.workloadPercentage || 100) / 100, 0);
      const standardMinutesPerUnit = (totalReqMinutes / totalDays) / activeInvigilatorCount;
      const teacherRangeTargets = Object.fromEntries(localTeachers.map(t => [t.id, (standardMinutesPerUnit * (t.workloadPercentage || 100) / 100) / 60]));

      const teacherHours = Object.fromEntries(localTeachers.map(t => [t.id, 0]));
      const standbyCounts = Object.fromEntries(localTeachers.map(t => [t.id, 0]));
      const teacherHoursInRange = Object.fromEntries(localTeachers.map(t => [t.id, 0]));
      
      entries.forEach(e => {
        if (!e.invigilatorAssignments) {return;}
        const eDate = parseISO(e.date);
        const inRange = !isBefore(eDate, startDate) && !isAfter(eDate, endDate);
        const datePeriods = getPeriodsForDate(e.date);
        
        Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
          if (teacherHours[tid] === undefined) {return;}
          
          const isTech = key.includes("_TECH_");
          if (!inRange || isTech) {
            const pIdx = parseInt(key.split("_")[0]);
            const period = datePeriods[pIdx];
            if (period) {
              const [h1, m1] = period.start.split(":").map(Number);
              const [h2, m2] = period.end.split(":").map(Number);
              const pDuration = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
              teacherHours[tid] += pDuration;
            }
          }
          
          if (key.includes("_STANDBY_") && !inRange) {
            standbyCounts[tid]++;
          }
        });
      });

      const studentCountsPerDay: Record<string, number> = {};
      entries.forEach(e => {
        studentCountsPerDay[e.date] = (studentCountsPerDay[e.date] || 0) + (e.totalStudents || 0);
      });

      const entryDatesSortedByLearners = Array.from(uniqueEntryDates).sort((a, b) => 
        (studentCountsPerDay[a] || 0) - (studentCountsPerDay[b] || 0)
      );

      const rewardDays: Record<string, string> = {};
      localTeachers.filter(t => t.hasReward).forEach((t, idx) => {
        // Distribute reward days across the letest learner days
        const dayIdx = idx % Math.max(1, Math.min(3, entryDatesSortedByLearners.length));
        rewardDays[t.id] = entryDatesSortedByLearners[dayIdx];
      });

      const assignedOnPrevDay = new Set<string>();
      for (let dayIdx = 0; dayIdx < daysInRange.length; dayIdx++) {
        const day = daysInRange[dayIdx];
        const dateStr = format(day, "yyyy-MM-dd");
        setGenProgress(Math.floor((dayIdx / daysInRange.length) * 100));

        let success = false;
        let dayRepacks = 0;
        const MAX_DAY_REPACKS = 100;

        const hoursSnapshot = { ...teacherHours };
        const standbySnapshot = { ...standbyCounts };
        const rangeHoursSnapshot = { ...teacherHoursInRange };

        while (!success && dayRepacks < MAX_DAY_REPACKS) {
          if (dayRepacks > 0) {setRepackCount(prev => prev + 1);}
          
          const assignedAsTechToday = new Set<string>();
          const dayAssignments: { [tId: string]: { [pIdx: number]: string } } = {};
          const dayEntries = entries
            .filter((e) => e.date === dateStr)
            .sort((a, b) => b.grade - a.grade);

          const grade12SubjectsToday = Array.from(new Set(dayEntries
            .filter(e => e.grade === 12)
            .map(e => e.subject)));

          dayEntries.forEach(e => {
            if ((e.date === "2026-06-18" || e.date === "2026-06-19") && e.subject.toLowerCase().includes("visual art")) {
              const pIdxs = getRelevantPeriodsIdx(e.session, e.durationMinutes || 180, e);
              if (!e.invigilatorAssignments) {e.invigilatorAssignments = {};}
              pIdxs.forEach(p => {
                const venueId = e.venueIds?.[0] || "MANUAL";
                const key = getAssignmentKey(p, venueId, "TECH", 0);
                e.invigilatorAssignments![key] = "SHEH";
              });
            }
          });

          dayEntries.forEach(e => {
            if (!e.invigilatorAssignments) {e.invigilatorAssignments = {};}
            const isPrac = e.paperType === "Prac";
            if (isPrac) {
              const pIdxs = getRelevantPeriodsIdx(e.session, e.durationMinutes || 180, e);
              const venueId = e.venueIds?.[0] || "MANUAL";
              
              pIdxs.forEach(p => {
                const key = getAssignmentKey(p, venueId, "TECH", 0);
                const currentTid = e.invigilatorAssignments![key];

                if (currentTid) {
                  const t = teachers.find(tx => tx.id === currentTid);
                  if (!t || !isTechnicalStaffEligible(t, e.subject)) {
                    delete e.invigilatorAssignments![key];
                  }
                }

                if (!e.invigilatorAssignments![key]) {
                  const specialist = localTeachers.find(t => 
                    isTechnicalStaffEligible(t, e.subject) && 
                    !dayAssignments[t.id]?.[p] && 
                    !isTeacherOnLeaveAtPeriod(t.id, p, dateStr)
                  );
                  if (specialist) {
                    e.invigilatorAssignments![key] = specialist.id;
                  }
                }

                const finalTid = e.invigilatorAssignments![key];
                if (finalTid) {
                  if (!dayAssignments[finalTid]) {dayAssignments[finalTid] = {};}
                  dayAssignments[finalTid][p] = "TECH";
                  assignedAsTechToday.add(finalTid);
                }
              });
            }
          });

          Object.assign(teacherHours, hoursSnapshot);
          Object.assign(standbyCounts, standbySnapshot);
          Object.assign(teacherHoursInRange, rangeHoursSnapshot);

          let dayFailed = false;

          const stints: { entry: TimetableEntry, venueId: string, pIdxs: number[], role: "INVIGILATOR" | "STANDBY", subIdx?: number }[] = [];
          
          dayEntries.forEach(entry => {
            const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);
            const assignedVenuesList = venues.filter((v) => entry.venueIds?.includes(v.id));
            
            relevantPIdxs.forEach(pIdx => {
              stints.push({ entry, venueId: "GRADE", pIdxs: [pIdx], role: "STANDBY" });
            });

            assignedVenuesList.forEach(venue => {
              const invCount = (venue.name?.toLowerCase().includes("hall") || venue.type === "Hall") 
                ? (entry.grade === 12 ? Math.ceil((entry.totalStudents || 0) / 30) || 1 : Math.ceil((entry.totalStudents || 0) / 25) || 1)
                : 1;
              
              for (let i = 0; i < invCount; i++) {
                const chunkSize = 3;
                if (relevantPIdxs.length > chunkSize) {
                  for (let start = 0; start < relevantPIdxs.length; start += chunkSize) {
                    stints.push({ 
                      entry, 
                      venueId: venue.id, 
                      pIdxs: relevantPIdxs.slice(start, start + chunkSize), 
                      role: "INVIGILATOR", 
                      subIdx: i 
                    });
                  }
                } else {
                  stints.push({ entry, venueId: venue.id, pIdxs: relevantPIdxs, role: "INVIGILATOR", subIdx: i });
                }
              }
            });
          });

          const getSubjectPriority = (subject: string) => {
            const s = (subject || "").toLowerCase();
            if (s.includes("english")) {return 1;}
            if (s.includes("afrikaans") || s.includes("1st additional") || s.includes("additional language")) {return 2;}
            if (s.includes("mathematics") && !s.includes("literacy")) {return 3;}
            if (s.includes("mathematical literacy") || s.includes("math lit")) {return 4;}
            if (s.includes("physical science")) {return 5;}
            if (s.includes("creative arts")) {return 6;}
            if (s.includes("coding") || s.includes("robotics")) {return 7;}
            return 100;
          };

          stints.sort((a, b) => {
            if (a.role !== b.role) {return a.role === "STANDBY" ? 1 : -1;}
            if (a.entry.grade !== b.entry.grade) {return b.entry.grade - a.entry.grade;}
            if (a.role === "INVIGILATOR") {
              const pA = getSubjectPriority(a.entry.subject);
              const pB = getSubjectPriority(b.entry.subject);
              if (pA !== pB) {return pA - pB;}
              const studentsA = a.entry.totalStudents || 0;
              const studentsB = b.entry.totalStudents || 0;
              if (studentsA !== studentsB) {return studentsB - studentsA;}
            }
            return b.pIdxs.length - a.pIdxs.length;
          });

          const localizedAssignments: { [entryId: string]: any } = {};
          dayEntries.forEach(e => {
            localizedAssignments[e.id] = {};
            if (e.invigilatorAssignments) {
              Object.entries(e.invigilatorAssignments).forEach(([k, v]) => {
                if (k.includes("_TECH_")) {localizedAssignments[e.id][k] = v;}
              });
            }
          });

          for (const stint of stints) {
            const { entry, venueId, pIdxs, role, subIdx } = stint;
            const isG12 = entry.grade === 12;

            const candidates = localTeachers
              .filter(t => {
                if (t.invigilationPreference === "OPS") {return false;}
                const tName = `${t.firstName} ${t.lastName}`.toLowerCase();
                const isMerike = tName.includes("merike") && tName.includes("van dyk");
                const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
                const isFranz = t.id === "NORT" || t.id === "FRAN" || tName.includes("franz") || tName.includes("nortje");
                if ((t.activeRole === "WEBMASTER" && !isSpec && !isFranz) || (t.canInvigilate === false && !isSpec && !isFranz) || isMerike) {return false;}
                if (assignedAsTechToday.has(t.id)) {return false;}
                
                if (t.hasReward && rewardDays[t.id] === dateStr && dayRepacks < MAX_DAY_REPACKS * 0.8) {return false;}

                const currentDaySlots = Object.keys(dayAssignments[t.id] || {}).length;
                let daySlotLimit = 3;
                if (dayRepacks > MAX_DAY_REPACKS * 0.95) {daySlotLimit = 4;}
                if (currentDaySlots >= daySlotLimit) {return false;}

                for (const p of pIdxs) {
                  if (dayAssignments[t.id]?.[p]) {return false;}
                  if (isTeacherOnLeaveAtPeriod(t.id, p, dateStr)) {return false;}
                  if (getPeriodsForDate(dateStr)[p]?.break && t.breakDutyDates?.includes(dateStr)) {return false;}
                  if (entry.session === 'AFTERNOON' && t.afternoonDutyDates?.includes(dateStr)) {return false;}
                }

                const isRestricted = isTeacherRestricted(t, entry.subject);
                const isG12SubToday = grade12SubjectsToday.some(s => isTeacherRestricted(t, s));
                
                if (dayRepacks < MAX_DAY_REPACKS * 0.9) {
                  if (isG12 && (isRestricted || isG12SubToday)) {return false;}
                  if (isRestricted) {return false;}
                }
                
                if (dayRepacks < MAX_DAY_REPACKS * 0.95) {
                  for (const p of pIdxs) {
                    if (getPeriodsForDate(dateStr)[p]?.break && t.breakDutyDates?.includes(dateStr)) {return false;}
                    if (entry.session === 'AFTERNOON' && t.afternoonDutyDates?.includes(dateStr)) {return false;}
                  }
                }

                if (day.getDay() === 3 && pIdxs[0] === 0 && t.homeRoomGrade && t.homeRoomGrade !== entry.grade) {return false;}

                if (dayRepacks < MAX_DAY_REPACKS * 0.7) {
                  if (entry.grade !== 12 && venueId !== "Hall" && venueId !== "GRADE" && t.homeRoomClass) {
                    const venue = venues.find(v => v.id === venueId);
                    const vN = venue?.name?.toLowerCase() || "";
                    if (!(vN.includes(`e${t.homeRoomClass}`) || vN.includes(`class ${t.homeRoomClass}`) || (vN.includes(` ${t.homeRoomClass}`) && !vN.includes("grade")))) {return false;}
                  }
                }
                
                if (t.invigilationPreference === "SCATTERED" && pIdxs.length > 0) {
                   const firstP = pIdxs[0];
                   const lastP = pIdxs[pIdxs.length - 1];
                   if (dayAssignments[t.id]?.[firstP - 1] || dayAssignments[t.id]?.[lastP + 1]) {
                     if (dayRepacks < MAX_DAY_REPACKS * 0.6) {return false;}
                   }
                }

                return true;
              })
              .map(t => {
                let score = 10000;
                const currentRelWorkload = (teacherHoursInRange[t.id] || 0) / (teacherRangeTargets[t.id] || 1);
                score -= currentRelWorkload * 50000;
                
                if (role === "STANDBY") {
                  score -= (standbyCounts[t.id] || 0) * 10000;
                } else {
                  if (t.invigilationPreference === "MARATHON") {
                    score += 15000;
                    if (assignedOnPrevDay.has(t.id)) {score += 20000;}
                    const hasVenueAssignment = Object.values(dayAssignments[t.id] || {}).includes(venueId);
                    if (hasVenueAssignment) {score += 40000;}
                    const firstP = pIdxs[0];
                    const lastP = pIdxs[pIdxs.length - 1];
                    if (dayAssignments[t.id]?.[firstP - 1] || dayAssignments[t.id]?.[lastP + 1]) {score += 35000;}
                    const daySessions = Object.keys(dayAssignments[t.id] || {}).length;
                    if (daySessions >= 3) {score -= 60000;}
                  } else {
                    const firstP = pIdxs[0];
                    const lastP = pIdxs[pIdxs.length - 1];
                    const assignedPs = Object.keys(dayAssignments[t.id] || {}).map(Number);
                    if (assignedPs.length > 0) {
                      let minGap = 10;
                      assignedPs.forEach(ps => {
                        const gap = Math.min(Math.abs(firstP - ps), Math.abs(lastP - ps));
                        if (gap < minGap) {minGap = gap;}
                      });
                      score += minGap * 15000; 
                    }
                    if (dayAssignments[t.id]?.[firstP - 1] || dayAssignments[t.id]?.[lastP + 1]) {score -= 50000;}
                  }
                }
                if (t.homeRoomGrade === entry.grade) {score += 5000;}
                score += Math.random() * 2000; 
                return { teacher: t, score };
              })
              .sort((a, b) => b.score - a.score);

            if (candidates.length > 0) {
              const best = candidates[0].teacher;
              pIdxs.forEach(p => {
                const key = role === "STANDBY" ? getAssignmentKey(p, "GRADE", "STANDBY", 0) : getAssignmentKey(p, venueId, "INVIGILATOR", subIdx!);
                localizedAssignments[entry.id][key] = best.id;
                if (!dayAssignments[best.id]) {dayAssignments[best.id] = {};}
                dayAssignments[best.id][p] = venueId;
                const pConf = getPeriodsForDate(dateStr)[p];
                const durHrs = ((parseTime(pConf.end)) - (parseTime(pConf.start))) / 60;
                teacherHours[best.id] = (teacherHours[best.id] || 0) + durHrs;
                teacherHoursInRange[best.id] = (teacherHoursInRange[best.id] || 0) + durHrs;
              });
              if (role === "STANDBY") {standbyCounts[best.id]++;}
            } else if (dayRepacks >= MAX_DAY_REPACKS * 0.5) {
              const backupCandidate = localTeachers
                .filter(t => {
                   const tName = `${t.firstName} ${t.lastName}`.toLowerCase();
                   const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
                   const isFranz = t.id === "NORT" || t.id === "FRAN" || tName.includes("franz") || tName.includes("nortje");
                   if (assignedAsTechToday.has(t.id)) {return false;}
                   for (const p of pIdxs) {
                     if (dayAssignments[t.id]?.[p]) {return false;}
                     if (isTeacherOnLeaveAtPeriod(t.id, p, dateStr)) {return false;}
                   }
                   if (dayRepacks < MAX_DAY_REPACKS * 0.95) {
                     if ((t.activeRole === "WEBMASTER" && !isSpec && !isFranz) || (t.canInvigilate === false && !isSpec && !isFranz)) {return false;}
                   }
                   return true;
                })
                .sort((a, b) => (teacherHoursInRange[a.id] || 0) - (teacherHoursInRange[b.id] || 0))[0];

              if (backupCandidate) {
                pIdxs.forEach(p => {
                  const key = role === "STANDBY" ? getAssignmentKey(p, "GRADE", "STANDBY", 0) : getAssignmentKey(p, venueId, "INVIGILATOR", subIdx!);
                  localizedAssignments[entry.id][key] = backupCandidate.id;
                  if (!dayAssignments[backupCandidate.id]) {dayAssignments[backupCandidate.id] = {};}
                  dayAssignments[backupCandidate.id][p] = venueId;
                  const pConf = getPeriodsForDate(dateStr)[p];
                  const durHrs = (parseTime(pConf.end) - parseTime(pConf.start)) / 60;
                  teacherHours[backupCandidate.id] = (teacherHours[backupCandidate.id] || 0) + durHrs;
                  teacherHoursInRange[backupCandidate.id] = (teacherHoursInRange[backupCandidate.id] || 0) + durHrs;
                });
                if (role === "STANDBY") {standbyCounts[backupCandidate.id]++;}
              } else {
                dayFailed = true;
                break;
              }
            } else {
              dayFailed = true;
            }
          }

          if (!dayFailed) {
            success = true;
            assignedOnPrevDay.clear();
            Object.keys(dayAssignments).forEach(tid => assignedOnPrevDay.add(tid));

            for (const eId in localizedAssignments) {
              const e = entries.find(x => x.id === eId);
              if (e) {
                e.invigilatorAssignments = {
                  ...(e.invigilatorAssignments || {}),
                  ...localizedAssignments[eId]
                };
              }
              await setDoc(doc(db, "timetableEntries", eId), { 
                invigilatorAssignments: localizedAssignments[eId], 
                updatedAt: new Date().toISOString() 
              }, { merge: true });
            }
          } else {
            dayRepacks++;
          }
        }
        if (!success) {
          console.warn(`Could not fill all slots for ${dateStr} after ${MAX_DAY_REPACKS} repacks.`);
        }
      }

      const batch = writeBatch(db);
      localTeachers.forEach(t => {
        if (t.totalHours !== teacherHours[t.id]) {
          batch.update(doc(db, "users", t.uid || t.id), { totalHours: teacherHours[t.id] });
        }
      });
      await batch.commit();

      setGenProgress(100);
      setTimeout(() => setIsGenerating(false), 1000);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "Auto Generation");
    } finally {
      clearInterval(timer);
    }
  };

  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
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
    
    // Helper to yield to main thread
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
      
      const localTeachers = teachers.filter((t) => {
        const name = `${t.firstName} ${t.lastName}`.toLowerCase();
        const isMerike = name.includes("merike") && name.includes("van dyk");
        const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
        const isFranz = t.id === "NORT" || t.id === "FRAN" || name.includes("franz") || name.includes("nortje");
        return (
          t.invigilationPreference !== "OPS" &&
          (t.activeRole !== "WEBMASTER" || isSpec || isFranz) &&
          (t.canInvigilate !== false || isSpec || isFranz) &&
          !isMerike
        );
      });

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

      // Gather [StaffInfo] as requested
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

      // Gather [Timetable] as requested
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

        const eDate = parseISO(dateStr);
        const sCounts = (sessionsMap || getSessionsOnDayMap(currentEntries))[t.id] || {};
        const sessions = sCounts[dateStr] || 0;
        
        if (sessions >= passLimit) {return false;}

        const isAfterJune1 = !isBefore(eDate, parseISO("2026-06-01"));
        if (!isAfterJune1) {
          const isWriting = writingGradesByDate[dateStr]?.some(grade => 
             isAssignedToGradeInPeriod(t, grade, pIdx, dateStr)
          );
          if (!isWriting) {return false;}
        }

        const isWednesdayFirst = isWednesday(eDate) && pIdx === 0;
        if (isWednesdayFirst) {
          if (t.homeRoomGrade) {
            if (t.homeRoomGrade !== entry.grade) {return false;}
          } else {
            if (entry.grade !== 12) {return false;}
          }
        }

        if (t.id === "SHEH" && (dateStr === "2026-06-18" || dateStr === "2026-06-19")) {
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

        if (techTidsToday.has(t.id) && !(role === "TECH" || role === "TECHNICAL")) {return false;}
        if ((role === "TECH" || role === "TECHNICAL") && !isTechnicalStaffEligible(t, entry.subject)) {return false;}

        const s = entry.subject.toLowerCase();
        const isLS = s.includes("life science");
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
            const isAdjacent = assignmentsToday.some(p => Math.abs(p - pIdx) === 1);
            if (isAdjacent) {return false;}
          } else if (t.invigilationPreference === "MARATHON" && assignmentsToday.length > 0) {
            const isAdjacent = assignmentsToday.some(p => Math.abs(p - pIdx) === 1);
            if (!isAdjacent && passLimit < 15) {return false;} 
          }
        }

        if (role === "TECH" || role === "TECHNICAL") {
            const hasOtherInThisSession = currentEntries.some(e2 => 
              e2.date === dateStr && e2.session === entry.session && e2.invigilatorAssignments &&
              Object.entries(e2.invigilatorAssignments).some(([k, tid]) => tid === t.id && !(k.includes("_TECH") || k.includes("_TECHNICAL")))
            );
            if (hasOtherInThisSession) {return false;}
        }

        const isOccupied = currentEntries.some(e => 
          e.date === dateStr && 
          e.invigilatorAssignments &&
          Object.entries(e.invigilatorAssignments).some(([k, tid]) => 
             tid === t.id && parseInt(k.match(/(\d+)/)?.[1] || "-1") === pIdx
          )
        );
        if (isOccupied || isTeacherOnLeaveAtPeriod(t.id, pIdx, dateStr)) {return false;}
        if (respectRestricted && isTeacherRestricted(t, entry.subject || "")) {return false;}

        if (entry.session === "AFTERNOON" && t.afternoonDutyDates?.includes(dateStr)) {return false;}
        
        return true;
      };

      const entriesByDate = localEntries.reduce((acc, e) => {
          if (!acc[e.date]) {acc[e.date] = [];}
          acc[e.date].push(e);
          return acc;
        }, {} as Record<string, TimetableEntry[]>);

      const autoFillUnassigned = async () => {
        let filledCount = 0;
        const currentAssignedMinutes: Record<string, number> = {};
        teachers.forEach(t => currentAssignedMinutes[t.id] = workloadStats?.assignedMinutes?.[t.id] || 0);

        // Basic implementation to satisfy the call and requirements
        const passes = [
          { limit: 3, respectRestricted: true },
          { limit: 4, respectRestricted: true },
          { limit: 3, respectRestricted: false }
        ];

        for (let passIdx = 0; passIdx < passes.length; passIdx++) {
            const pass = passes[passIdx];
            for (const day of daysInRange) {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayEntriesForDate = localEntries.filter(e => e.date === dateStr);
                if (dayEntriesForDate.length === 0) {continue;}

                for (const entry of dayEntriesForDate) {
                    if (!entry.invigilatorAssignments) {entry.invigilatorAssignments = {};}
                    const relevantPIdxs = getRelevantPeriodsIdx(entry.session, entry.durationMinutes || 180, entry);
                    const assignedVenues = venues.filter(v => entry.venueIds?.includes(v.id));

                    for (const venue of assignedVenues) {
                        const count = (venue.name?.toLowerCase().includes("hall") || venue.type === "Hall") 
                             ? (entry.grade === 12 ? Math.ceil((entry.totalStudents || 0) / 30) || 1 : Math.ceil((entry.totalStudents || 0) / 25) || 1)
                             : 1;
                        
                        for (let i = 0; i < count; i++) {
                            for (const p of relevantPIdxs) {
                                const key = getAssignmentKey(p, venue.id, "INVIGILATOR", i);
                                if (!entry.invigilatorAssignments[key]) {
                                    const candidates = localTeachers.filter(t => 
                                        isTeacherEligibleForEqualizeSlot(t, entry, p, "INVIGILATOR", venue.id, pass.limit, pass.respectRestricted, localEntries)
                                    ).sort((a,b) => (currentAssignedMinutes[a.id] || 0) - (currentAssignedMinutes[b.id] || 0));

                                    if (candidates.length > 0) {
                                        entry.invigilatorAssignments[key] = candidates[0].id;
                                        currentAssignedMinutes[candidates[0].id] = (currentAssignedMinutes[candidates[0].id] || 0) + 60; // Approximate
                                        filledCount++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return filledCount;
      };

      await autoFillUnassigned();
      setEqProgress(25);
      
      localEntries.forEach(e => {
        if (!e.invigilatorAssignments) {return;}
        const dateStr = e.date;
        const eDate = parseISO(dateStr);
        if (isBefore(eDate, startDate) || isAfter(eDate, endDate)) {return;}

        Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
           const t = teachers.find(tx => tx.id === tid);
           const name = t ? `${t.firstName} ${t.lastName}`.toLowerCase() : "";
           const isMerike = name.includes("merike") && name.includes("van dyk");
           
           if (isMerike) {
             delete e.invigilatorAssignments![key];
             return;
           }

           const role = key.split("_")[2];
           if (role === "TECH") {
             if (!t || !isTechnicalStaffEligible(t, e.subject)) {
               delete e.invigilatorAssignments![key];
             }
           }
        });

        if ((dateStr === "2026-06-18" || dateStr === "2026-06-19")) {
          if (e.subject.toLowerCase().includes("visual art")) {
            const pIdxs = getRelevantPeriodsIdx(e.session, e.durationMinutes || 180, e);
            const vId = e.venueIds?.[0] || "MANUAL";
            pIdxs.forEach(p => {
               const k = getAssignmentKey(p, vId, "TECH", 0);
               if (e.invigilatorAssignments![k] !== "SHEH") {
                 e.invigilatorAssignments![k] = "SHEH";
               }
            });
          }
          Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
            if (tid === "SHEH") {
              const isArtTech = e.subject.toLowerCase().includes("visual art") && (key.includes("_TECH") || key.includes("_TECHNICAL"));
              if (!isArtTech) {
                delete e.invigilatorAssignments![key];
              }
            }
          });
        }

        const s = e.subject.toLowerCase();
        const isIT = s.includes("information technology") || (s === "it") || s.startsWith("it ");
        const isCAT = s.includes("computer application technology") || (s === "cat") || s.startsWith("cat ");
        const isPrac = e.paperType === "Prac";
        const isP2 = e.paperType?.includes("P2");

        if ((isIT || isCAT) && isPrac) {
            if (isIT) {
                if ((e.totalStudents || 0) > 26) {
                    e.venueIds = ["IT_LAB", "CAT_LAB"];
                } else {
                    e.venueIds = ["IT_LAB"];
                }
            } else if (isCAT) {
                const validVenues = (e.venueIds || []).filter(vid => vid === "IT_LAB" || vid === "CAT_LAB");
                if (validVenues.length === 0) {
                    e.venueIds = ["CAT_LAB"];
                } else {
                    e.venueIds = validVenues;
                }
            }

            const pIdxs = getRelevantPeriodsIdx(e.session, e.durationMinutes || 180, e);
            e.venueIds.forEach(vId => {
                pIdxs.forEach(p => {
                    const k = getAssignmentKey(p, vId, "TECH", 0);
                    if (vId === "IT_LAB") {e.invigilatorAssignments![k] = "FRAN";}
                    if (vId === "CAT_LAB") {e.invigilatorAssignments![k] = "JACB";}
                });
            });
        } else if ((isIT || isCAT) && isP2) {
            Object.keys(e.invigilatorAssignments || {}).forEach(k => {
                if (k.includes("_TECH")) {
                    delete e.invigilatorAssignments![k];
                }
            });
        }
      });

      localEntries.forEach(e => {
        if (!e.invigilatorAssignments) {return;}
        const dateStr = e.date;
        const eDate = parseISO(dateStr);
        if (isBefore(eDate, startDate) || isAfter(eDate, endDate)) {return;}

        const techTidsInSession = new Set();
        localEntries.filter(e2 => e2.date === dateStr && e2.session === e.session).forEach(e2 => {
          if (!e2.invigilatorAssignments) {return;}
          Object.entries(e2.invigilatorAssignments).forEach(([k, tid]) => {
            if (k.includes("_TECH") || k.includes("_TECHNICAL")) {techTidsInSession.add(tid);}
          });
        });

        Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
          const isTechRole = key.includes("_TECH") || key.includes("_TECHNICAL");
          if (!isTechRole && techTidsInSession.has(tid)) {
             delete e.invigilatorAssignments![key];
          }
        });
      });
      updateStageProgress("sanitation", 100);
      setEqProgress(5);
      await yieldToMain();


    } catch (e) {
      console.error(e);
      setIsEqualizing(false);
    } finally {
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
    // Rule: June 1 to June 19, all grades write (Rule 2)
    Object.keys(map).forEach(dateStr => {
      const d = parseISO(dateStr);
      // Month is 0-indexed in JS Date: 5 is June
      if (d.getMonth() === 5 && d.getDate() >= 1 && d.getDate() <= 19) {
        map[dateStr] = [8, 9, 10, 11, 12];
      }
    });
    return map;
  }, [entries]);

  // 3. Workload Calculation
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
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      const isMerike = name.includes("merike") && name.includes("van dyk");
      const isSpec = isITSpecialistTeacher(t) || isLSSpecialistTeacher(t) || isArtSpecialistTeacher(t);
      
      // Franz Nortje (NORT) should always be in the list
      const isFranz = t.id === "NORT" || t.id === "FRAN" || name.includes("franz") || name.includes("nortje");

      if ((t.activeRole === "WEBMASTER" && !isSpec && !isFranz) || (t.canInvigilate === false && !isSpec && !isFranz) || isMerike)
        {return;}

      assignedMinutes[t.id] = 0;
      teacherBreakdown[t.id] = { morning: 0, afternoon: 0, tech: 0, standby: 0 };
      teacherPotentials[t.id] = (t.workloadPercentage ?? 100) * (isSpec ? 0.7 : 1);
    });

    const totalPotentialUnits = Object.values(teacherPotentials).reduce(
      (a, b) => a + b,
      0,
    );

    entries.forEach((entry) => {
      const datePeriods = (() => {
        const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
        if (dateConfig) {return dateConfig.periods;}
        const d = parseISO(entry.date);
        const dayName = format(d, "EEEE");
        const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
        if (dayConfig) {return dayConfig.periods;}
        return dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS;
      })();

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
        const [h1, m1] = period.start.split(":").map(Number);
        const [h2, m2] = period.end.split(":").map(Number);
        const pDuration = h2 * 60 + m2 - (h1 * 60 + m1);

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

          const slots = invCount + (isPrac ? 1 : 0) + 1; // invCount + Tech + Standby
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
              assignedMinutes[tid] += pDuration;
              teacherBreakdown[tid].tech += pDuration;
            }
          }
          // Standby minutes
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
          if ((ids as string[]).length > 1) {totalConflicts++;}
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

          const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
          const d = parseISO(entry.date);
          const dayName = format(d, "EEEE");
          const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
          const datePeriods = dateConfig
            ? dateConfig.periods
            : dayConfig
              ? dayConfig.periods
              : dayName === "Wednesday"
                ? WEDNESDAY_PERIODS
                : PERIODS;
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
        // 1. Date (asc)
        const dComp = a.date.localeCompare(b.date);
        if (dComp !== 0) {return dComp;}
        // 2. Grade (desc - usually 12 down to 8)
        if (a.grade !== b.grade) {return b.grade - a.grade;}
        // 3. Subject (asc)
        const sComp = a.subject.localeCompare(b.subject);
        if (sComp !== 0) {return sComp;}
        // 4. Venue (asc)
        const vComp = a.venueName.localeCompare(b.venueName);
        if (vComp !== 0) {return vComp;}
        // 5. Period Start Time (asc)
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
  const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // Adjust for 0=Mon
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
        try {
          const targetId = teacher.uid || teacher.id;
          await deleteDoc(doc(db, "users", targetId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${teacher.id}`);
        } finally {
          setIsSaving(false);
        }
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
    try {
      const teacher = teachers.find((t) => t.id === teacherId);
      if (!teacher) {return;}
      const targetId = teacher.uid || teacher.id;
      const teacherRef = doc(db, "users", targetId);
      await updateDoc(teacherRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${teacherId}`);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Admin Header omitted or kept? I'll keep it but optimize */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-text-dark tracking-tight leading-tight">
            Admin Control Panel
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest bg-gray-100 inline-block px-2 py-0.5 rounded">
              Institutional Management
            </p>
            <div
              className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${currentCycle === 1 ? "bg-curro-blue/10 text-curro-blue border-blue-200" : "bg-curro-red/10 text-curro-red border-red-200"}`}
            >
              Current Cycle: {currentCycle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleWideLayout && (
            <button
              onClick={onToggleWideLayout}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black border transition-all shadow-sm ${
                wideLayout
                  ? "bg-curro-blue text-white border-curro-blue hover:bg-curro-blue/90"
                  : "bg-white text-text-dark border-gray-200 hover:bg-gray-50"
              }`}
              title={wideLayout ? "Exit wide layout" : "Use full screen width"}
              aria-pressed={wideLayout}
            >
              {wideLayout ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              {wideLayout ? "EXIT WIDE" : "WIDE"}
            </button>
          )}
          {bootstrapStatus === "SUCCESS" ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5" />
              STAFF SYNCED
            </div>
          ) : bootstrapStatus === "ERROR" ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-black border border-red-100">
              <AlertCircle className="w-3.5 h-3.5" />
              SYNC FAILED
            </div>
          ) : (
            <button
              onClick={bootstrapFaculty}
              disabled={isSaving || bootstrapStatus === "LOADING"}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 rounded-lg text-xs font-black text-orange-600 hover:bg-orange-50 transition-all shadow-sm disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              {bootstrapStatus === "LOADING" ? "SYNCING..." : "BOOTSTRAP"}
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-text-dark hover:bg-gray-50 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-curro-blue text-white rounded-lg text-xs font-black shadow-md hover:bg-opacity-90 transition-all">
            <Plus className="w-3.5 h-3.5" />
            NEW SESSION
          </button>
        </div>
      </div>

      {/* Conflict Alert Banner */}
      {workloadStats.totalConflicts > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-curro-red p-6 rounded-[32px] text-white shadow-2xl shadow-red-500/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 -mr-20 -mt-20 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-[24px] flex items-center justify-center shadow-inner">
              <AlertCircle className="w-10 h-10 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-2">
                {workloadStats.totalConflicts} Assignment Conflicts Detected
              </h3>
              <p className="text-sm font-medium opacity-90 max-w-lg leading-relaxed">
                One or more staff members are scheduled for multiple venues at the same time. 
                Please review the red-highlighted entries in the staff assignment view.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab("ASSIGNMENTS")}
            className="bg-white text-curro-red px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-red-50 transition-all active:scale-95 whitespace-nowrap relative z-10"
          >
            Resolve Conflicts
          </button>
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
            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`p-1.5 rounded-lg ${(stat as any).bg} ${stat.color}`}
              >
                <stat.icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black text-text-dark tracking-tighter">
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab Switcher */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        aria-label="Admin sections"
        className="flex-wrap p-1 bg-white border border-gray-100 rounded-2xl w-fit shadow-sm"
      >
        <TabButton value="SUBJECTS" icon={<BookOpen className="w-4 h-4" />}>
          Subjects
        </TabButton>
        <TabButton value="FACULTY" icon={<Users className="w-4 h-4" />}>
          Faculty
        </TabButton>
        <TabButton value="TIMETABLE" icon={<CalendarRange className="w-4 h-4" />}>
          Exam Time Table
        </TabButton>
        <TabButton value="VENUES" icon={<MapPin className="w-4 h-4" />}>
          Venues
        </TabButton>
        <TabButton value="SCHEDULER" icon={<ClipboardCheck className="w-4 h-4" />}>
          Scheduler
        </TabButton>
        <TabButton value="ASSIGNMENTS" icon={<ClipboardCheck className="w-4 h-4" />}>
          Assignments
        </TabButton>
        <TabButton value="INSPECTION" icon={<Search className="w-4 h-4" />}>
          Inspection
        </TabButton>
      </Tabs>

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
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Column: Teachers List */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-14rem)] min-h-[600px] overflow-hidden">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-text-dark uppercase tracking-tight text-xs flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Faculty Members
                  </h3>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="p-1 hover:bg-curro-blue hover:text-white text-curro-blue transition-colors rounded"
                    title="Add Staff"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleFacultyBackup}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-amber-200/50 shadow-sm"
                    title="Backup Faculty Data"
                  >
                    <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">Faculty JSON Backup</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Find staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-curro-blue w-28 md:w-36 transition-all"
                    />
                  </div>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="bg-white border border-gray-100 text-[10px] font-bold rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-curro-blue outline-none transition-all uppercase tracking-tighter"
                  >
                    <option value="ALL">All Subjects</option>
                    {allSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Workload Stats Summary */}
              <div className="bg-curro-blue px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                      Total Slot Minutes Required
                    </span>
                    <span className="text-lg font-black text-white leading-tight">
                      {workloadStats.totalRequired.toLocaleString()} min
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                      Weighting Units
                    </span>
                    <span className="text-lg font-black text-white leading-tight">
                      {workloadStats.totalUnits} %
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                      Min per 100% Load
                    </span>
                    <span className="text-lg font-black text-white leading-tight">
                      {Math.round(workloadStats.minsPerUnit * 100).toLocaleString()} min
                    </span>
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                  <Shield className="w-4 h-4 text-white/80" />
                  <p className="text-[9px] font-bold text-white/90 uppercase tracking-tight max-w-[150px] leading-tight">
                    Load is balanced dynamically across all faculty based on weighting.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {teachers
                  .filter((t) => {
                    const matchesSearch =
                      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      `${t.firstName} ${t.lastName}`
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase());

                    const matchesSubject =
                      selectedSubject === "ALL" ||
                      t.subjects?.some((s) => s.code === selectedSubject);

                    return matchesSearch && matchesSubject;
                  })
                  .sort((a, b) => {
                    const lastA = a.lastName.toLowerCase();
                    const lastB = b.lastName.toLowerCase();
                    if (lastA < lastB) {return -1;}
                    if (lastA > lastB) {return 1;}

                    const firstA = a.firstName.toLowerCase();
                    const firstB = b.firstName.toLowerCase();
                    if (firstA < firstB) {return -1;}
                    if (firstA > firstB) {return 1;}
                    return 0;
                  })
                  .map((t) => {
                    const hasPendingLeave = leaveRequests.some(
                      (l) => l.teacherId === t.id && l.status === "PENDING",
                    );
                    const target = Math.round(
                      (t.workloadPercentage ?? 100) * workloadStats.minsPerUnit,
                    );
                    const breakdown = workloadStats.breakdown[t.id] || {
                      morning: 0,
                      afternoon: 0,
                      tech: 0,
                      standby: 0,
                    };
                    return (
                      <FacultyRow
                        key={t.id}
                        teacher={t}
                        hasPendingLeave={hasPendingLeave}
                        currentTeachingGrade={getTeacherStatus(t)}
                        assigned={workloadStats.assigned[t.id] || 0}
                        target={target}
                        breakdown={breakdown}
                        wideMode={wideLayout}
                        onUpdate={handleUpdateTeacher}
                        onBreakDuty={() => setSelectedTeacherForBreakDuty(t)}
                        onHomeRoom={() => setSelectedTeacherForHomeRoom(t)}
                        onLeave={() => setSelectedTeacherForLeave(t)}
                        onSubjects={() => setSelectedTeacherForSubjects(t)}
                        onTimetable={() => setSelectedTeacherForTimetable(t)}
                        onEdit={() => setSelectedTeacherForEdit(t)}
                        onRemove={() => handleRemoveTeacher(t)}
                        onInspect={() => {
                          setSelectedInspectionTeacherId(t.id);
                          setSelectedInspectionDate(null);
                          setInspectionView("TABLE");
                          setActiveTab("INSPECTION");
                        }}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "ASSIGNMENTS" && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {leaveRequests.some((r) => r.status === "PENDING") && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="px-5 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
                  <h3 className="font-black text-amber-900 uppercase tracking-tight text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Pending Leave Approvals (
                    {leaveRequests.filter((r) => r.status === "PENDING").length}
                    )
                  </h3>
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest bg-amber-200/50 px-2 py-0.5 rounded-full">
                    Requires Action
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {leaveRequests
                    .filter((r) => r.status === "PENDING")
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((req) => {
                      const teacher = teachers.find(
                        (t) => t.id === req.teacherId,
                      );
                      return (
                        <div
                          key={req.id}
                          className="p-4 flex items-center justify-between hover:bg-amber-100/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-700 flex items-center justify-center font-black text-xs">
                              {teacher?.lastName[0] || "?"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-amber-900">
                                {teacher?.firstName} {teacher?.lastName}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-amber-700/60 uppercase tracking-tighter">
                                  {format(parseISO(req.date), "EEE, d MMM")}
                                </span>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-200/40 px-1 rounded uppercase tracking-tighter">
                                  {req.type}
                                </span>
                                {req.reason && (
                                  <span className="text-[8px] font-medium text-amber-800 italic ml-1">
                                    "{req.reason}"
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(
                                    doc(db, "leaveRequests", req.id),
                                    { status: "APPROVED" },
                                  );
                                } catch (e) {
                                  handleFirestoreError(
                                    e,
                                    OperationType.WRITE,
                                    `leaveRequests/${req.id}`,
                                  );
                                }
                              }}
                              className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(
                                    doc(db, "leaveRequests", req.id),
                                    { status: "DENIED" },
                                  );
                                } catch (e) {
                                  handleFirestoreError(
                                    e,
                                    OperationType.WRITE,
                                    `leaveRequests/${req.id}`,
                                  );
                                }
                              }}
                              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-95"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[450px]">
              <div className="px-5 py-4 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between bg-gray-50/50 gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-black text-text-dark uppercase tracking-tight text-xs flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Invigilation Overview
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-200/50 p-1 rounded-xl">
                      <button
                        onClick={() => setAssignmentsSubTab("SUMMARY")}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "SUMMARY" ? "bg-white text-curro-blue shadow-sm" : "text-text-muted hover:text-text-dark"}`}
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => setAssignmentsSubTab("TABLE")}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "TABLE" ? "bg-white text-curro-blue shadow-sm" : "text-text-muted hover:text-text-dark"}`}
                      >
                        Invigilation Table
                      </button>
                    </div>
                    <button
                      onClick={() => setShowStats(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[9px] font-black text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm active:scale-95"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      STATS
                    </button>
                    <button
                      onClick={handleExportAssignmentsCSV}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[9px] font-black text-text-dark hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      EXPORT CSV
                    </button>
                    <button
                      onClick={() => setEnableCheckMode(!enableCheckMode)}
                      className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl text-[9px] font-black transition-all shadow-sm active:scale-95 ${
                        enableCheckMode
                          ? "bg-curro-red text-white border-curro-red"
                          : "bg-white text-text-dark border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {enableCheckMode ? "HIDE CHECK" : "CHECK"}
                    </button>
                    <button
                      onClick={() => handleEqualize(true)}
                      disabled={isEqualizing || isGenerating}
                      className="flex items-center gap-2 px-3 py-1.5 bg-curro-blue text-white border border-curro-blue rounded-xl text-[9px] font-black hover:bg-black transition-all shadow-sm active:scale-95"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      FIX ERRORS
                    </button>
                  </div>
                </div>
                {lastUpdatedDate && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
                    <History className="w-3 h-3 text-curro-blue" />
                    <span className="text-[9px] font-black text-curro-blue uppercase tracking-widest">
                      Last Updated: {format(lastUpdatedDate, "d MMM, HH:mm")}
                    </span>
                  </div>
                )}
              </div>

              {assignmentsSubTab === "SUMMARY" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Date
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Subject
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Time / Session
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Location (Venue)
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Staff (Assigned)
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                    {entries
                      .flatMap((entry) => {
                        const assignedVenues = entry.venueIds || [];
                        if (assignedVenues.length === 0) {
                          return [{ entry, venueId: null }];
                        }
                        return assignedVenues.map((vId) => ({ entry, venueId: vId }));
                      })
                      .sort((a, b) => {
                        // 1. Date (ascending)
                        if (a.entry.date !== b.entry.date) {
                          return a.entry.date.localeCompare(b.entry.date);
                        }
                        // 2. Grade (12, 11, 10, 9, 8 -> descending)
                        if (a.entry.grade !== b.entry.grade) {
                          return b.entry.grade - a.entry.grade;
                        }
                        // 3. Venue (alphabetical)
                        const vA = a.venueId ? (venues.find(v => v.id === a.venueId)?.name || "") : "";
                        const vB = b.venueId ? (venues.find(v => v.id === b.venueId)?.name || "") : "";
                        if (vA !== vB) {
                          return vA.localeCompare(vB);
                        }
                        // 4. Session/Time
                        return (a.entry.session === 'MORNING' ? 0 : 1) - (b.entry.session === 'MORNING' ? 0 : 1);
                      })
                      .map(({ entry, venueId }, idx) => {
                        const venue = venueId ? venues.find((v) => v.id === venueId) : null;
                        const assignedStaffIds = entry.invigilatorAssignments
                          ? Array.from(
                              new Set(
                                Object.entries(entry.invigilatorAssignments)
                                  .filter(([key]) => !venueId || key.includes(venueId))
                                  .map(([_, tid]) => tid),
                              ),
                            )
                          : [];

                        return (
                          <tr
                            key={`${entry.id}-${venueId || idx}`}
                            className="hover:bg-gray-50/30 transition-all group"
                          >
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-text-dark">
                                  {format(parseISO(entry.date), "EEE, d MMM")}
                                </span>
                                <span className="text-[9px] text-text-muted font-bold uppercase tracking-tighter">
                                  {entry.date}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-text-dark leading-tight">
                                  {entry.subject}
                                </span>
                                <span className="text-[10px] text-text-muted font-black uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded w-fit mt-1">
                                  Grade {entry.grade}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-curro-blue tracking-tighter mb-0.5">
                                  {getEntryTimes(entry, entries).start}
                                </span>
                                <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                                  {entry.durationMinutes || 120}m ({entry.paperType})
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {venue ? (
                                <div className="flex items-center gap-1.5 text-text-dark font-black text-[10px] uppercase tracking-tighter">
                                  <MapPin className="w-3.5 h-3.5 text-curro-red" />
                                  {venue.name}
                                </div>
                              ) : (
                                <span className={`text-[9px] font-bold uppercase italic ${venueId === "GRADE" ? "text-blue-600" : "text-amber-600"}`}>
                                  {venueId === "GRADE" ? `Grade ${entry.grade} Standby` : (venueId === "manual" ? "Manual Slot" : "No Venue Set")}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1">
                                {assignedStaffIds.length > 0 ? (
                                  assignedStaffIds.map((tid) => {
                                    const t = teachers.find((t) => t.id === tid);
                                    const hasConflict = conflictMap[tid]?.[entry.date] 
                                      ? Object.values(conflictMap[tid][entry.date] as Record<string, Set<string>>).some(sigs => sigs.size > 1) 
                                      : false;

                                    return (
                                      <div
                                        key={tid}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter border transition-all ${
                                          hasConflict 
                                            ? "bg-curro-red text-white border-curro-red animate-pulse scale-110 shadow-lg" 
                                            : "bg-gray-100 text-text-dark border-gray-200"
                                        }`}
                                        title={t ? `${t.firstName} ${t.lastName}${hasConflict ? ' (CONFLICT DETECTED)' : ''}` : tid}
                                      >
                                        {t ? `${t.firstName[0]}${t.lastName[0]}` : tid}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-[9px] text-text-muted opacity-50 uppercase font-bold italic">
                                    Unassigned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => setActiveTab("SCHEDULER")}
                                className="text-curro-blue font-black text-[9px] uppercase tracking-widest hover:bg-curro-blue hover:text-white px-2 py-1.5 rounded-lg border border-blue-100 transition-all active:scale-95 bg-blue-50/50"
                              >
                                {assignedStaffIds.length > 0 ? "EDIT" : "SCHEDULE"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Date
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Grade & Subject
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Venue
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Period Slot
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Invigilator
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Role
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Exam Start
                        </th>
                        <th className="px-5 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                          Exam End
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {entries
                        .flatMap((entry) => {
                          const assignments = entry.invigilatorAssignments || {};
                          return Object.entries(assignments).map(([key, teacherId]) => {
                            const parts = key.split("_");
                            const pIdx = parseInt(parts[0]);
                            const vId = parts[1];
                            const teacher = teachers.find(t => t.id === teacherId);
                            const venue = venues.find(v => v.id === vId);
                            
                            const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
                            const d = parseISO(entry.date);
                            const dayName = format(d, "EEEE");
                            const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
                            const datePeriods = dateConfig ? dateConfig.periods : (dayConfig ? dayConfig.periods : (dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS));
                            const period = datePeriods[pIdx];

                            const { start: startStr, end: endTimeStr } = getEntryTimes(entry, entries);

                            return {
                              date: entry.date,
                              grade: entry.grade,
                              subject: entry.subject,
                              venueName: venue?.name || vId || "Unknown",
                              periodLabel: period?.label || `P${pIdx + 1}`,
                              periodTime: period ? `${period.start} - ${period.end}` : "",
                              periodStart: period?.start || "00:00",
                              invigilator: teacher ? `${teacher.firstName} ${teacher.lastName}` : (teacherId === "REMAINDER_OF_DAY_BUSY" ? "Specialist Prep" : teacherId),
                              role: teacher?.invigilationPreference || "SCATTERED",
                              examStart: startStr,
                              examEnd: endTimeStr,
                              id: `${entry.id}_${key}`,
                              teacherId,
                              pIdx
                            };
                          });
                        })
                        .sort((a, b) => {
                          // 1. Date (asc)
                          const dComp = a.date.localeCompare(b.date);
                          if (dComp !== 0) {return dComp;}
                          // 2. Grade (desc)
                          if (a.grade !== b.grade) {return b.grade - a.grade;}
                          // 3. Subject (asc)
                          const sComp = a.subject.localeCompare(b.subject);
                          if (sComp !== 0) {return sComp;}
                          // 4. Venue (asc)
                          const vComp = a.venueName.localeCompare(b.venueName);
                          if (vComp !== 0) {return vComp;}
                          // 5. Period Start Time (asc)
                          return a.periodStart.localeCompare(b.periodStart);
                        })
                        .map((row) => {
                          const isScattered = row.role === 'SCATTERED';
                          const isMarathon = row.role === 'MARATHON';
                          const isOPS = row.role === 'OPS';

                          const teacher = teachers.find(t => t.id === row.teacherId);
                          let isError = false;
                          let isWarning = false;

                          if (enableCheckMode && teacher) {
                            const activity = getTimetableCell(teacher, row.pIdx, row.date);
                            if (activity && activity.trim().length > 0) {
                              isError = true;
                            } else if (isScattered) {
                              const dayMap = conflictMap[teacher.id]?.[row.date] || {};
                              const assignedPIdxs = Object.keys(dayMap).map(Number);
                              if (assignedPIdxs.includes(row.pIdx - 1) || assignedPIdxs.includes(row.pIdx + 1)) {
                                isWarning = true;
                              }
                            }
                          }

                          const isDarkBg = isOPS || isError || isWarning;

                          let bgClass = "hover:bg-gray-50/50";
                          if (isError) {bgClass = "bg-red-600 text-white animate-pulse shadow-lg z-10 relative";}
                          else if (isWarning) {bgClass = "bg-orange-500 text-white shadow-inner";}
                          else if (isOPS) {bgClass = "bg-curro-red text-white";}
                          else if (isScattered) {bgClass = "bg-cyan-100/80";}
                          else if (isMarathon) {bgClass = "bg-rose-100/80";}

                          return (
                            <tr key={row.id} className={`${bgClass} transition-all duration-300 border-b border-gray-100/50`}>
                              <td className="px-5 py-4 text-[10px] font-bold">
                                {format(parseISO(row.date), "EEE, d MMM")}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-black uppercase tracking-tighter ${isDarkBg ? 'text-white' : 'text-curro-blue'}`}>
                                    Grade {row.grade}
                                  </span>
                                  <span className="text-[9px] font-bold uppercase">
                                    {row.subject}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-[10px] font-bold">
                                {row.venueName}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className={`text-[10px] font-black uppercase ${isDarkBg ? 'text-white' : 'text-emerald-600'}`}>
                                    {row.periodLabel}
                                  </span>
                                  <span className={`text-[8px] font-mono font-bold ${isDarkBg ? 'text-white/80' : 'text-text-muted'}`}>
                                    {row.periodTime}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-[10px] font-bold flex items-center gap-2">
                                {row.invigilator}
                                {isError && <ShieldAlert className="w-3 h-3 text-white" />}
                                {isWarning && <Zap className="w-3 h-3 text-white" />}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                  isDarkBg ? 'bg-white/20 text-white border-white/30' :
                                  isScattered ? 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30' :
                                  'bg-rose-500/20 text-rose-700 border-rose-500/30'
                                }`}>
                                  {row.role}
                                </span>
                              </td>
                              <td className={`px-5 py-4 text-[10px] font-mono font-bold ${isDarkBg ? 'text-white' : 'text-amber-600'}`}>
                                {row.examStart}
                              </td>
                              <td className={`px-5 py-4 text-[10px] font-mono font-bold ${isDarkBg ? 'text-white' : ''}`}>
                                {row.examEnd}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rewards Section */}
            <div className="bg-curro-blue rounded-xl p-6 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-8 opacity-10 group-hover:scale-125 transition-transform group-hover:-rotate-12">
                <ArrowUpRight className="w-32 h-32" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-md">
                  <h4 className="text-xl font-black mb-1 flex items-center gap-2">
                    Staff Load Balancer
                    <div className="w-2 h-2 rounded-full bg-curro-red animate-pulse" />
                  </h4>
                  <p className="text-white/70 font-bold text-[10px] uppercase tracking-widest">
                    Autonomous Reward Distribution System
                  </p>
                </div>
                <button className="bg-white text-curro-blue px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg active:scale-95">
                  GENERATE REPORT
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "TIMETABLE" && (
          <ExamTimetableTab
            date={timetableDate}
            setDate={setTimetableDate}
            entries={entries}
            teachers={teachers}
            venues={venues}
            isSaving={isSaving}
            allSubjectsList={subjects}
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
          />
        )}

        {activeTab === "INSPECTION" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden mb-8">
              <div className="bg-curro-blue p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-blue-800">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                    <Search className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">Staff Inspection</h3>
                    <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Detailed Invigilation Audit & Load Summary</p>
                  </div>
                </div>
                                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-widest px-1">Select Faculty Member</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedInspectionTeacherId && (() => {
                      const teacher = teachers.find(t => t.id === selectedInspectionTeacherId);
                      if (!teacher) {return null;}

                      // Pre-calculate assignments for duplicate check in header
                      const teacherAssignments = entries.flatMap((entry) => {
                        if (!entry.invigilatorAssignments) {return [];}
                        const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
                        const d = parseISO(entry.date);
                        const dayName = format(d, "EEEE");
                        const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
                        const datePeriods = dateConfig ? dateConfig.periods : (dayConfig ? dayConfig.periods : (dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS));

                        return Object.entries(entry.invigilatorAssignments)
                          .filter(([_, tId]) => tId === selectedInspectionTeacherId)
                          .map(([key, _]) => {
                            const pIdx = parseInt(key.split("_")[0]);
                            const period = datePeriods[pIdx] || (datePeriods.length > 0 ? datePeriods[0] : null);
                            if (!period) {return null;}
                            return { date: entry.date, start: period.start, end: period.end, subject: entry.subject, paperType: entry.paperType, eid: entry.id, key };
                          }).filter(Boolean);
                      });

                      const duplicateTags = new Map<string, number>();
                      teacherAssignments.forEach(ta => {
                        const tag = `${ta!.date}|${ta!.start}|${ta!.end}|${ta!.subject}|${ta!.paperType}`;
                        duplicateTags.set(tag, (duplicateTags.get(tag) || 0) + 1);
                      });
                      const hasDuplicates = Array.from(duplicateTags.values()).some(v => v > 1);

                      return (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                          {teacher.hallPass && (
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-widest rounded border border-amber-500/30 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> [Hall Pass]
                            </span>
                          )}
                          <span className={`px-2 py-1 ${teacher.invigilationPreference === 'SCATTERED' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : teacher.invigilationPreference === 'OPS' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} text-[9px] font-black uppercase tracking-widest rounded border flex items-center gap-1`}>
                            {teacher.invigilationPreference === 'SCATTERED' ? <Zap className="w-3 h-3" /> : teacher.invigilationPreference === 'OPS' ? <ShieldCheck className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                            {teacher.invigilationPreference || 'SCATTERED'}
                          </span>
                          
                          {teacher.invigilationPreference === 'OPS' && teacherAssignments.length > 0 && (
                            <span className="px-2 py-1 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded shadow-lg animate-pulse flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> [Duty Violation: OPS Staff]
                            </span>
                          )}
                          
                          {hasDuplicates && (
                            <button
                              onClick={() => setConfirmState({
                                open: true,
                                title: "Remove duplicate assignments",
                                message: "Remove all exact time/subject duplicates for this teacher?",
                                variant: "destructive",
                                confirmLabel: "Remove",
                                onConfirm: async () => {
                                  setIsSaving(true);
                                  try {
                                    const toDelete: { eid: string; key: string }[] = [];
                                    const seenTags = new Set<string>();
                                    teacherAssignments.forEach(ta => {
                                      const tag = `${ta!.date}|${ta!.start}|${ta!.end}|${ta!.subject}|${ta!.paperType}`;
                                      if (seenTags.has(tag)) {toDelete.push({ eid: ta!.eid, key: ta!.key });}
                                      else {seenTags.add(tag);}
                                    });
                                    const batch = writeBatch(db);
                                    const byEntry: { [eid: string]: any } = {};
                                    for (const item of toDelete) {
                                      if (!byEntry[item.eid]) {
                                        const entry = entries.find(e => e.id === item.eid);
                                        if (entry) {byEntry[item.eid] = { ...entry.invigilatorAssignments };}
                                      }
                                      if (byEntry[item.eid]) {delete byEntry[item.eid][item.key];}
                                    }
                                    for (const [eid, newAss] of Object.entries(byEntry)) {
                                      batch.update(doc(db, "entries", eid), { invigilatorAssignments: newAss });
                                    }
                                    await batch.commit();
                                  } catch (err) {
                                    handleFirestoreError(err, OperationType.UPDATE, "entries");
                                  } finally {
                                    setIsSaving(false);
                                  }
                                },
                              })}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded shadow-sm flex items-center gap-1 transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Remove Duplicates
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <select
                      value={selectedInspectionTeacherId}
                      onChange={(e) => setSelectedInspectionTeacherId(e.target.value)}
                      className="min-w-[250px] bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-black text-xs uppercase tracking-widest focus:bg-white focus:text-curro-blue outline-none transition-all cursor-pointer"
                    >
                      <option value="" className="text-gray-400">--- Choose Teacher ---</option>
                      {teachers
                        .sort((a, b) => a.lastName.localeCompare(b.lastName))
                        .map((t) => (
                          <option key={t.id} value={t.id} className="text-text-dark">
                            {t.lastName}, {t.firstName} ({t.id})
                          </option>
                        ))}
                    </select>
                    {selectedInspectionTeacherId && (
                      <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-xl p-1">
                        <button
                          onClick={() => setInspectionView("TABLE")}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            inspectionView === "TABLE"
                              ? "bg-white text-curro-blue shadow"
                              : "text-white/80 hover:text-white"
                          }`}
                          title="Table view"
                        >
                          <ClipboardCheck className="w-3 h-3" /> Table
                        </button>
                        <button
                          onClick={() => {
                            setInspectionView("CALENDAR");
                            setSelectedInspectionDate(null);
                          }}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                            inspectionView === "CALENDAR"
                              ? "bg-white text-curro-blue shadow"
                              : "text-white/80 hover:text-white"
                          }`}
                          title="Calendar view"
                        >
                          <CalendarRange className="w-3 h-3" /> Calendar
                        </button>
                      </div>
                    )}
                    {selectedInspectionTeacherId &&
                      inspectionView === "TABLE" &&
                      selectedInspectionDate && (
                        <button
                          onClick={() => setSelectedInspectionDate(null)}
                          className="px-3 py-2 bg-amber-500/90 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow"
                          title="Show all dates"
                        >
                          <X className="w-3 h-3" /> Show all dates
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {!selectedInspectionTeacherId ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-gray-300" />
                  </div>
                  <h4 className="text-lg font-black text-text-dark uppercase tracking-tight">Access Staff Logs</h4>
                  <p className="text-text-muted text-xs font-medium max-w-xs mx-auto mt-2 leading-relaxed">
                    Please select a teacher from the dropdown above to view their complete invigilation history and session breakdown.
                  </p>
                </div>
              ) : inspectionView === "CALENDAR" ? (
                <InspectionCalendar
                  teacherId={selectedInspectionTeacherId}
                  entries={entries}
                  dayPeriodConfigs={dayPeriodConfigs}
                  onPickDate={(d) => {
                    setSelectedInspectionDate(d);
                    setInspectionView("TABLE");
                  }}
                />
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-22rem)] min-h-[500px] scrollbar-thin scrollbar-thumb-gray-200">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Date</th>
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Start Time</th>
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">End Time</th>
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Subject</th>
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Paper Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Venue</th>
                        <th className="px-6 py-4 text-[10px] font-black text-curro-blue uppercase tracking-[0.2em] text-center bg-blue-50/50">Morning (Min)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] text-center bg-emerald-50/50">Afternoon (Min)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] text-center bg-amber-50/50">Stand-By (Min)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-curro-red uppercase tracking-[0.2em] text-center bg-red-50/50">TECH (Min)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(() => {
                        const teacherAssignments = entries.flatMap((entry) => {
                          if (!entry.invigilatorAssignments) {return [];}
                          
                          const dateConfig = dayPeriodConfigs.find((c) => c.id === entry.date);
                          const d = parseISO(entry.date);
                          const dayName = format(d, "EEEE");
                          const dayConfig = dayPeriodConfigs.find((c) => c.id === dayName);
                          const datePeriods = dateConfig ? dateConfig.periods : (dayConfig ? dayConfig.periods : (dayName === "Wednesday" ? WEDNESDAY_PERIODS : PERIODS));

                          return Object.entries(entry.invigilatorAssignments)
                            .filter(([key, tId]) => {
                              if (tId !== selectedInspectionTeacherId) {return false;}
                              return true;
                            })
                            .map(([key, _]) => {
                              const parts = key.split("_");
                              const pIdx = parseInt(parts[0]);
                              const vId = parts[1];
                              const role = parts[2];
                              
                              const period = datePeriods[pIdx] || (datePeriods.length > 0 ? datePeriods[0] : null);
                              if (!period) {return null;}

                              const venue = venues.find(v => v.id === vId);
                              const durationMinutes = period 
                                ? ((parseInt(period.end.split(":")[0]) * 60 + parseInt(period.end.split(":")[1])) - (parseInt(period.start.split(":")[0]) * 60 + parseInt(period.start.split(":")[1])))
                                : 0;

                              const isTech = key.includes("_TECH") || key.includes("_TECHNICAL") || role === "TECH" || role === "TECHNICAL";
                              const isStandby = vId === "GRADE" || key.includes("_STANDBY") || role === "STANDBY";

                              return {
                                entryId: entry.id,
                                assignmentKey: key,
                                date: entry.date,
                                startTime: period.start,
                                endTime: period.end,
                                subject: entry.subject,
                                paperType: entry.paperType,
                                grade: entry.grade,
                                venueName: venue?.name || (vId === "GRADE" ? "Grade Standby" : (isTech ? "Tech Support" : vId)),
                                morningMin: !isStandby && !isTech && entry.session === "MORNING" ? durationMinutes : 0,
                                afternoonMin: !isStandby && !isTech && entry.session === "AFTERNOON" ? durationMinutes : 0,
                                standbyMin: isStandby ? durationMinutes : 0,
                                techMin: isTech ? durationMinutes : 0,
                                pIdx
                              };
                            }).filter(Boolean);
                        }).sort((a, b) => a!.date.localeCompare(b!.date) || a!.startTime.localeCompare(b!.startTime))
                          .filter((ta) => !selectedInspectionDate || ta!.date === selectedInspectionDate);

                        const teacher = teachers.find(t => t.id === selectedInspectionTeacherId);
                        const preference = teacher?.invigilationPreference || 'SCATTERED';

                        // Detect Duplicates
                        const duplicateTags = new Map<string, number>();
                        teacherAssignments.forEach(ta => {
                          const tag = `${ta!.date}|${ta!.startTime}|${ta!.endTime}|${ta!.subject}|${ta!.paperType}`;
                          duplicateTags.set(tag, (duplicateTags.get(tag) || 0) + 1);
                        });

                        const totals = teacherAssignments.reduce((acc, curr) => ({
                          morning: acc.morning + curr!.morningMin,
                          afternoon: acc.afternoon + curr!.afternoonMin,
                          standby: acc.standby + curr!.standbyMin,
                          tech: acc.tech + curr!.techMin
                        }), { morning: 0, afternoon: 0, standby: 0, tech: 0 });

                        const uniqueDates = Array.from(new Set(teacherAssignments.map(r => r!.date))).sort();

                         return (
                          <>
                            {teacherAssignments.map((row, idx) => {
                              const dateIndex = uniqueDates.indexOf(row!.date);
                              const isEvenDay = dateIndex % 2 === 0;
                              const tag = `${row!.date}|${row!.startTime}|${row!.endTime}|${row!.subject}|${row!.paperType}`;
                              const isDuplicate = (duplicateTags.get(tag) || 0) > 1;

                              // Check sequential
                              const prev = idx > 0 ? teacherAssignments[idx - 1] : null;
                              const isSequential = prev && prev.date === row!.date && prev.endTime === row!.startTime;
                              
                              let rowBgClass = isEvenDay ? "bg-white" : "bg-slate-100/80";
                              
                              if (isDuplicate) {
                                rowBgClass = "bg-orange-100/60";
                              } else if (isSequential) {
                                if (preference === "SCATTERED") {
                                  rowBgClass = "bg-curro-red text-white";
                                } else {
                                  rowBgClass = "bg-emerald-100 text-emerald-900";
                                }
                              }

                              return (
                                <tr key={`${row!.date}-${row!.assignmentKey}-${idx}`} className={`${rowBgClass} transition-colors border-b border-gray-50/50`}>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col text-inherit">
                                      <span className="text-xs font-black">{format(parseISO(row!.date), "dd MMM yyyy")}</span>
                                      <span className={`text-[9px] font-bold uppercase tracking-tighter ${rowBgClass.includes('text-white') ? 'text-white/80' : 'text-text-muted'}`}>{format(parseISO(row!.date), "EEEE")}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-mono font-bold">{row!.startTime}</td>
                                  <td className="px-6 py-4 text-xs font-mono font-bold">{row!.endTime}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col text-inherit">
                                      <span className="text-xs font-bold leading-tight">{row!.subject}</span>
                                      <span className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${rowBgClass.includes('text-white') ? 'text-white/80' : 'text-text-muted'}`}>Grade {row!.grade}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">{row!.paperType}</td>
                                  <td className={`px-6 py-4 text-xs font-black uppercase tracking-tight ${rowBgClass.includes('text-white') ? 'text-white' : 'text-curro-blue'}`}>{row!.venueName}</td>
                                  <td className={`px-6 py-4 text-xs font-black text-center border-x border-gray-100/30 ${row!.morningMin > 0 ? (rowBgClass.includes('text-white') ? "bg-white/10" : "bg-blue-50/30 text-curro-blue") : "text-gray-400"}`}>
                                    {row!.morningMin || "-"}
                                  </td>
                                  <td className={`px-6 py-4 text-xs font-black text-center border-x border-gray-100/30 ${row!.afternoonMin > 0 ? (rowBgClass.includes('text-white') ? "bg-white/10" : "bg-emerald-50/30 text-emerald-600") : "text-gray-400"}`}>
                                    {row!.afternoonMin || "-"}
                                  </td>
                                  <td className={`px-6 py-4 text-xs font-black text-center border-x border-gray-100/30 ${row!.standbyMin > 0 ? (rowBgClass.includes('text-white') ? "bg-white/10" : "bg-amber-50/30 text-amber-600") : "text-gray-400"}`}>
                                    {row!.standbyMin || "-"}
                                  </td>
                                  <td className={`px-6 py-4 text-xs font-black text-center border-x border-gray-100/30 ${row!.techMin > 0 ? (rowBgClass.includes('text-white') ? "bg-white/10" : "bg-red-50/30 text-curro-red") : "text-gray-400"}`}>
                                    {row!.techMin || "-"}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <button
                                      onClick={() => setConfirmState({
                                        open: true,
                                        title: "Remove assignment",
                                        message: "Are you sure you want to remove this specific assignment?",
                                        variant: "destructive",
                                        confirmLabel: "Remove",
                                        onConfirm: async () => {
                                          setIsSaving(true);
                                          try {
                                            const entry = entries.find(e => e.id === row!.entryId);
                                            if (entry && entry.invigilatorAssignments) {
                                              const newAssIdx = { ...entry.invigilatorAssignments };
                                              delete newAssIdx[row!.assignmentKey];
                                              await updateDoc(doc(db, "entries", row!.entryId), { invigilatorAssignments: newAssIdx });
                                            }
                                          } catch (e) {
                                            handleFirestoreError(e, OperationType.UPDATE, "entries");
                                          } finally {
                                            setIsSaving(false);
                                          }
                                        },
                                      })}
                                      className="p-1 hover:bg-curro-red/10 rounded-full text-curro-red/40 hover:text-curro-red transition-all"
                                      title="Delete Duplicate/Error"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-100/50 border-t-2 border-gray-200 sticky bottom-0">
                              <td colSpan={6} className="px-6 py-6 text-right text-xs font-black uppercase tracking-widest text-text-muted">
                                Total Session Minutes
                              </td>
                              <td className="px-6 py-6 text-sm font-black text-curro-blue text-center bg-blue-100/30 border-x border-gray-200">{totals.morning}</td>
                              <td className="px-6 py-6 text-sm font-black text-emerald-600 text-center bg-emerald-100/30 border-x border-gray-200">{totals.afternoon}</td>
                              <td className="px-6 py-6 text-sm font-black text-amber-600 text-center bg-amber-100/30 border-x border-gray-200">{totals.standby}</td>
                              <td className="px-6 py-6 text-sm font-black text-curro-red text-center bg-red-100/30 border-x border-gray-200">{totals.tech}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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
            <AddTeacherModal
              onClose={() => setIsAddModalOpen(false)}
              onSave={async (teacher) => {
                setIsSaving(true);
                try {
                  await setDoc(doc(db, "users", teacher.id!), {
                    ...teacher,
                    uid: "",
                  });
                  setIsAddModalOpen(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.CREATE, "users");
                } finally {
                  setIsSaving(false);
                }
              }}
              isSaving={isSaving}
            />
          )}
          {selectedTeacherForEdit && (
            <EditTeacherModal
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
                try {
                  const leaveRef = doc(collection(db, "leaveRequests"));
                  await setDoc(leaveRef, { ...request, id: leaveRef.id });
                } catch (e) {
                  handleFirestoreError(e, OperationType.WRITE, "leaveRequests");
                } finally {
                  setIsSaving(false);
                }
              }}
              onUpdateStatus={async (requestId, status) => {
                setIsSaving(true);
                try {
                  await updateDoc(doc(db, "leaveRequests", requestId), {
                    status,
                  });
                } catch (e) {
                  handleFirestoreError(
                    e,
                    OperationType.WRITE,
                    `leaveRequests/${requestId}`,
                  );
                } finally {
                  setIsSaving(false);
                }
              }}
              onDelete={async (requestId) => {
                setIsSaving(true);
                try {
                  await deleteDoc(doc(db, "leaveRequests", requestId));
                } catch (e) {
                  handleFirestoreError(
                    e,
                    OperationType.DELETE,
                    `leaveRequests/${requestId}`,
                  );
                } finally {
                  setIsSaving(false);
                }
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

function TimetableModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (u: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}) {
  const [cycle, setCycle] = useState<1 | 2>(1);
  const [timetable, setTimetable] = useState<TeacherTimetable>(
    teacher.timetable || {
      cycle1: {
        "0": ["", "", "", "", "", "", ""],
        "1": ["", "", "", "", "", "", ""],
        "2": ["", "", "", "", "", "", ""],
        "3": ["", "", "", "", "", "", ""],
        "4": ["", "", "", "", "", "", ""],
      },
      cycle2: {
        "0": ["", "", "", "", "", "", ""],
        "1": ["", "", "", "", "", "", ""],
        "2": ["", "", "", "", "", "", ""],
        "3": ["", "", "", "", "", "", ""],
        "4": ["", "", "", "", "", "", ""],
      },
    },
  );

  const handleCellChange = (dayIdx: number, pIdx: number, value: string) => {
    const cycleKey = cycle === 1 ? "cycle1" : "cycle2";
    const newCycle = { ...timetable[cycleKey] };
    const newDay = [...newCycle[dayIdx.toString()]];
    newDay[pIdx] = value;
    newCycle[dayIdx.toString()] = newDay;
    setTimetable({ ...timetable, [cycleKey]: newCycle });
  };

  const periodSlots = PERIODS.filter((p) => !p.break);

  return (
    <Modal open onClose={onClose} title={`${teacher.firstName} ${teacher.lastName} – Master Timetable`} size="lg">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between -mx-6 -mt-6 mb-4">
          <div className="flex bg-white rounded-xl p-1 shadow-inner border border-gray-200">
            {[1, 2].map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c as 1 | 2)}
                className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  cycle === c
                    ? "bg-curro-blue text-white shadow-md"
                    : "text-text-muted hover:text-text-dark"
                }`}
              >
                Cycle {c}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-black text-curro-red uppercase italic tracking-tighter">
            Enter grades in period slots
          </span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-7 border-b-2 border-gray-200 mb-2">
              <div className="p-2" />
              {SHORT_DAYS.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-xs font-black text-text-muted uppercase tracking-widest"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {periodSlots.map((p, pIdx) => (
                <div key={p.id} className="grid grid-cols-7 group">
                  <div className="p-3 bg-gray-50 flex flex-col justify-center border-r border-gray-100">
                    <span className="text-[10px] font-black text-curro-blue">
                      {p.label}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-text-muted leading-none">
                      {p.start}
                    </span>
                  </div>
                  {[0, 1, 2, 3, 4, 5].map((dayIdx) => (
                    <div
                      key={dayIdx}
                      className="p-1 border border-gray-50 bg-white group-hover:bg-gray-50/30 transition-colors"
                    >
                      <input
                        type="text"
                        value={
                          timetable[cycle === 1 ? "cycle1" : "cycle2"][
                            dayIdx.toString()
                          ]?.[pIdx] || ""
                        }
                        onChange={(e) =>
                          handleCellChange(dayIdx, pIdx, e.target.value)
                        }
                        placeholder="Grade"
                        className="w-full h-10 text-center text-sm font-black border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-lg transition-all outline-none"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-text-muted font-bold max-w-md italic">
            Changes are saved to the teacher's profile. These will be used for
            automated availability scanning.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:text-text-dark transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              onClick={() => onSave({ timetable }).then(() => onClose())}
              className="flex items-center gap-2 px-8 py-2 bg-text-dark text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "SAVING..." : "SAVE TIMETABLE"}
            </button>
          </div>
        </div>
    </Modal>
  );
}

function SubjectsModal({
  teacher,
  onClose,
  onSave,
  isSaving,
  allSubjects,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (u: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
  allSubjects: Subject[];
}) {
  const [subjects, setSubjects] = useState<Subject[]>(teacher.subjects || []);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const addSubject = () => {
    const s = allSubjects.find((sub) => sub.id === selectedSubjectId);
    if (s && subjects.length < 10 && !subjects.some((sub) => sub.id === s.id)) {
      setSubjects([...subjects, s]);
      setSelectedSubjectId("");
    }
  };

  const removeSubject = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  return (
    <Modal open onClose={onClose} title={`${teacher.firstName} ${teacher.lastName} – Subject Specialization`} size="md">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 mb-1 block">
              Add Subject from Master List
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              >
                <option value="">Select a subject...</option>
                {allSubjects
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((s) => !subjects.some((sub) => sub.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
              </select>
              <button
                onClick={addSubject}
                disabled={subjects.length >= 10 || !selectedSubjectId}
                className="px-6 bg-curro-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-50 hover:bg-opacity-90 transition-all active:scale-95"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black text-text-muted uppercase tracking-widest px-2">
              <span>Managed Subjects ({subjects.length}/10)</span>
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 max-h-[300px] overflow-auto">
              {subjects.length === 0 ? (
                <div className="p-8 text-center text-text-muted font-bold text-xs uppercase italic tracking-widest opacity-50">
                  No subjects listed for this staff member
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {subjects.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-white/50 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="bg-curro-blue text-white px-2 py-1 rounded text-[10px] font-black tracking-tighter">
                          {s.code}
                        </span>
                        <span className="text-sm font-bold text-text-dark">
                          {s.name}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSubject(i)}
                        className="p-1.5 text-text-muted hover:text-curro-red hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-text-muted font-bold max-w-xs italic leading-tight">
            Subjects are used to prioritize exam assignments based on
            specialization.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:text-text-dark transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              onClick={() => onSave({ subjects }).then(() => onClose())}
              className="flex items-center gap-2 px-8 py-2 bg-curro-red text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
    </Modal>
  );
}

function AddTeacherModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (t: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    workloadPercentage: 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id && formData.firstName && formData.lastName) {
      onSave({
        ...formData,
        roles: ["TEACHER"],
        activeRole: "TEACHER",
        totalHours: 0,
        workloadPercentage: formData.workloadPercentage,
      } as any);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add New Faculty" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Staff Code
              </label>
              <input
                required
                type="text"
                placeholder="e.g. AMOP"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value.toUpperCase() })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Email (Optional)
              </label>
              <input
                type="email"
                placeholder="teacher@curro.co.za"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value.toLowerCase(),
                  })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                First Name
              </label>
              <input
                required
                type="text"
                placeholder="Amoré"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Last Name
              </label>
              <input
                required
                type="text"
                placeholder="Pienaar"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Invigilation Load (%)
            </label>
            <input
              required
              type="number"
              min="0"
              max="200"
              value={formData.workloadPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  workloadPercentage: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-curro-blue outline-none"
            />
            <p className="text-[9px] text-text-muted mt-1 px-1 italic">
              100% is standard full-time load.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-curro-blue text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? "REGISTERING..." : "REGISTER STAFF"}
            </button>
          </div>
        </form>
    </Modal>
  );
}

function EditTeacherModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (t: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    email: teacher.email || "",
    workloadPercentage: teacher.workloadPercentage ?? 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Edit Profile – ${teacher.id}`} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Email Association
            </label>
            <input
              type="email"
              placeholder="Assign to Google Account..."
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value.toLowerCase(),
                })
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
            />
            <p className="text-[9px] text-text-muted mt-1 px-1 italic">
              When a user logs in with this email, they will be linked to this
              staff profile.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                First Name
              </label>
              <input
                required
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Last Name
              </label>
              <input
                required
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Invigilation Load (%)
            </label>
            <input
              required
              type="number"
              min="0"
              max="200"
              value={formData.workloadPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  workloadPercentage: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-curro-blue outline-none"
            />
            <p className="text-[9px] text-text-muted mt-1 px-1 italic">
              100% is standard full-time load.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-zinc-800 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 border-b-2 border-curro-blue"
            >
              {isSaving ? "UPDATING..." : "UPDATE PROFILE"}
            </button>
          </div>
        </form>
    </Modal>
  );
}

function BreakDutyModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (breakDates: string[], afternoonDates: string[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [breakDates, setBreakDates] = useState<string[]>(
    teacher.breakDutyDates || [],
  );
  const [afternoonDates, setAfternoonDates] = useState<string[]>(
    teacher.afternoonDutyDates || [],
  );
  const [activeTab, setActiveTab] = useState<"BREAK" | "AFTERNOON">("BREAK");
  const [newDate, setNewDate] = useState(format(startOfToday(), "yyyy-MM-dd"));

  const addDate = () => {
    if (activeTab === "BREAK") {
      if (!breakDates.includes(newDate)) {
        setBreakDates([...breakDates, newDate].sort());
      }
    } else {
      if (!afternoonDates.includes(newDate)) {
        setAfternoonDates([...afternoonDates, newDate].sort());
      }
    }
  };

  const removeDate = (date: string, type: "BREAK" | "AFTERNOON") => {
    if (type === "BREAK") {
      setBreakDates(breakDates.filter((d) => d !== date));
    } else {
      setAfternoonDates(afternoonDates.filter((d) => d !== date));
    }
  };

  const handleSave = () => {
    onSave(breakDates, afternoonDates).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Staff Duties – ${teacher.lastName}`} size="sm">
        <div className="space-y-6">
          <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab("BREAK")}
              className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "BREAK"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-text-muted hover:bg-white/50"
              }`}
            >
              Break Duty
            </button>
            <button
              onClick={() => setActiveTab("AFTERNOON")}
              className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "AFTERNOON"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-text-muted hover:bg-white/50"
              }`}
            >
              Afternoon Duty
            </button>
          </div>

          <div
            className={`rounded-xl p-4 border flex items-start gap-3 ${
              activeTab === "BREAK"
                ? "bg-amber-50 border-amber-100"
                : "bg-blue-50 border-blue-100"
            }`}
          >
            <AlertCircle
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                activeTab === "BREAK" ? "text-amber-600" : "text-blue-600"
              }`}
            />
            <p
              className={`text-[10px] font-bold leading-relaxed uppercase tracking-tight ${
                activeTab === "BREAK" ? "text-amber-800" : "text-blue-800"
              }`}
            >
              {activeTab === "BREAK"
                ? "Teachers on break duty are automatically blocked from invigilating during ALL breaks on specified dates."
                : "Teachers on afternoon duty are automatically blocked from invigilating during ALL AFTERNOON sessions on specified dates."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Add New Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={`flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 ${
                  activeTab === "BREAK"
                    ? "focus:ring-amber-500"
                    : "focus:ring-blue-500"
                }`}
              />
              <button
                onClick={addDate}
                className={`px-6 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                  activeTab === "BREAK"
                    ? "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                    : "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                }`}
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Active {activeTab === "BREAK" ? "Break" : "Afternoon"} Duties
            </label>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
              {(activeTab === "BREAK" ? breakDates : afternoonDates).length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    No dates assigned
                  </p>
                </div>
              ) : (
                (activeTab === "BREAK" ? breakDates : afternoonDates).map(
                  (date) => (
                    <div
                      key={date}
                      className="flex items-center justify-between p-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar
                          className={`w-3.5 h-3.5 ${
                            activeTab === "BREAK"
                              ? "text-amber-500"
                              : "text-blue-500"
                          }`}
                        />
                        <span className="text-xs font-bold text-text-dark">
                          {format(parseISO(date), "EEEE, do MMM yyyy")}
                        </span>
                      </div>
                      <button
                        onClick={() => removeDate(date, activeTab)}
                        className="p-1.5 text-text-muted hover:text-curro-red hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                activeTab === "BREAK"
                  ? "bg-amber-600 shadow-amber-600/20 hover:bg-opacity-90"
                  : "bg-blue-600 shadow-blue-600/20 hover:bg-opacity-90"
              }`}
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
    </Modal>
  );
}

function HomeRoomModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (grade: number | undefined, cls: number | undefined) => Promise<void>;
  isSaving: boolean;
}) {
  const [grade, setGrade] = useState<number | undefined>(teacher.homeRoomGrade);
  const [cls, setCls] = useState<number | undefined>(teacher.homeRoomClass);

  const handleSave = () => {
    onSave(grade, cls).then(() => onClose());
  };

  const handleClear = () => {
    onSave(undefined, undefined).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Home Room – ${teacher.firstName} ${teacher.lastName}`} size="sm">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Select Grade
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[8, 9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-2 rounded-lg font-black text-xs transition-all ${
                      grade === g
                        ? "bg-indigo-600 text-white shadow-lg scale-105"
                        : "bg-gray-50 text-text-muted hover:bg-gray-100"
                    }`}
                  >
                    Gr {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Select Class
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCls(c)}
                    className={`py-2 rounded-lg font-black text-xs transition-all ${
                      cls === c
                        ? "bg-indigo-600 text-white shadow-lg scale-105"
                        : "bg-gray-50 text-text-muted hover:bg-gray-100"
                    }`}
                  >
                    E{c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !grade || !cls}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "SAVING..." : "SAVE"}
              </button>
            </div>
            {teacher.homeRoomGrade && (
              <button
                onClick={handleClear}
                disabled={isSaving}
                className="w-full py-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear Home Room Assignment
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
}

function LeaveRequestModal({
  teacher,
  onClose,
  user,
  requests,
  onSave,
  onUpdateStatus,
  onDelete,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  user: Teacher;
  requests: LeaveRequest[];
  onSave: (req: Omit<LeaveRequest, "id">) => Promise<void>;
  onUpdateStatus: (id: string, status: "APPROVED" | "DENIED") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<
    Omit<LeaveRequest, "id" | "status" | "teacherId">
  >({
    date: format(startOfToday(), "yyyy-MM-dd"),
    type: "Sick Leave",
    isFullDay: true,
    startTime: "07:50",
    endTime: "14:30",
    reason: "",
  });

  const isAdmin =
    user.roles.includes("ADMIN") || user.roles.includes("WEBMASTER");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      teacherId: teacher.id,
      status: "PENDING",
    });
  };

  return (
    <Modal open onClose={onClose} title={`Schedule Leave – ${teacher.firstName} ${teacher.lastName}`} size="md">
        <div className="grid grid-cols-1 md:grid-cols-2 -mx-6 -my-6">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 border-r border-gray-100"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Leave Date
              </label>
              <input
                required
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Leave Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              >
                <option value="Sick Leave">Sick Leave</option>
                <option value="Arrangement">Arrangement</option>
                <option value="Special leave">Special leave</option>
              </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <input
                type="checkbox"
                id="fullDay"
                checked={formData.isFullDay}
                onChange={(e) =>
                  setFormData({ ...formData, isFullDay: e.target.checked })
                }
                className="w-4 h-4 rounded text-curro-blue focus:ring-curro-blue"
              />
              <label
                htmlFor="fullDay"
                className="text-xs font-bold text-text-dark uppercase tracking-tight"
              >
                Full Day Leave
              </label>
            </div>

            {!formData.isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Reason (Optional)
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none min-h-[80px] resize-none"
                placeholder="Mention reasons..."
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-curro-blue text-white rounded-xl py-4 font-black text-xs uppercase tracking-widest shadow-xl shadow-curro-blue/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 border-b-4 border-curro-red"
            >
              {isSaving ? "Submitting..." : "Apply for Leave"}
            </button>
          </form>

          {/* List */}
          <div className="bg-gray-50/50 p-6 flex flex-col h-full overflow-hidden">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-3 h-3" />
              Recent History
            </h4>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {requests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
                  <CalendarRange className="w-12 h-12 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    No Leave Found
                  </p>
                </div>
              ) : (
                requests
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 rounded-2xl border ${
                        req.status === "APPROVED"
                          ? "bg-white border-emerald-100"
                          : req.status === "DENIED"
                            ? "bg-white border-red-100"
                            : "bg-amber-50 border-amber-200 shadow-md transition-all hover:scale-[1.02]"
                      } group`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                          {req.type}
                        </span>
                        <div
                          className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                            req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "DENIED"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700 font-bold animate-pulse"
                          }`}
                        >
                          {req.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3 h-3 text-text-muted" />
                        <span className="text-xs font-black text-text-dark">
                          {format(parseISO(req.date), "EEE, d MMM")}
                        </span>
                      </div>
                      {req.isFullDay ? (
                        <span className="text-[10px] font-bold text-text-muted ml-5 italic">
                          Full Day
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 ml-5">
                          <Clock className="w-2.5 h-2.5 text-text-muted" />
                          <span className="text-[10px] font-bold text-text-muted">
                            {req.startTime} - {req.endTime}
                          </span>
                        </div>
                      )}

                      {isAdmin && req.status === "PENDING" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => onUpdateStatus(req.id, "APPROVED")}
                            className="flex-1 bg-emerald-600 text-white rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onUpdateStatus(req.id, "DENIED")}
                            className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                          >
                            Deny
                          </button>
                        </div>
                      )}

                      <div className="mt-2 text-right">
                        <button
                          onClick={() => onDelete(req.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
    </Modal>
  );
}

function ExamTimetableTab({
  date,
  setDate,
  entries,
  teachers,
  venues,
  isSaving,
  allSubjectsList,
  lockedDates,
  onBackup,
}: {
  date: string;
  setDate: (d: string) => void;
  entries: TimetableEntry[];
  teachers: Teacher[];
  venues: Venue[];
  isSaving: boolean;
  allSubjectsList: Subject[];
  lockedDates: string[];
  onBackup?: () => void;
}) {
  const isLocked = lockedDates.includes(date);

  const toggleLock = async () => {
    try {
      await setDoc(doc(db, "timetableLocks", date), { locked: !isLocked });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `timetableLocks/${date}`);
    }
  };
  const grades = [8, 9, 10, 11, 12];
  const paperTypes: TimetableEntry["paperType"][] = [
    "Normal",
    "P1",
    "P2",
    "Prac",
    "Seminar",
  ];
  const allSubjects = allSubjectsList.map((s) => s.name).sort();

  const getExamSeries = (dateStr: string) => {
    const d = parseISO(dateStr);
    const month = d.getMonth() + 1;
    if (month >= 5 && month <= 6) {return "May/June Exam";}
    if (month >= 8 && month <= 9) {return "Prelim Exam (Aug/Sept)";}
    if (month >= 10 && month <= 12) {return "End of Year Exam";}
    return "Other Series";
  };

  const currentSeries = getExamSeries(date);
  const seriesEntries = entries.filter(
    (e) => getExamSeries(e.date) === currentSeries,
  );
  const seriesWorkload = seriesEntries.reduce(
    (sum, e) => sum + (e.durationMinutes || 0),
    0,
  );

  const seriesInvigilationMinutes = seriesEntries.reduce((sum, e) => {
    const assignedCount = Object.entries(e.invigilatorAssignments || {}).filter(([k, _]) => {
      const vId = k.split("_")[1];
      if (vId === "GRADE") {return true;}
      return e.venueIds?.includes(vId);
    }).length;
    return sum + assignedCount * (e.durationMinutes || 0);
  }, 0);

  const invigilatorCount = teachers.filter(
    (t) =>
      t.canInvigilate !== false &&
      !(
        (t.firstName === "Merike" || t.firstName === "Merike van Dyk") &&
        (t.lastName === "Van Dyk" || t.lastName === "van Dyk" || !t.lastName)
      ) &&
      t.id !== "MERV", // Explicitly exclude Merike ID just in case
  ).length;

  const invigilationRatio =
    invigilatorCount > 0 ? (seriesWorkload / invigilatorCount).toFixed(0) : "0";

  const dayEntries = entries.filter((e) => e.date === date);
  const totalMinutes = dayEntries.reduce(
    (sum, e) => sum + (e.durationMinutes || 0),
    0,
  );

  const getEntriesForGradeSession = (
    grade: number,
    session: "MORNING" | "AFTERNOON",
  ) => {
    return dayEntries.filter((e) => e.grade === grade && e.session === session);
  };

  const subjectNames = allSubjectsList.map((s) => s.name).sort();

  const handleSave = async (
    grade: number,
    session: "MORNING" | "AFTERNOON",
    subject: string,
    paperType: TimetableEntry["paperType"],
    durationMinutes: number,
    totalBoys: number,
    totalGirls: number,
    venueIds?: string[],
    existingId?: string,
  ) => {
    if (!existingId && !subject) {return;}

    const entryId =
      existingId ||
      `${date}_${grade}_${session}_${Math.random().toString(36).substr(2, 5)}`;
    const entryRef = doc(db, "timetableEntries", entryId);

    // Inherit session mode if adding a new subject to an existing session
    const existingSessionEntries = getEntriesForGradeSession(grade, session);
    const sessionMode =
      existingSessionEntries[0]?.sessionMode || "SIMULTANEOUS";

    if (!subject) {
      await deleteDoc(entryRef).catch((e) =>
        handleFirestoreError(
          e,
          OperationType.DELETE,
          `timetableEntries/${entryId}`,
        ),
      );
      return;
    }

    const data: TimetableEntry = {
      id: entryId,
      date,
      grade,
      session,
      subject,
      paperType,
      durationMinutes,
      totalBoys,
      totalGirls,
      totalStudents: totalBoys + totalGirls,
      venueIds,
      sessionMode, // Preserve or inherit mode
    };

    try {
      await setDoc(entryRef, data, { merge: true });
    } catch (e) {
      handleFirestoreError(
        e,
        OperationType.CREATE,
        `timetableEntries/${entryId}`,
      );
    }
  };

  const toggleSessionMode = async (
    g: number,
    s: "MORNING" | "AFTERNOON",
    currentEntries: TimetableEntry[],
  ) => {
    if (currentEntries.length === 0) {return;}
    const currentMode = currentEntries[0].sessionMode || "SIMULTANEOUS";
    const newMode =
      currentMode === "SIMULTANEOUS" ? "SEQUENTIAL" : "SIMULTANEOUS";

    const updates = currentEntries.map((entry) =>
      updateDoc(doc(db, "timetableEntries", entry.id), {
        sessionMode: newMode,
      }),
    );
    try {
      await Promise.all(updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, "timetableEntries");
    }
  };

  const getTeacherCodes = (subject: string) => {
    if (!subject) {return "";}
    const isFAL = subject === "First Additional Languages";

    return teachers
      .filter((t) => {
        const teacherSubjects =
          t.subjects?.map((s) => (s.name || s.code).toLowerCase()) || [];
        if (isFAL) {
          return teacherSubjects.some(
            (ts) =>
              FAL_SUBJECTS.some((f) => f.toLowerCase() === ts) ||
              ts === "first additional languages",
          );
        }
        return teacherSubjects.some((ts) => ts === subject.toLowerCase());
      })
      .map((t) => t.id)
      .join(", ");
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-curro-blue p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-curro-red">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black leading-tight uppercase tracking-tight">
                Exam Time Table
              </h3>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">
                Master Schedule Management
              </p>
            </div>
            <button
              onClick={onBackup}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 shadow-lg"
            >
              <Download className="w-3.5 h-3.5" />
              TimeTable JSON Backup
            </button>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                Series Workload{" "}
                <span className="text-[8px] opacity-60">({currentSeries})</span>
              </span>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <BookOpen className="w-3.5 h-3.5 text-white/60" />
                <span className="text-sm font-black text-white">
                  {seriesWorkload}{" "}
                  <span className="text-[10px] opacity-60">MINS</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                Invigilation Ratio
              </span>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <Repeat className="w-3.5 h-3.5 text-white/60" />
                <span className="text-sm font-black text-white">
                  {invigilationRatio}{" "}
                  <span className="text-[10px] opacity-60">X</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
                Daily Workload
              </span>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-sm font-black text-white">
                  {totalMinutes}{" "}
                  <span className="text-[10px] opacity-60">MINS</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">
                Select Schedule Date
              </span>
              <div className="flex flex-col items-end gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm font-black focus:bg-white focus:text-curro-blue transition-all outline-none w-full"
                />
                <button
                  onClick={toggleLock}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    isLocked
                      ? "bg-amber-500 text-white shadow-lg"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <LockOpen className="w-3 h-3" />
                  )}
                  {isLocked ? "Schedule Locked" : "Unlock Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 gap-8">
            {grades.map((grade) => (
              <div
                key={grade}
                className="bg-gray-50/50 rounded-2xl border border-gray-100 p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-curro-blue text-white flex items-center justify-center font-black text-lg shadow-lg">
                    {grade}
                  </div>
                  <h4 className="text-lg font-black text-text-dark uppercase tracking-tight">
                    Grade {grade} Examination Status
                  </h4>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Morning Session */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded">
                          <Clock className="w-3 h-3" />
                          Morning Session
                        </h5>
                        {(() => {
                          const morningEntries = getEntriesForGradeSession(
                            grade,
                            "MORNING",
                          );
                          if (morningEntries.length > 1) {
                            const mode =
                              morningEntries[0].sessionMode || "SIMULTANEOUS";
                            return (
                              <button
                                onClick={() =>
                                  toggleSessionMode(
                                    grade,
                                    "MORNING",
                                    morningEntries,
                                  )
                                }
                                disabled={isLocked}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                                  mode === "SIMULTANEOUS"
                                    ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                    : "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100"
                                } disabled:opacity-50 disabled:hover:bg-transparent`}
                              >
                                {mode === "SIMULTANEOUS" ? (
                                  <SquareStack className="w-3 h-3" />
                                ) : (
                                  <ArrowRightCircle className="w-3 h-3" />
                                )}
                                {mode}
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-[8px] font-bold text-text-muted bg-white border border-gray-100 px-1.5 py-0.5 rounded uppercase">
                        Start: 08:20 (Arrive 07:50 / 07:30 Gr12)
                      </span>
                    </div>

                    <div className="space-y-4">
                      {(() => {
                        const morningEntries = getEntriesForGradeSession(
                          grade,
                          "MORNING",
                        );
                        const visibleEntries = isLocked
                          ? morningEntries.filter(
                              (e) => e.subject && e.subject !== "New Subject",
                            )
                          : morningEntries;

                        if (visibleEntries.length > 0) {
                          return visibleEntries.map((entry) => (
                            <TimetableField
                              key={entry.id}
                              entry={entry}
                              grade={grade}
                              onSave={(subj, pap, dur, boys, girls, vIds) =>
                                isLocked
                                  ? Promise.resolve()
                                  : handleSave(
                                      grade,
                                      "MORNING",
                                      subj,
                                      pap,
                                      dur,
                                      boys,
                                      girls,
                                      vIds,
                                      entry.id,
                                    )
                              }
                              teacherCodes={getTeacherCodes(
                                entry.subject || "",
                              )}
                              paperTypes={paperTypes}
                              allSubjects={allSubjects}
                              venues={venues}
                              isLocked={isLocked}
                            />
                          ));
                        }

                        if (isLocked) {return null;}

                        return (
                          <div className="p-4 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-bold text-text-muted opacity-40 uppercase italic tracking-widest">
                              No morning exams planned
                            </p>
                          </div>
                        );
                      })()}

                      {!isLocked && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleSave(
                                grade,
                                "MORNING",
                                "New Subject",
                                "Normal",
                                60,
                                0,
                                0,
                                [],
                              )
                            }
                            className="flex-1 py-2 border-2 border-dashed border-emerald-100 rounded-xl text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            Add Morning Subject
                          </button>
                          {getEntriesForGradeSession(grade, "MORNING").some(
                            (e) => !e.subject || e.subject === "New Subject",
                          ) && (
                            <button
                              onClick={async () => {
                                const emptyEntry = getEntriesForGradeSession(
                                  grade,
                                  "MORNING",
                                ).find(
                                  (e) =>
                                    !e.subject || e.subject === "New Subject",
                                );
                                if (emptyEntry) {
                                  await deleteDoc(
                                    doc(db, "timetableEntries", emptyEntry.id),
                                  );
                                }
                              }}
                              className="px-4 py-2 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                              title="Remove Empty Session"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove Session
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Afternoon Session */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h5 className="text-[10px] font-black text-curro-red uppercase tracking-widest flex items-center gap-2 bg-red-50 px-2 py-1 rounded">
                          <Clock className="w-3 h-3" />
                          Afternoon Session
                        </h5>
                        {(() => {
                          const afternoonEntries = getEntriesForGradeSession(
                            grade,
                            "AFTERNOON",
                          );
                          if (afternoonEntries.length > 1) {
                            const mode =
                              afternoonEntries[0].sessionMode || "SIMULTANEOUS";
                            return (
                              <button
                                onClick={() =>
                                  toggleSessionMode(
                                    grade,
                                    "AFTERNOON",
                                    afternoonEntries,
                                  )
                                }
                                disabled={isLocked}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                                  mode === "SIMULTANEOUS"
                                    ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                    : "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100"
                                } disabled:opacity-50 disabled:hover:bg-transparent`}
                              >
                                {mode === "SIMULTANEOUS" ? (
                                  <SquareStack className="w-3 h-3" />
                                ) : (
                                  <ArrowRightCircle className="w-3 h-3" />
                                )}
                                {mode}
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <span className="text-[8px] font-bold text-text-muted bg-white border border-gray-100 px-1.5 py-0.5 rounded uppercase">
                        Start: 13:20 (Arrive 12:50 / 12:30 Gr12)
                      </span>
                    </div>

                    <div className="space-y-4">
                      {(() => {
                        const afternoonEntries = getEntriesForGradeSession(
                          grade,
                          "AFTERNOON",
                        );
                        const visibleEntries = isLocked
                          ? afternoonEntries.filter(
                              (e) => e.subject && e.subject !== "New Subject",
                            )
                          : afternoonEntries;

                        if (visibleEntries.length > 0) {
                          return visibleEntries.map((entry) => (
                            <TimetableField
                              key={entry.id}
                              entry={entry}
                              grade={grade}
                              onSave={(subj, pap, dur, boys, girls, vIds) =>
                                isLocked
                                  ? Promise.resolve()
                                  : handleSave(
                                      grade,
                                      "AFTERNOON",
                                      subj,
                                      pap,
                                      dur,
                                      boys,
                                      girls,
                                      vIds,
                                      entry.id,
                                    )
                              }
                              teacherCodes={getTeacherCodes(
                                entry.subject || "",
                              )}
                              paperTypes={paperTypes}
                              allSubjects={allSubjects}
                              venues={venues}
                              isLocked={isLocked}
                            />
                          ));
                        }

                        if (isLocked) {return null;}

                        return (
                          <div className="p-4 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-bold text-text-muted opacity-40 uppercase italic tracking-widest">
                              No afternoon exams planned
                            </p>
                          </div>
                        );
                      })()}

                      {!isLocked && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleSave(
                                grade,
                                "AFTERNOON",
                                "New Subject",
                                "Normal",
                                60,
                                0,
                                0,
                                [],
                              )
                            }
                            className="flex-1 py-2 border-2 border-dashed border-red-100 rounded-xl text-[10px] font-black text-curro-red uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            Add Afternoon Subject
                          </button>
                          {getEntriesForGradeSession(grade, "AFTERNOON").some(
                            (e) => !e.subject || e.subject === "New Subject",
                          ) && (
                            <button
                              onClick={async () => {
                                const emptyEntry = getEntriesForGradeSession(
                                  grade,
                                  "AFTERNOON",
                                ).find(
                                  (e) =>
                                    !e.subject || e.subject === "New Subject",
                                );
                                if (emptyEntry) {
                                  await deleteDoc(
                                    doc(db, "timetableEntries", emptyEntry.id),
                                  );
                                }
                              }}
                              className="px-4 py-2 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                              title="Remove Empty Session"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove Session
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimetableFieldProps {
  entry?: TimetableEntry;
  grade: number | string;
  onSave: (
    subject: string,
    paperType: TimetableEntry["paperType"],
    duration: number,
    boys: number,
    girls: number,
    venueIds?: string[],
  ) => Promise<void>;
  teacherCodes: string;
  paperTypes: TimetableEntry["paperType"][];
  allSubjects: string[];
  venues: Venue[];
  isLocked?: boolean;
}

const TimetableField: React.FC<TimetableFieldProps> = ({
  entry,
  grade,
  onSave,
  teacherCodes,
  paperTypes,
  allSubjects,
  venues,
  isLocked,
}) => {
  const [subject, setSubject] = useState(entry?.subject || "");
  const [paperType, setPaperType] = useState<TimetableEntry["paperType"]>(
    entry?.paperType || "Normal",
  );
  const [duration, setDuration] = useState<number>(entry?.durationMinutes || 0);
  const [boys, setBoys] = useState<number>(entry?.totalBoys || 0);
  const [girls, setGirls] = useState<number>(entry?.totalGirls || 0);
  const [venueIds, setVenueIds] = useState<string[]>(entry?.venueIds || []);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync with prop when entry changes
  React.useEffect(() => {
    if (entry) {
      setSubject(entry.subject);
      setPaperType(entry.paperType);
      setDuration(entry.durationMinutes || 0);
      setBoys(entry.totalBoys || 0);
      setGirls(entry.totalGirls || 0);
      setVenueIds(entry.venueIds || []);
    } else {
      setSubject("");
      setPaperType("Normal");
      setDuration(0);
      setBoys(0);
      setGirls(0);
      setVenueIds([]);
    }
    setIsUpdating(false);
  }, [entry]);

  const handleInternalSave = async () => {
    setIsUpdating(true);
    await onSave(subject, paperType, duration, boys, girls, venueIds);
  };

  const toggleVenue = (vId: string) => {
    setVenueIds((prev) =>
      prev.includes(vId)
        ? prev.filter((id) => id !== vId)
        : prev.length < 8
          ? [...prev, vId]
          : prev,
    );
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 group relative hover:border-curro-blue/30 transition-all">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-4 py-2.5 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
            >
              <option value="">Select Subject...</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {subject && !allSubjects.includes(subject) && (
                <option key={subject} value={subject}>{subject}</option>
              )}
            </select>
          </div>
          <div className="w-32 flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Type
            </label>
            <select
              value={paperType}
              onChange={(e) => setPaperType(e.target.value as any)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all uppercase tracking-tighter disabled:opacity-50"
            >
              {paperTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Duration (Min)
            </label>
            <input
              type="number"
              value={duration || ""}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Boys
            </label>
            <input
              type="number"
              value={boys || ""}
              onChange={(e) => setBoys(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Girls
            </label>
            <input
              type="number"
              value={girls || ""}
              onChange={(e) => setGirls(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Total
            </label>
            <div className="w-full bg-blue-50 border border-blue-100 text-blue-600 rounded-xl px-3 py-2 text-xs font-black flex items-center justify-center">
              {boys + girls}
            </div>
          </div>
        </div>

        {grade === 12 &&
          !paperType?.toLowerCase().includes("prac") && (
            <div className="mt-1 text-[9px] font-black text-curro-red uppercase tracking-tight flex items-center gap-1.5 bg-red-50 p-2 rounded-xl border border-red-100 italic">
              <Building2 className="w-3 h-3" />
              Hall / Assembly Required for Grade 12
            </div>
          )}
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">
          Assigned Venues (Max 8)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {venues.map((v) => {
            const isSelected = venueIds.includes(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVenue(v.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-curro-blue text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-100"
                    : "bg-gray-100 text-text-muted hover:bg-gray-200"
                }`}
              >
                {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
            Staff Restricted
          </label>
          <div className="flex flex-wrap gap-1">
            {teacherCodes ? (
              teacherCodes.split(", ").map((code) => (
                <span
                  key={code}
                  className="text-[10px] font-black text-curro-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                >
                  {code}
                </span>
              ))
            ) : (
              <span className="text-[10px] font-bold text-text-muted italic opacity-50 text-[8px]">
                No matches...
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {entry && (
            <button
              onClick={() => onSave("", "Normal", 0, 0, 0)}
              className="p-2 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear entry"
              disabled={isUpdating || isLocked}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleInternalSave}
            disabled={isUpdating || !subject || isLocked}
            className={`min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              isUpdating || isLocked
                ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-curro-blue text-white hover:bg-blue-700 shadow-blue-500/20"
            }`}
          >
            {isUpdating ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {entry ? "Update" : "Save"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

function VenuesTab({
  venues,
  isSaving: parentSaving,
  onBackup,
}: {
  venues: Venue[];
  isSaving: boolean;
  onBackup?: () => void;
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const handleDelete = (venueId: string) => {
    setConfirmState({
      open: true,
      title: "Delete venue",
      message: "Are you sure you want to delete this venue?",
      variant: "destructive",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "venues", venueId));
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `venues/${venueId}`);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-xs font-sans">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-black text-text-dark uppercase tracking-tight text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-curro-red" />
              Examination Venues
            </h3>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
              Manage halls, labs and standard classrooms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-200/50 shadow-sm"
              title="Backup Venue Data"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Venue JSON Backup</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-curro-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Venue
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {venues.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                <Building2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-black text-text-dark uppercase tracking-tight">
                No Venues Found
              </h4>
              <p className="text-xs font-medium text-text-muted mt-1">
                Start by adding your first examination venue.
              </p>
            </div>
          ) : (
            venues.map((venue) => (
              <motion.div
                key={venue.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-curro-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                  <button
                    onClick={() => setEditingVenue(venue)}
                    className="p-1.5 hover:bg-gray-100 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
                    className="p-1.5 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${
                      venue.type === "Lab"
                        ? "bg-purple-50 text-purple-600"
                        : venue.type === "Hall"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-blue-50 text-curro-blue"
                    }`}
                  >
                    {venue.type === "Lab" ? (
                      <FlaskConical className="w-5 h-5" />
                    ) : venue.type === "Hall" ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <School className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-text-dark text-sm uppercase tracking-tight">
                      {venue.name}
                    </h4>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      {venue.type} Venue
                    </span>

                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-text-dark">
                          {venue.capacity}
                        </span>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                          Learners
                        </span>
                      </div>
                      <div className="w-px h-6 bg-gray-100" />
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-curro-blue">
                          ID: {venue.id}
                        </span>
                        <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">
                          Static Code
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {(isAddModalOpen || editingVenue) && (
          <VenueModal
            venue={editingVenue || undefined}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingVenue(null);
            }}
            onSave={async (vData) => {
              try {
                if (editingVenue) {
                  await updateDoc(
                    doc(db, "venues", editingVenue.id),
                    vData as any,
                  );
                } else {
                  const venueRef = doc(collection(db, "venues"), vData.id);
                  await setDoc(venueRef, vData);
                }
                setIsAddModalOpen(false);
                setEditingVenue(null);
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, "venues");
              }
            }}
          />
        )}
      </AnimatePresence>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}

function VenueModal({
  venue,
  onClose,
  onSave,
}: {
  venue?: Venue;
  onClose: () => void;
  onSave: (v: Venue) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Venue>>(
    venue || {
      id: "",
      name: "",
      type: "Normal",
      capacity: 25,
    },
  );
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Modal open onClose={onClose} title={venue ? "Edit Venue" : "Add New Venue"} size="sm">
        <div>
          <div className="space-y-5 font-sans">
            <div>
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                Venue ID (e.g. HALL1)
              </label>
              <input
                type="text"
                disabled={!!venue}
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value.toUpperCase() })
                }
                placeholder="Unique ID"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                Display Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. School Hall"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                  Venue Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none appearance-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Lab">Lab</option>
                  <option value="Hall">Hall</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                  Capacity
                </label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 font-sans">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl text-sm font-black text-text-muted hover:bg-gray-100 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setIsSaving(true);
                await onSave(formData as Venue);
                setIsSaving(false);
              }}
              disabled={isSaving || !formData.id || !formData.name}
              className="flex-1 bg-curro-blue text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {venue ? "Update" : "Save Venue"}
            </button>
          </div>
        </div>
    </Modal>
  );
}

function SchedulerTab({
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
      
      const isITorCAT = entry.subject.toLowerCase().includes("it") || 
                        entry.subject.toLowerCase().includes("information technology") ||
                        entry.subject.toLowerCase().includes("cat") ||
                        entry.subject.toLowerCase().includes("computer application technology");
      
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
  ) => {
    const t = teachers.find(t => t.id === teacherId);
    if (t) {
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      if (name.includes("merike") && name.includes("van dyk")) {return true;}
    }

    const datePeriods = getPeriodsForDate(dateStr);
    const period = datePeriods[periodIdx];
    if (!period) {return false;}

    const request = (leaveRequests || []).find(
      (lr) =>
        lr.teacherId === teacherId &&
        lr.date === dateStr &&
        (lr.status === "APPROVED" || lr.status === "PENDING"),
    );
    if (!request) {return false;}

    // Special Override: Shelton Hu is available on 18-19 June for Visual Art Tech support
    if (teacherId === "SHEH" && (dateStr === "2026-06-18" || dateStr === "2026-06-19")) {
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
            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-100">
              Morning: Start 08:20 (Staff 07:50)
            </span>
            <span className="bg-curro-red bg-opacity-5 text-curro-red text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-curro-red border-opacity-10">
              Afternoon: Start 13:20 (Staff 12:50)
            </span>
            <span className="bg-amber-50 text-amber-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-100">
              Grade 12 Hall: Staff 07:30 / 12:30
            </span>
          </div>
        </div>
      </div>

          {/* Auto Generate Block */}
          <div className="flex-1 max-w-xl bg-gray-50/80 rounded-3xl p-4 border border-gray-100 flex flex-col md:flex-row items-end gap-3 shadow-inner">
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-full">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1 ml-1">
                  Auto-generate FROM
                </label>
                <input
                  type="date"
                  value={autoFromDate}
                  onChange={(e) => setAutoFromDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                />
              </div>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest block">
                    Auto-complete UNTIL
                  </label>
                  {hasIncompleteVenues && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-black text-curro-red bg-red-50 px-2 py-0.5 rounded-full animate-pulse border border-red-100">
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
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                Select Date
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEqualize}
                  disabled={isGenerating || isEqualizing}
                  className="bg-emerald-600 text-white rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Scale className="w-2.5 h-2.5" />
                  Equalize
                </button>
                <button
                  onClick={() => handleEqualize(true)}
                  disabled={isGenerating || isEqualizing}
                  className="bg-curro-blue text-white rounded-xl px-3 py-1 font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Wand2 className="w-2.5 h-2.5" />
                  Fix errors & Balance
                </button>
                <button
                  onClick={() => setIsConfiguringPeriods(true)}
                  className="text-[9px] font-black text-curro-blue uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Settings className="w-2.5 h-2.5" />
                  Configure Periods
                </button>
              </div>
            </div>
            <input
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
                  <span className="text-[8px] font-black uppercase whitespace-nowrap">
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
              .filter((t) => {
                const name = `${t.firstName} ${t.lastName} ${t.id}`.toLowerCase();
                const isITSpec = isITSpecialistTeacher(t);
                const isLSSpec = isLSSpecialistTeacher(t);
                const isArtSpec = isArtSpecialistTeacher(t);
                const isSpec = isITSpec || isLSSpec || isArtSpec;
                const isFranz = t.id === "NORT" || t.id === "FRAN" || name.includes("franz") || name.includes("nortje");
                const isMerike =
                  t.firstName.toLowerCase().includes("merike") &&
                  t.lastName.toLowerCase().includes("van dyk");
                return (
                  (t.activeRole !== "WEBMASTER" || isSpec || isFranz) &&
                  (t.canInvigilate !== false || isSpec || isFranz) &&
                  !isMerike
                );
              })
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

                const s = entry.subject.toLowerCase().trim();
                const isITorCATEntry = s === "it" || s === "cat" || s.startsWith("it ") || s.startsWith("cat ") || s.includes("information technology") || s.includes("computer application technology");
                const isLSEntry = s === "ls" || s === "life science" || s === "life sciences" || s.includes("life science");
                const isArtEntry = s === "visual art" || s.includes("visual art");
                
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
              const name = `${ts.teacher.firstName} ${ts.teacher.lastName}`.toLowerCase();
              return !name.includes("merike van dyk");
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
                      <span className="text-[8px] font-black text-text-muted uppercase tracking-tighter">
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
                              className="text-[9px] font-black text-curro-blue bg-blue-50 px-1.5 py-0.5 rounded"
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
                      <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">
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
                              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${
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
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest text-left ml-1">
                          Period Allocation
                        </label>
                        <div className="space-y-4">
                          {relevantPIdxs.map((pIdx) => {
                            return (
                              <div key={pIdx} className="space-y-1.5">
                                <div className="flex items-center gap-2 px-1">
                                  <span className="text-[9px] font-black text-curro-blue uppercase tracking-widest">
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
                                            <span className="text-[8px] font-bold opacity-30 italic">
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
                                        
                                        const s = entry.subject.toLowerCase().trim();
                                        const isITorCAT = s === "it" || s === "cat" || s.startsWith("it ") || s.startsWith("cat ") || s.includes("information technology") || s.includes("computer application technology");
                                        const isLS = s === "ls" || s === "life science" || s === "life sciences" || s.includes("life science");

                                        const name = teacher ? `${teacher.firstName} ${teacher.lastName} ${teacher.id}`.toLowerCase() : "";
                                        const isITSpecialist = isITSpecialistTeacher(teacher || {} as any);
                                        const isLSSpecialist = name.includes("chare mouton") || name.includes("ezra nyathi") || name.includes("oritonda pinkie mafhungo") || (name.includes("oritonda") && name.includes("mafhungo"));
                                        
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
                                                <span className="text-[8px] font-bold opacity-30 italic">
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
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                        Scheduled to Grade
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[650px] max-h-[80vh]">
                      {/* Priority: Technical Staff for Prac */}
                      {isPrac && techTeachers.length > 0 && (
                        <div className="space-y-2 mb-6">
                          <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest ml-1">
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
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${isAssigned ? "text-blue-100" : isSpecialist ? "text-pink-600" : "text-purple-600/60"}`}>
                                      {isAssigned ? "Assigned" : isUsed ? "Occupied" : isSpecialist ? "Technical Specialist" : "Subject Specialist"}
                                    </span>
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
                                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-orange-100 text-orange-700 rounded-full text-[8px] font-black" title="Marathon Teacher">M</span>
                                      )}
                                      {t.invigilationPreference === "SCATTERED" && (
                                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-sky-100 text-sky-700 rounded-full text-[8px] font-black" title="Scattered Teacher">S</span>
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
                                        className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isAssigned ? "bg-white/20 text-white" : isBusyInPeriod(pIdx) ? "bg-gray-200 text-gray-500" : "bg-emerald-100 text-emerald-700"}`}
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
                    <span className="text-[9px] font-bold text-curro-red bg-red-50 px-2 py-0.5 rounded-full">
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
                                  {t.homeRoomGrade && (
                                    <span className={`text-[7px] font-black px-1 rounded uppercase ${isAssigned || hasConflict ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                                      HR Gr {t.homeRoomGrade} E{t.homeRoomClass}
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-black ${isAssigned || hasConflict ? "text-white/60" : "text-text-muted opacity-50"}`}>
                                    {t.id}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {freeFor.map((pIdx) => (
                                    <span
                                      key={pIdx}
                                      className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${isAssigned ? "bg-white/20 text-white" : isBusyInPeriod(pIdx) ? "bg-gray-200 text-gray-500" : "bg-red-100 text-red-600"}`}
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

              <p className="mt-8 text-[9px] font-bold text-text-muted opacity-50 uppercase tracking-widest">
                Please do not close or refresh this tab
              </p>
            </div>
      </Modal>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}

function PeriodConfigModal({
  isOpen,
  onClose,
  activePeriods,
  dayName,
  selectedDate,
  onSave,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  activePeriods: PeriodConfig[];
  dayName: string;
  selectedDate: string;
  onSave: (periods: PeriodConfig[], type: "DAY" | "DATE") => void;
  onReset: () => void;
}) {
  const [localPeriods, setLocalPeriods] = useState<PeriodConfig[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalPeriods(JSON.parse(JSON.stringify(activePeriods)));
    }
  }, [isOpen, activePeriods]);

  if (!isOpen) {return null;}

  return (
    <Modal open={isOpen} onClose={onClose} title={`Configure Period Times – ${dayName} (${selectedDate})`} size="md">
        <div>
          <div className="space-y-3">
            {localPeriods.map((period, idx) => (
              <div
                key={period.id}
                className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-curro-blue border border-gray-200 shadow-sm shrink-0">
                  {period.label}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">
                      Start
                    </label>
                    <input
                      type="time"
                      value={period.start}
                      onChange={(e) => {
                        const newPeriods = [...localPeriods];
                        newPeriods[idx].start = e.target.value;
                        setLocalPeriods(newPeriods);
                      }}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-curro-blue transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">
                      End
                    </label>
                    <input
                      type="time"
                      value={period.end}
                      onChange={(e) => {
                        const newPeriods = [...localPeriods];
                        newPeriods[idx].end = e.target.value;
                        setLocalPeriods(newPeriods);
                      }}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-curro-blue transition-all"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 min-w-[60px]">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                    Break
                  </label>
                  <button
                    onClick={() => {
                      const newPeriods = [...localPeriods];
                      newPeriods[idx].break = !newPeriods[idx].break;
                      setLocalPeriods(newPeriods);
                    }}
                    className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${period.break ? "bg-amber-500" : "bg-gray-200"}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${period.break ? "translate-x-4" : ""}`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onSave(localPeriods, "DATE")}
              className="bg-text-dark text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Date
            </button>
            <button
              onClick={() => onSave(localPeriods, "DAY")}
              className="bg-curro-blue text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <History className="w-4 h-4" />
              Save Daily
            </button>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] font-black text-curro-red uppercase tracking-widest hover:underline text-center"
          >
            Reset to Defaults
          </button>
        </div>
    </Modal>
  );
}

function SubjectsTab({
  subjects,
  teachers,
  entries,
  isSaving,
  onBackup,
}: {
  subjects: Subject[];
  teachers: Teacher[];
  entries: TimetableEntry[];
  isSaving: boolean;
  onBackup?: () => void;
}) {
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSave = async () => {
    if (!newCode || !newName) {return;}
    const normalizedName = normalizeSubjectName(newName);

    // Uniqueness check (Case-insensitive)
    const exists = subjects.some(
      (s) =>
        s.id !== editingId &&
        (s.code.toLowerCase() === newCode.toLowerCase() ||
          s.name.toLowerCase() === normalizedName.toLowerCase()),
    );

    if (exists) {
      toast.error("This subject code or name already exists in the master list.");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "subjects", editingId), {
          code: newCode.toUpperCase(),
          name: normalizedName,
        });
      } else {
        await addDoc(collection(db, "subjects"), {
          code: newCode.toUpperCase(),
          name: normalizedName,
        });
      }
      reset();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "subjects");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      open: true,
      title: "Remove subject",
      message: "Are you sure? This will remove the subject from the master list.",
      variant: "destructive",
      confirmLabel: "Remove",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "subjects", id));
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `subjects/${id}`);
        }
      },
    });
  };

  const reset = () => {
    setNewCode("");
    setNewName("");
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSyncAndLink = () => {
    setConfirmState({
      open: true,
      title: "Sync subjects from faculty + schedule",
      message: "This will populate the Master Subject list from Faculty profiles and the current schedule, then ensure all timetable entries use the normalized names. This may take a moment. Proceed?",
      confirmLabel: "Sync",
      onConfirm: async () => {
        setIsSyncing(true);
        let addedCount = 0;
        let linkedCount = 0;

        try {
      const foundNames = new Set<string>();

      // 1. Collect from Faculty
      if (teachers && Array.isArray(teachers)) {
        teachers.forEach((t) => {
          if (t.subjects && Array.isArray(t.subjects)) {
            t.subjects.forEach((s) => {
              const name = s.name || s.code;
              if (name) {foundNames.add(normalizeSubjectName(name));}
            });
          }
        });
      }

      // 2. Collect from Schedule
      if (entries && Array.isArray(entries)) {
        entries.forEach((e) => {
          if (e.subject) {foundNames.add(normalizeSubjectName(e.subject));}
        });
      }

      // 3. Ensure master list contains all (Sequential to avoid race conditions with onSnapshot)
      const currentSubjectNames = new Set(
        subjects.map((s) => s.name.toLowerCase()),
      );

      for (const name of Array.from(foundNames)) {
        if (!currentSubjectNames.has(name.toLowerCase())) {
          const code = name.slice(0, 4).toUpperCase();
          await addDoc(collection(db, "subjects"), { code, name });
          addedCount++;
          // Add to local set to avoid duplicates if onSnapshot is slow
          currentSubjectNames.add(name.toLowerCase());
        }
      }

      // 4. Link/Update timetable entries (Parallelized for speed)
      if (entries && Array.isArray(entries)) {
        const updatePromises = entries.map(async (entry) => {
          if (!entry.subject) {return;}
          const normName = normalizeSubjectName(entry.subject);
          if (entry.subject !== normName) {
            await updateDoc(doc(db, "timetableEntries", entry.id), {
              subject: normName,
            });
            linkedCount++;
          }
        });
        await Promise.all(updatePromises);
      }

      toast.success(
        `Sync complete. Found ${foundNames.size} unique subjects, added ${addedCount} to the master registry, normalized ${linkedCount} timetable entries.`,
      );
        } catch (e) {
          console.error("Sync Error:", e);
          handleFirestoreError(e, OperationType.WRITE, "subjects/sync");
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  const handleReconstructVisualArt = () => {
    setConfirmState({
      open: true,
      title: "Reconstruct Visual Art sessions",
      message: "This will reconstruct Visual Art sessions for 18-19 June (Thu/Fri) to 8.5 hours starting at 07:50. Proceed?",
      confirmLabel: "Reconstruct",
      onConfirm: async () => {
        try {
          // Find entries that are ALREADY Visual Art on those OR nearby dates
      const targets = ["2026-06-18", "2026-06-19", "2026-06-20"];
      const visualArtEntries = entries.filter(
        (e) =>
          e.subject.toLowerCase().includes("visual art") &&
          targets.includes(e.date),
      );

      if (visualArtEntries.length === 0) {
        toast.error(
          "No Visual Art entries found on 18, 19, or 20 June to reconstruct.",
        );
        return;
      }

      for (const entry of visualArtEntries) {
        let newDate = entry.date;
        // If it was Fri (19) move to Thu (18)
        // If it was Sat (20) move to Fri (19)
        if (entry.date === "2026-06-19") {newDate = "2026-06-18";}
        if (entry.date === "2026-06-20") {newDate = "2026-06-19";}

        await setDoc(
          doc(db, "timetableEntries", entry.id),
          {
            date: newDate,
            durationMinutes: 510, // 8.5 hours
            session: "MORNING",
            paperType: "Prac", // Ensure it's Prac
          },
          { merge: true },
        );

        // Assign Shelton Hu as TECH
        if (entry.venueIds && entry.venueIds.length > 0) {
          const key = `0_${entry.venueIds[0]}_TECH_0`; // Period 0, First venue, TECH role
          await updateDoc(doc(db, "timetableEntries", entry.id), {
            [`invigilatorAssignments.${key}`]: "SHEH"
          });
        } else {
          // If no venue yet, use a manual key
          const key = `0_manual_TECH_0`;
          await updateDoc(doc(db, "timetableEntries", entry.id), {
            [`invigilatorAssignments.${key}`]: "SHEH"
          });
        }
      }
          toast.success("Visual Art reconstruction complete.");
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, "Visual Art Reconstruction");
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-black text-text-dark uppercase tracking-tight text-xs flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              Master Subject List
            </h3>
            <p className="text-[10px] text-text-muted font-bold mt-0.5">
              Define subjects used throughout the program
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-blue-200/50 shadow-sm"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Subject JSON Backup</span>
            </button>
            <button
              onClick={handleReconstructVisualArt}
              className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100"
            >
              Reconstruct Visual Art
            </button>
            <button
              onClick={handleSyncAndLink}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Processing..." : "Sync & Link All"}
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-curro-blue text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-opacity-90 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isAdding || editingId ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 max-w-2xl mx-auto shadow-inner"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-curro-blue uppercase tracking-widest">
                  {editingId ? "Edit Subject" : "New Subject Entry"}
                </h4>
                <button
                  onClick={reset}
                  className="text-text-muted hover:text-text-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MATH"
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={reset}
                  className="px-6 py-2 rounded-lg text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-text-dark transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newCode || !newName || isSaving}
                  className="flex items-center gap-2 px-8 py-2 bg-curro-blue text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          ) : null}

          <div className="space-y-8">
            <div>
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1">
                <Database className="w-3 h-3" />
                Current Master List ({subjects.length})
              </h4>
              <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Code
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Full Subject Name
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjects.length > 0 ? (
                      subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-blue-50/30 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-blue-50 text-curro-blue text-[10px] font-black rounded border border-blue-100">
                                {s.code}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-text-dark">
                                {s.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingId(s.id!);
                                    setNewCode(s.code);
                                    setNewName(s.name);
                                  }}
                                  className="p-1.5 hover:bg-blue-100 text-curro-blue rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(s.id!)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-12 text-center text-text-muted italic text-[10px] uppercase font-black tracking-widest opacity-40"
                        >
                          Empty Master Registry
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Extract Faculty Subjects Preview */}
            <div className="mt-12 bg-gray-50/50 p-8 rounded-[32px] border border-gray-100">
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1">
                <Users className="w-3 h-3" />
                Extracted from Faculty Profiles
              </h4>
              <p className="text-[9px] text-text-muted italic mb-6 ml-1">
                These are the subjects currently defined in the faculty member
                profiles. Use the sync button above to import missing ones into
                the master registry.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from(
                  new Set(
                    teachers
                      .flatMap((t) => t.subjects || [])
                      .map((s) => normalizeSubjectName(s.name || s.code)),
                  ),
                )
                  .sort()
                  .map((name, idx) => {
                    const isInMaster = subjects.some(
                      (ms) => ms.name.toLowerCase() === name.toLowerCase(),
                    );
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border flex flex-col gap-1 ${isInMaster ? "bg-white border-emerald-100" : "bg-white border-gray-200 opacity-60 shadow-inner"}`}
                      >
                        <span className="text-xs font-bold text-text-dark leading-tight">
                          {name}
                        </span>
                        {isInMaster && (
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> IN MASTER
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}

function StatsModal({
  isOpen,
  onClose,
  teachers,
  entries,
  dayPeriodConfigs,
}: {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  entries: TimetableEntry[];
  dayPeriodConfigs: DayPeriodConfig[];
}) {
  const stats = useMemo(() => {
    const dates = [...new Set(entries.map((e) => e.date))].sort();
    if (dates.length === 0) {return [];}

    return teachers
      .map((t) => {
        const name = `${t.firstName} ${t.lastName}`;
        const dailySessions: { [date: string]: number } = {};
        let techSessions = 0;
        
        dates.forEach((date) => (dailySessions[date] = 0));

        entries.forEach((e) => {
          if (!e.invigilatorAssignments) {return;}
          Object.entries(e.invigilatorAssignments).forEach(([key, tid]) => {
            if (tid === t.id) {
              const parts = key.split("_");
              const pIdx = parseInt(parts[0]);
              const role = parts[2];
              
              if (!isNaN(pIdx)) {
                 dailySessions[e.date]++; 
                 if (role === "TECH") {techSessions++;}
              }
            }
          });
        });

        const counts = Object.values(dailySessions);
        const total = counts.reduce((a, b) => a + b, 0);
        const avg = total / dates.length;
        const max = Math.max(...counts);
        const min = Math.min(...counts);

        return {
          id: t.id,
          name,
          avg: avg.toFixed(2),
          max,
          min,
          tech: techSessions,
          total
        };
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [teachers, entries]);

  return (
    <Modal open={isOpen} onClose={onClose} title="Invigilator Stats – Daily Session Distribution" size="lg">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Invigilator</th>
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Avg Daily Sessions</th>
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Max Daily</th>
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Min Daily</th>
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Tech slots</th>
                <th className="pb-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Total Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text-dark">{row.name}</span>
                      <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">{row.id}</span>
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-sm font-black text-curro-blue bg-blue-50 px-3 py-1 rounded-xl">
                      {row.avg}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-sm font-bold text-emerald-600">
                      {row.max}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-sm font-bold text-amber-600">
                      {row.min}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span className={`text-sm font-black ${row.tech > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {row.tech}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-sm font-black text-text-dark">
                      {row.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </Modal>
  );
}
