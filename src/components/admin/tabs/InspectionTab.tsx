import React from "react";
import { parseISO, format } from "date-fns";
import {
  Search,
  ShieldCheck,
  Zap,
  Clock3,
  ShieldAlert,
  Trash2,
  ClipboardCheck,
  CalendarRange,
  X,
  Users,
} from "lucide-react";
import { Teacher, TimetableEntry, Venue, DayPeriodConfig } from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { InspectionCalendar } from "../shared/InspectionCalendar";
import { ConfirmFromState } from "../shared/ConfirmFromState";
import { ConfirmState } from "../shared/types";
import { resolvePeriodsForDate, periodDurationMinutes } from "../shared/helpers";

export interface InspectionTabProps {
  // Data
  teachers: Teacher[];
  entries: TimetableEntry[];
  dayPeriodConfigs: DayPeriodConfig[];
  venues: Venue[];

  // State values
  selectedInspectionTeacherId: string;
  inspectionView: string;
  selectedInspectionDate: string | null;
  confirmState: ConfirmState;
  isSaving: boolean;

  // State setters
  setSelectedInspectionTeacherId: (id: string) => void;
  setInspectionView: (view: string) => void;
  setSelectedInspectionDate: (date: string | null) => void;
  setConfirmState: (state: ConfirmState) => void;
  setIsSaving: (saving: boolean) => void;
}

export function InspectionTab({
  teachers,
  entries,
  dayPeriodConfigs,
  venues,
  selectedInspectionTeacherId,
  inspectionView,
  selectedInspectionDate,
  confirmState,
  isSaving,
  setSelectedInspectionTeacherId,
  setInspectionView,
  setSelectedInspectionDate,
  setConfirmState,
  setIsSaving,
}: InspectionTabProps) {
  return (
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
                  const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);

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
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded border border-amber-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> [Hall Pass]
                      </span>
                    )}
                    <span className={`px-2 py-1 ${teacher.invigilationPreference === 'SCATTERED' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : teacher.invigilationPreference === 'OPS' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} text-[10px] font-black uppercase tracking-widest rounded border flex items-center gap-1`}>
                      {teacher.invigilationPreference === 'SCATTERED' ? <Zap className="w-3 h-3" /> : teacher.invigilationPreference === 'OPS' ? <ShieldCheck className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                      {teacher.invigilationPreference || 'SCATTERED'}
                    </span>

                    {teacher.invigilationPreference === 'OPS' && teacherAssignments.length > 0 && (
                      <span className="px-2 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-lg animate-pulse flex items-center gap-1">
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
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded shadow-sm flex items-center gap-1 transition-all"
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

                    const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);

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
                        const durationMinutes = period ? periodDurationMinutes(period) : 0;

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
                                <span className={`text-[10px] font-bold uppercase tracking-tighter ${rowBgClass.includes('text-white') ? 'text-white/80' : 'text-text-muted'}`}>{format(parseISO(row!.date), "EEEE")}</span>
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
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
