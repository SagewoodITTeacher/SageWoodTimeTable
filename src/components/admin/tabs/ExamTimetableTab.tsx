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
import { FAL_SUBJECTS } from "../../../constants";
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
import { isExcludedFromInvigilation } from "../shared/helpers";

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
                <span className="text-[10px] opacity-60">({currentSeries})</span>
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
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
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
