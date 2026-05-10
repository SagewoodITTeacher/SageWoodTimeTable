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
import { resolvePeriodsForDate, periodDurationMinutes, safeFirestoreWrite } from "../shared/helpers";

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
      <div className="bento-card border border-white/5 shadow-2xl overflow-hidden mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
        <div className="bg-white/[0.02] p-8 text-white flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-indigo-400/30 backdrop-blur-md">
              <Search className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">Staff Inspection</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Detailed Invigilation Audit & Load Summary</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col md:flex-row md:items-end gap-6 max-w-4xl">
            <div className="flex-1 space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Target Faculty Profile</label>
              <div className="relative group">
                <select
                  value={selectedInspectionTeacherId}
                  onChange={(e) => setSelectedInspectionTeacherId(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 group-hover:border-indigo-500/30 rounded-xl px-5 py-3.5 text-white font-bold text-sm outline-none transition-all cursor-pointer shadow-2xl appearance-none"
                >
                  <option value="" className="text-slate-600 bg-slate-900">--- Select Resource ---</option>
                  {teachers
                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                    .map((t) => (
                      <option key={t.id} value={t.id} className="text-white bg-slate-900">
                        {t.lastName}, {t.firstName} ({t.id})
                      </option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </div>

            {selectedInspectionTeacherId && (
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">View Mode</label>
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-white/5 shadow-inner">
                  <button
                    onClick={() => setInspectionView("TABLE")}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      inspectionView === "TABLE"
                        ? "bg-indigo-600 text-white shadow-lg border border-indigo-400/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" /> Table
                  </button>
                  <button
                    onClick={() => {
                      setInspectionView("CALENDAR");
                      setSelectedInspectionDate(null);
                    }}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      inspectionView === "CALENDAR"
                        ? "bg-indigo-600 text-white shadow-lg border border-indigo-400/30"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <CalendarRange className="w-3.5 h-3.5" /> Calendar
                  </button>
                </div>
              </div>
            )}
            
            {selectedInspectionTeacherId && inspectionView === "TABLE" && selectedInspectionDate && (
              <button
                onClick={() => setSelectedInspectionDate(null)}
                className="px-6 py-3 bg-amber-600/10 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-amber-500/20 shadow-lg hover:bg-amber-600 hover:text-white mb-0.5"
              >
                <X className="w-3.5 h-3.5" /> Reset Dates
              </button>
            )}
          </div>
        </div>

        <div className="p-8 relative z-10">
          {selectedInspectionTeacherId && (() => {
            const teacher = teachers.find(t => t.id === selectedInspectionTeacherId);
            if (!teacher) { return null; }

            const teacherAssignments = entries.flatMap((entry) => {
              if (!entry.invigilatorAssignments) { return []; }
              const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);
              return Object.entries(entry.invigilatorAssignments)
                .filter(([_, tId]) => tId === selectedInspectionTeacherId)
                .map(([key, _]) => {
                  const pIdx = parseInt(key.split("_")[0]);
                  const period = datePeriods[pIdx] || (datePeriods.length > 0 ? datePeriods[0] : null);
                  if (!period) { return null; }
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
              <div className="flex flex-wrap items-center gap-3 mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                {teacher.hallPass && (
                  <span className="px-4 py-1.5 bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-amber-500/20 flex items-center gap-2 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5" /> Hall Specialist
                  </span>
                )}
                <span className={`px-4 py-1.5 ${
                  teacher.invigilationPreference === 'SCATTERED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 
                  teacher.invigilationPreference === 'OPS' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                } text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border flex items-center gap-2 shadow-sm`}>
                  {teacher.invigilationPreference === 'SCATTERED' ? <Zap className="w-3.5 h-3.5" /> : 
                   teacher.invigilationPreference === 'OPS' ? <ShieldCheck className="w-3.5 h-3.5" /> : 
                   <Clock3 className="w-3.5 h-3.5" />}
                  {teacher.invigilationPreference || 'SCATTERED'} Mode
                </span>

                {teacher.invigilationPreference === 'OPS' && teacherAssignments.length > 0 && (
                  <span className="px-4 py-1.5 bg-rose-600/10 text-rose-500 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-rose-500/20 animate-pulse flex items-center gap-2 shadow-sm">
                    <ShieldAlert className="w-3.5 h-3.5" /> Ops Load Conflict
                  </span>
                )}

                {hasDuplicates && (
                  <button
                    onClick={() => setConfirmState({
                      open: true,
                      title: "Remove duplicate assignments",
                      message: "Remove all exact time/subject duplicates for this teacher?",
                      variant: "destructive",
                      confirmLabel: "Resolve",
                      onConfirm: async () => {
                        setIsSaving(true);
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
                          batch.update(doc(db, "timetableEntries", eid), { invigilatorAssignments: newAss });
                        }
                        await safeFirestoreWrite(() => batch.commit(), OperationType.UPDATE, "entries", handleFirestoreError);
                        setIsSaving(false);
                      },
                    })}
                    className="px-4 py-1.5 bg-amber-600 text-white font-black text-[9px] uppercase tracking-[0.2em] rounded-lg shadow-lg hover:bg-amber-500 flex items-center gap-2 transition-all border border-amber-400/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Force Resolution
                  </button>
                )}
              </div>
            );
          })()}

          {!selectedInspectionTeacherId ? (
            <div className="py-24 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-950 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl border border-white/5">
                <Users className="w-10 h-10 text-slate-800" />
              </div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tight">Access Staff Logs</h4>
              <p className="text-slate-500 text-sm font-medium max-w-sm mx-auto mt-4 leading-relaxed">
                Review complete invigilation history and load distribution. Select a faculty profile to begin.
              </p>
            </div>
          ) : inspectionView === "CALENDAR" ? (
            <div className="bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-8 shadow-inner ring-1 ring-white/5">
              <InspectionCalendar
                teacherId={selectedInspectionTeacherId}
                entries={entries}
                dayPeriodConfigs={dayPeriodConfigs}
                onPickDate={(d) => {
                  setSelectedInspectionDate(d);
                  setInspectionView("TABLE");
                }}
              />
            </div>
          ) : (
            <div className="bg-slate-950/40 rounded-[2.5rem] border border-white/5 shadow-inner ring-1 ring-white/5 overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-28rem)] min-h-[500px] scrollbar-thin scrollbar-thumb-white/10">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20 bg-slate-900 border-b border-white/10">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deployment Date</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Time Window</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Subject/Entry</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Venue Asset</th>
                      <th className="px-8 py-5 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] text-center bg-indigo-500/5">AM Load</th>
                      <th className="px-8 py-5 text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] text-center bg-emerald-500/5">PM Load</th>
                      <th className="px-8 py-5 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center bg-amber-500/5">Standby</th>
                      <th className="px-8 py-5 text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] text-center bg-rose-500/5">Tech</th>
                      <th className="px-4 py-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-slate-950/20">
                    {(() => {
                      const teacherAssignments = entries.flatMap((entry) => {
                        if (!entry.invigilatorAssignments) { return []; }
                        const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);
                        return Object.entries(entry.invigilatorAssignments)
                          .filter(([_, tId]) => tId === selectedInspectionTeacherId)
                          .map(([key, _]) => {
                            const parts = key.split("_");
                            const pIdx = parseInt(parts[0]);
                            const vId = parts[1];
                            const role = parts[2];
                            const period = datePeriods[pIdx] || (datePeriods.length > 0 ? datePeriods[0] : null);
                            if (!period) { return null; }
                            const venue = venues.find(v => v.id === vId);
                            const durationMinutes = periodDurationMinutes(period);
                            const isTech = key.includes("_TECH") || role === "TECH" || role === "TECHNICAL";
                            const isStandby = vId === "GRADE" || key.includes("_STANDBY") || role === "STANDBY";
                            return {
                              entryId: entry.id, assignmentKey: key, date: entry.date,
                              startTime: period.start, endTime: period.end, subject: entry.subject,
                              paperType: entry.paperType, grade: entry.grade,
                              venueName: venue?.name || (vId === "GRADE" ? "Grade Standby" : (isTech ? "Tech Support" : vId)),
                              morningMin: !isStandby && !isTech && entry.session === "MORNING" ? durationMinutes : 0,
                              afternoonMin: !isStandby && !isTech && entry.session === "AFTERNOON" ? durationMinutes : 0,
                              standbyMin: isStandby ? durationMinutes : 0,
                              techMin: isTech ? durationMinutes : 0, pIdx
                            };
                          }).filter(Boolean);
                      }).sort((a, b) => a!.date.localeCompare(b!.date) || a!.startTime.localeCompare(b!.startTime))
                        .filter((ta) => !selectedInspectionDate || ta!.date === selectedInspectionDate);

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
                      const teacher = teachers.find(t => t.id === selectedInspectionTeacherId);
                      const preference = teacher?.invigilationPreference || 'SCATTERED';

                       return (
                        <>
                          {teacherAssignments.map((row, idx) => {
                            const dateIndex = uniqueDates.indexOf(row!.date);
                            const isEvenDay = dateIndex % 2 === 0;
                            const tag = `${row!.date}|${row!.startTime}|${row!.endTime}|${row!.subject}|${row!.paperType}`;
                            const isDuplicate = (duplicateTags.get(tag) || 0) > 1;
                            const prev = idx > 0 ? teacherAssignments[idx - 1] : null;
                            const isSequential = prev && prev.date === row!.date && prev.endTime === row!.startTime;

                            let rowBgClass = isEvenDay ? "bg-white/[0.02]" : "bg-transparent";
                            let textClass = "text-slate-300";

                            if (isDuplicate) {
                              rowBgClass = "bg-amber-500/10";
                              textClass = "text-amber-400";
                            } else if (isSequential) {
                              if (preference === "SCATTERED") {
                                rowBgClass = "bg-rose-500/10";
                                textClass = "text-rose-400";
                              } else {
                                rowBgClass = "bg-emerald-500/10";
                                textClass = "text-emerald-400";
                              }
                            }

                            return (
                              <tr key={`${row!.date}-${row!.assignmentKey}-${idx}`} className={`${rowBgClass} transition-all hover:bg-indigo-500/[0.05] group/row`}>
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-black ${textClass}`}>{format(parseISO(row!.date), "dd MMM yyyy")}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover/row:text-slate-500 mt-1">{format(parseISO(row!.date), "EEEE")}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-sm font-mono font-black text-slate-400">
                                  {row!.startTime} <span className="text-slate-700 mx-2">—</span> {row!.endTime}
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-bold ${textClass}`}>{row!.subject}</span>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 bg-white/5 px-2 py-0.5 rounded border border-white/5">Grade {row!.grade}</span>
                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{row!.paperType}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className={`px-8 py-5 text-sm font-black uppercase tracking-tight ${rowBgClass.includes('rose') || rowBgClass.includes('amber') ? textClass : 'text-indigo-400'}`}>
                                  {row!.venueName}
                                </td>
                                <td className={`px-8 py-5 text-sm font-black text-center bg-indigo-500/[0.02] ${row!.morningMin > 0 ? "text-indigo-400" : "text-slate-800"}`}>
                                  {row!.morningMin || "—"}
                                </td>
                                <td className={`px-8 py-5 text-sm font-black text-center bg-emerald-500/[0.02] ${row!.afternoonMin > 0 ? "text-emerald-400" : "text-slate-800"}`}>
                                  {row!.afternoonMin || "—"}
                                </td>
                                <td className={`px-8 py-5 text-sm font-black text-center bg-amber-500/[0.02] ${row!.standbyMin > 0 ? "text-amber-500" : "text-slate-800"}`}>
                                  {row!.standbyMin || "—"}
                                </td>
                                <td className={`px-8 py-5 text-sm font-black text-center bg-rose-500/[0.02] ${row!.techMin > 0 ? "text-rose-400" : "text-slate-800"}`}>
                                  {row!.techMin || "—"}
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <button
                                    onClick={() => setConfirmState({
                                      open: true,
                                      title: "Remove assignment",
                                      message: "Are you sure you want to remove this specific assignment?",
                                      variant: "destructive",
                                      confirmLabel: "Delete",
                                      onConfirm: async () => {
                                        setIsSaving(true);
                                        const entry = entries.find(e => e.id === row!.entryId);
                                        if (entry && entry.invigilatorAssignments) {
                                          const newAssIdx = { ...entry.invigilatorAssignments };
                                          delete newAssIdx[row!.assignmentKey];
                                          await safeFirestoreWrite(() => updateDoc(doc(db, "timetableEntries", row!.entryId), { invigilatorAssignments: newAssIdx }), OperationType.UPDATE, "entries", handleFirestoreError);
                                        }
                                        setIsSaving(false);
                                      },
                                    })}
                                    className="p-2 hover:bg-rose-500/20 rounded-xl text-rose-500/30 hover:text-rose-500 transition-all shadow-sm"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-900/80 sticky bottom-0 z-10 backdrop-blur-md border-t border-white/10">
                            <td colSpan={4} className="px-8 py-8 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Consolidated Load Output (Min)
                            </td>
                            <td className="px-8 py-8 text-lg font-black text-indigo-400 text-center bg-indigo-500/5">{totals.morning}</td>
                            <td className="px-8 py-8 text-lg font-black text-emerald-400 text-center bg-emerald-500/5">{totals.afternoon}</td>
                            <td className="px-8 py-8 text-lg font-black text-amber-500 text-center bg-amber-500/5">{totals.standby}</td>
                            <td className="px-8 py-8 text-lg font-black text-rose-400 text-center bg-rose-500/5">{totals.tech}</td>
                            <td></td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
      </div>
    </div>
  );
}
