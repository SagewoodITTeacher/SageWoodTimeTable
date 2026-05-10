import React from "react";
import { Teacher, TimetableEntry, Venue, DayPeriodConfig, LeaveRequest } from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Clock,
  BarChart2,
  Download,
  ShieldAlert,
  Wand2,
  History,
  MapPin,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { getEntryTimes, getTimetableCell, resolvePeriodsForDate, TH_CLASS, safeFirestoreWrite } from "../shared/helpers";

export interface AssignmentsTabProps {
  // Data
  leaveRequests: LeaveRequest[];
  entries: TimetableEntry[];
  teachers: Teacher[];
  venues: Venue[];
  dayPeriodConfigs: DayPeriodConfig[];

  // Computed
  lastUpdatedDate: Date | null;
  conflictMap: { [tId: string]: { [date: string]: { [pIdx: number]: Set<string> } } };

  // State values
  assignmentsSubTab: "SUMMARY" | "TABLE";
  showStats: boolean;
  enableCheckMode: boolean;
  isGenerating: boolean;
  isEqualizing: boolean;

  // State setters
  setAssignmentsSubTab: (value: "SUMMARY" | "TABLE") => void;
  setShowStats: (value: boolean) => void;
  setEnableCheckMode: (value: boolean) => void;
  setActiveTab: (tab: string) => void;

  // Callbacks
  handleExportAssignmentsCSV: () => void;
  handleEqualize: (deepIter?: boolean) => Promise<void>;
}

