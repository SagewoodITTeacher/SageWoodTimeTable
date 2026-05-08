import React from "react";
import { Teacher, TimetableEntry, Venue, DayPeriodConfig, LeaveRequest } from "../../../types";
import { PERIODS, WEDNESDAY_PERIODS } from "../../../constants";
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
import { getEntryTimes, getTimetableCell } from "../shared/helpers";

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
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="px-5 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center justify-between">
            <h3 className="font-black text-amber-900 uppercase tracking-tight text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Pending Leave Approvals (
              {leaveRequests.filter((r) => r.status === "PENDING").length}
              )
            </h3>
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-200/50 px-2 py-0.5 rounded-full">
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
                            <span className="text-[10px] font-medium text-amber-800 italic ml-1">
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
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
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
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-95"
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
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "SUMMARY" ? "bg-white text-curro-blue shadow-sm" : "text-text-muted hover:text-text-dark"}`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setAssignmentsSubTab("TABLE")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${assignmentsSubTab === "TABLE" ? "bg-white text-curro-blue shadow-sm" : "text-text-muted hover:text-text-dark"}`}
                >
                  Invigilation Table
                </button>
              </div>
              <button
                onClick={() => setShowStats(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-black text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm active:scale-95"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                STATS
              </button>
              <button
                onClick={handleExportAssignmentsCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black text-text-dark hover:bg-gray-50 transition-all shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                EXPORT CSV
              </button>
              <button
                onClick={() => setEnableCheckMode(!enableCheckMode)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 ${
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
                className="flex items-center gap-2 px-3 py-1.5 bg-curro-blue text-white border border-curro-blue rounded-xl text-[10px] font-black hover:bg-black transition-all shadow-sm active:scale-95"
              >
                <Wand2 className="w-3.5 h-3.5" />
                FIX ERRORS
              </button>
            </div>
          </div>
          {lastUpdatedDate && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
              <History className="w-3 h-3 text-curro-blue" />
              <span className="text-[10px] font-black text-curro-blue uppercase tracking-widest">
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
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">
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
                          <span className={`text-[10px] font-bold uppercase italic ${venueId === "GRADE" ? "text-blue-600" : "text-amber-600"}`}>
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
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border transition-all ${
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
                            <span className="text-[10px] text-text-muted opacity-50 uppercase font-bold italic">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setActiveTab("SCHEDULER")}
                          className="text-curro-blue font-black text-[10px] uppercase tracking-widest hover:bg-curro-blue hover:text-white px-2 py-1.5 rounded-lg border border-blue-100 transition-all active:scale-95 bg-blue-50/50"
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
                            <span className="text-[10px] font-bold uppercase">
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
                            <span className={`text-[10px] font-mono font-bold ${isDarkBg ? 'text-white/80' : 'text-text-muted'}`}>
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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
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
  );
}
