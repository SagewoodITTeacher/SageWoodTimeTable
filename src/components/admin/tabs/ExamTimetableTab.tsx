import React, { useState } from "react";
import {
  Subject,
  Teacher,
  TimetableEntry,
  Venue,
} from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  CalendarRange,
  Download,
  BookOpen,
  Repeat,
  Clock,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  SquareStack,
  ArrowRightCircle,
} from "lucide-react";
import { parseISO } from "date-fns";
import { TimetableField } from "../shared/TimetableField";
import { isExcludedFromInvigilation, isTeacherRestricted, safeFirestoreWrite } from "../shared/helpers";

export function ExamTimetableTab({
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
    await safeFirestoreWrite(
      () => setDoc(doc(db, "timetableLocks", date), { locked: !isLocked }),
      OperationType.WRITE,
      `timetableLocks/${date}`,
      handleFirestoreError,
    );
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
      !isExcludedFromInvigilation(t),
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
      await safeFirestoreWrite(
        () => deleteDoc(entryRef),
        OperationType.DELETE,
        `timetableEntries/${entryId}`,
        handleFirestoreError,
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

    await safeFirestoreWrite(
      () => setDoc(entryRef, data, { merge: true }),
      OperationType.CREATE,
      `timetableEntries/${entryId}`,
      handleFirestoreError,
    );
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
    await safeFirestoreWrite(
      () => Promise.all(updates),
      OperationType.UPDATE,
      "timetableEntries",
      handleFirestoreError,
    );
  };

  const getTeacherCodes = (subject: string) => {
    if (!subject) {return "";}

    return teachers
      .filter((t) => isTeacherRestricted(t, subject))
      .map((t) => t.id)
      .join(", ");
  };

  const renderSessionBlock = (
    grade: number,
    session: "MORNING" | "AFTERNOON",
    colors: {
      headerText: string;
      headerBg: string;
      btnBorder: string;
      btnText: string;
      btnHover: string;
    },
    sessionLabel: string,
    startTimeNote: string,
    emptyText: string,
    addBtnText: string,
  ) => {
    const sessionEntries = getEntriesForGradeSession(grade, session);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h5 className={`text-[10px] font-black ${colors.headerText} uppercase tracking-widest flex items-center gap-2 ${colors.headerBg} px-2 py-1 rounded`}>
              <Clock className="w-3 h-3" />
              {sessionLabel}
            </h5>
            {(() => {
              if (sessionEntries.length > 1) {
                const mode =
                  sessionEntries[0].sessionMode || "SIMULTANEOUS";
                return (
                  <button
                    onClick={() =>
                      toggleSessionMode(grade, session, sessionEntries)
                    }
                    disabled={isLocked}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
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
          <span className="text-[10px] font-bold text-text-muted bg-white border border-gray-100 px-1.5 py-0.5 rounded uppercase">
            {startTimeNote}
          </span>
        </div>

        <div className="space-y-4">
          {(() => {
            const visibleEntries = isLocked
              ? sessionEntries.filter(
                  (e) => e.subject && e.subject !== "New Subject",
                )
              : sessionEntries;

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
                          session,
                          subj,
                          pap,
                          dur,
                          boys,
                          girls,
                          vIds,
                          entry.id,
                        )
                  }
                  teacherCodes={getTeacherCodes(entry.subject || "")}
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
                  {emptyText}
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
                    session,
                    "New Subject",
                    "Normal",
                    60,
                    0,
                    0,
                    [],
                  )
                }
                className={`flex-1 py-2 border-2 border-dashed ${colors.btnBorder} rounded-xl text-[10px] font-black ${colors.btnText} uppercase tracking-widest ${colors.btnHover} transition-all flex items-center justify-center gap-2`}
              >
                <Plus className="w-3 h-3" />
                {addBtnText}
              </button>
              {sessionEntries.some(
                (e) => !e.subject || e.subject === "New Subject",
              ) && (
                <button
                  onClick={async () => {
                    const emptyEntry = sessionEntries.find(
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
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="bento-card border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
        <div className="bg-white/[0.02] p-8 text-white flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-indigo-400/30">
              <CalendarRange className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black leading-tight uppercase tracking-tight">
                Exam Time Table
              </h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
                Master Schedule Management
              </p>
            </div>
            <button
              onClick={onBackup}
              className="flex items-center gap-2 px-6 py-2.5 bg-white/[0.03] hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 shadow-lg ml-2"
            >
              <Download className="w-4 h-4" />
              Backup JSON
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                Series <span className="opacity-50 font-medium">({currentSeries})</span>
              </span>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-950 border border-white/5 rounded-2xl shadow-inner">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-black text-white">
                  {seriesWorkload}{" "}
                  <span className="text-[10px] text-slate-500 ml-1 uppercase">Mins</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                Invigilation Ratio
              </span>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-950 border border-white/5 rounded-2xl shadow-inner">
                <Repeat className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-black text-white">
                  {invigilationRatio}{" "}
                  <span className="text-[10px] text-slate-500 ml-1 uppercase">X</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
                Daily Workload
              </span>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-950 border border-white/5 rounded-2xl shadow-inner">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black text-white">
                  {totalMinutes}{" "}
                  <span className="text-[10px] text-slate-500 ml-1 uppercase">Mins</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
                Active Date
              </span>
              <div className="flex flex-col items-end gap-3">
                <div className="relative group/date min-w-[180px]">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-slate-950 border border-white/5 group-hover/date:border-indigo-500/30 rounded-xl px-4 py-2.5 text-xs font-black text-white transition-all outline-none w-full shadow-2xl"
                  />
                  <div className="absolute inset-0 rounded-xl ring-2 ring-indigo-500/0 group-hover/date:ring-indigo-500/10 transition-all pointer-events-none" />
                </div>
                <button
                  onClick={toggleLock}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isLocked
                      ? "bg-amber-600 text-white shadow-lg border border-amber-500/50"
                      : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <LockOpen className="w-3.5 h-3.5" />
                  )}
                  {isLocked ? "Schedule Locked" : "Unlocked Mode"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 relative z-10">
          <div className="grid grid-cols-1 gap-12">
            {grades.map((grade) => (
              <div
                key={grade}
                className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] to-transparent pointer-events-none" />
                <div className="flex items-center gap-5 mb-10 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-500/10 border border-indigo-400/30">
                    {grade}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight">
                      Grade {grade} Examination Status
                    </h4>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-1">
                      Daily session control
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
                  {renderSessionBlock(
                    grade,
                    "MORNING",
                    {
                      headerText: "text-emerald-400",
                      headerBg: "bg-emerald-500/10 border border-emerald-500/20",
                      btnBorder: "border-emerald-500/20",
                      btnText: "text-emerald-400",
                      btnHover: "hover:bg-emerald-500/10",
                    },
                    "Morning Session",
                    "08:20 (Arrive 07:50 / 07:30 Gr12)",
                    "No morning exams planned",
                    "Add Morning Subject",
                  )}
                  {renderSessionBlock(
                    grade,
                    "AFTERNOON",
                    {
                      headerText: "text-rose-400",
                      headerBg: "bg-rose-500/10 border border-rose-500/20",
                      btnBorder: "border-rose-500/20",
                      btnText: "text-rose-400",
                      btnHover: "hover:bg-rose-500/10",
                    },
                    "Afternoon Session",
                    "13:20 (Arrive 12:50 / 12:30 Gr12)",
                    "No afternoon exams planned",
                    "Add Afternoon Subject",
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