export function AssignmentsTab({
  leaveRequests,
  entries,
  teachers,
  venues,
  dayPeriodConfigs,
  lastUpdatedDate,
  conflictMap,
  assignmentsSubTab,
  showStats,
  enableCheckMode,
  isGenerating,
  isEqualizing,
  setAssignmentsSubTab,
  setShowStats,
  setEnableCheckMode,
  setActiveTab,
  handleExportAssignmentsCSV,
  handleEqualize,
}: AssignmentsTabProps) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {leaveRequests.some((r) => r.status === "PENDING") && (
        <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="font-bold text-amber-500 uppercase tracking-[0.2em] text-[10px] flex items-center gap-3">
              <AlertCircle className="w-4 h-4" />
              Critical Leave Requisitions (
              {leaveRequests.filter((r) => r.status === "PENDING").length}
              )
            </h3>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Action Required
            </span>
          </div>
          <div className="divide-y divide-white/5">
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
                    className="p-5 flex items-center justify-between hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm shadow-inner">
                        {teacher?.lastName[0] || "?"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-100">
                          {teacher?.firstName} {teacher?.lastName}
                        </span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {format(parseISO(req.date), "EEE, d MMM")}
                          </span>
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 rounded-lg uppercase tracking-widest">
                            {req.type}
                          </span>
                          {req.reason && (
                            <span className="text-[10px] font-medium text-slate-400 italic ml-1">
                              "{req.reason}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          await safeFirestoreWrite(
                            () => updateDoc(
                              doc(db, "leaveRequests", req.id),
                              { status: "APPROVED" },
                            ),
                            OperationType.WRITE,
                            `leaveRequests/${req.id}`,
                            handleFirestoreError,
                          );
                        }}
                        className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg active:scale-95 border border-emerald-500/30"
                      >
                        Authorize
                      </button>
                      <button
                        onClick={async () => {
                          await safeFirestoreWrite(
                            () => updateDoc(
                              doc(db, "leaveRequests", req.id),
                              { status: "DENIED" },
                            ),
                            OperationType.WRITE,
                            `leaveRequests/${req.id}`,
                            handleFirestoreError,
                          );
                        }}
                        className="bg-rose-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-lg active:scale-95 border border-rose-500/30"
                      >
                        Refuse
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="bento-card overflow-hidden flex flex-col min-h-[450px]">
        <div className="px-6 py-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-white/[0.01] gap-6">
          <div className="flex items-center gap-6">
            <h3 className="font-bold text-white uppercase tracking-[0.2em] text-[10px] flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-400" />
              Invigilation Node
            </h3>
            <div className="flex items-center flex-wrap gap-3">
              <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/5 shadow-inner">
                <button
                  onClick={() => setAssignmentsSubTab("SUMMARY")}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "SUMMARY" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Briefing
                </button>
                <button
                  onClick={() => setAssignmentsSubTab("TABLE")}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "TABLE" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Raw Matrix
                </button>
              </div>
              <button
                onClick={() => setShowStats(true)}
                className="flex items-center gap-2.5 px-5 py-2 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-black text-slate-300 hover:text-white hover:border-white/10 transition-all shadow-lg active:scale-95"
              >
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                METRICS
              </button>
              <button
                onClick={handleExportAssignmentsCSV}
                className="flex items-center gap-2.5 px-5 py-2 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-black text-slate-300 hover:text-white hover:border-white/10 transition-all shadow-lg active:scale-95"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                EXPORT
              </button>
              <button
                onClick={() => setEnableCheckMode(!enableCheckMode)}
                className={`flex items-center gap-2.5 px-5 py-2 border rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95 ${
                  enableCheckMode
                    ? "bg-rose-600 text-white border-rose-500 shadow-rose-900/20"
                    : "bg-slate-900 text-slate-300 border-white/5 hover:border-white/10"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                {enableCheckMode ? "HALT PROBE" : "PROBE"}
              </button>
              <button
                onClick={() => handleEqualize(true)}
                disabled={isEqualizing || isGenerating}
                className="flex items-center gap-2.5 px-5 py-2 bg-indigo-600 text-white border border-indigo-500 rounded-xl text-[10px] font-black hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 active:scale-95 group"
              >
                <Wand2 className={`w-4 h-4 group-hover:rotate-12 transition-transform ${isEqualizing ? 'animate-spin' : ''}`} />
                {isEqualizing ? "ADJUSTING..." : "SYNC GRID"}
              </button>
            </div>
          </div>
          {lastUpdatedDate && (
            <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl backdrop-blur-sm">
              <History className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest">
                Pulse: {format(lastUpdatedDate, "d MMM, HH:mm")}
              </span>
            </div>
          )}
        </div>

        {assignmentsSubTab === "SUMMARY" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Temporal
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Specialization
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Latency / Window
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Coordinates (Sector)
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Operatives Assigned
                  </th>
                  <th className={`${TH_CLASS} py-5 text-right text-indigo-400/50`}>
                    Control
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
                      className="hover:bg-white/[0.03] transition-all group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-100">
                            {format(parseISO(entry.date), "EEE, d MMM")}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {entry.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-100 leading-tight">
                            {entry.subject}
                          </span>
                          <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg w-fit mt-1.5 transition-colors group-hover:bg-indigo-500/20">
                            Nexus Gr {entry.grade}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-emerald-400 tracking-tighter mb-1">
                            {getEntryTimes(entry, entries).start}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {entry.durationMinutes || 120}m · {entry.paperType}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {venue ? (
                          <div className="flex items-center gap-2 text-slate-100 font-black text-[10px] uppercase tracking-widest">
                            <MapPin className="w-4 h-4 text-rose-500" />
                            {venue.name}
                          </div>
                        ) : (
                          <span className={`text-[10px] font-bold uppercase tracking-widest italic ${venueId === "GRADE" ? "text-indigo-400" : "text-amber-500"}`}>
                            {venueId === "GRADE" ? `Gr ${entry.grade} Reserve` : (venueId === "manual" ? "Override" : "Sector Unmapped")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          {assignedStaffIds.length > 0 ? (
                            assignedStaffIds.map((tid) => {
                              const t = teachers.find((t) => t.id === tid);
                              const hasConflict = conflictMap[tid]?.[entry.date]
                                ? Object.values(conflictMap[tid][entry.date] as Record<string, Set<string>>).some(sigs => sigs.size > 1)
                                : false;

                              return (
                                <div
                                  key={tid}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    hasConflict
                                      ? "bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg"
                                      : "bg-slate-900 text-slate-300 border-white/5 hover:border-white/10"
                                  }`}
                                  title={t ? `${t.firstName} ${t.lastName}${hasConflict ? ' (COLLISION DETECTED)' : ''}` : tid}
                                >
                                  {t ? `${t.firstName[0]}${t.lastName[0]}` : tid}
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-600 opacity-50 uppercase font-black tracking-widest italic">
                              Undeployed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => setActiveTab("SCHEDULER")}
                          className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.15em] hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl border border-indigo-500/20 transition-all active:scale-95 bg-indigo-500/5 backdrop-blur-sm"
                        >
                          {assignedStaffIds.length > 0 ? "RECONFIGURE" : "DEPLOY"}
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
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Temporal
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Specialization
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Sector
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Nexus Slot
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Operative
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Protocol
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Init
                  </th>
                  <th className={`${TH_CLASS} py-5 text-indigo-400/50`}>
                    Term
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries
                  .flatMap((entry) => {
                    const assignments = entry.invigilatorAssignments || {};
                    return Object.entries(assignments).map(([key, teacherId]) => {
                      const parts = key.split("_");
                      const pIdx = parseInt(parts[0]);
                      const vId = parts[1];
                      const teacher = teachers.find(t => t.id === teacherId);
                      const venue = venues.find(v => v.id === vId);

                      const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);
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
                        invigilator: teacher ? `${teacher.firstName} ${teacher.lastName}` : (teacherId === "REMAINDER_OF_DAY_BUSY" ? "Tech Lockdown" : teacherId),
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

                    let bgClass = "hover:bg-white/[0.03]";
                    if (isError) {bgClass = "bg-rose-600/20 text-white border-l-4 border-rose-500 z-10 relative";}
                    else if (isWarning) {bgClass = "bg-amber-500/20 text-white border-l-4 border-amber-500";}
                    else if (isOPS) {bgClass = "bg-rose-900/40 text-rose-100 border-l-4 border-rose-600/50";}
                    else if (isScattered) {bgClass = "bg-sky-500/5 text-sky-100 border-l-4 border-sky-500/30";}
                    else if (isMarathon) {bgClass = "bg-amber-500/5 text-amber-100 border-l-4 border-amber-500/30";}

                    return (
                      <tr key={row.id} className={`${bgClass} transition-all duration-300 border-b border-white/5`}>
                        <td className="px-6 py-5 text-[10px] font-bold text-slate-100">
                          {format(parseISO(row.date), "EEE, d MMM")}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkBg ? 'text-white' : 'text-indigo-400'}`}>
                              Nexus Gr {row.grade}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              {row.subject}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                          {row.venueName}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkBg ? 'text-white' : 'text-emerald-400'}`}>
                              {row.periodLabel}
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${isDarkBg ? 'text-white/80' : 'text-slate-600'}`}>
                              {row.periodTime}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-100 flex items-center gap-3">
                          {row.invigilator}
                          {isError && <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />}
                          {isWarning && <Zap className="w-4 h-4 text-amber-500" />}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border ${
                            isDarkBg ? 'bg-white/10 text-white border-white/20' :
                            isScattered ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {row.role}
                          </span>
                        </td>
                        <td className={`px-6 py-5 text-[10px] font-mono font-bold ${isDarkBg ? 'text-white' : 'text-emerald-400'}`}>
                          {row.examStart}
                        </td>
                        <td className={`px-6 py-5 text-[10px] font-mono font-bold ${isDarkBg ? 'text-white' : 'text-slate-400'}`}>
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

      {/* Grid Status Section */}
      <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -mr-48 -mt-48 group-hover:bg-white/20 transition-all duration-700"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="text-2xl font-black mb-2 flex items-center gap-4">
              Nexus Load Balancer
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] animate-pulse" />
            </h4>
            <p className="text-white/60 font-bold text-[10px] uppercase tracking-[0.3em] leading-relaxed">
              Autonomous Resource Allocation & Stability Protocol
            </p>
          </div>
          <button className="bg-slate-950 text-white hover:bg-black px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 border border-white/5">
            GENERATE DIAGNOSTIC
          </button>
        </div>
      </div>
    </div>
  );
}
