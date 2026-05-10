import React, { useMemo } from "react";
import {
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  eachDayOfInterval,
  getDay,
  isSameDay,
  startOfToday,
} from "date-fns";
import { CalendarRange } from "lucide-react";
import { TimetableEntry, DayPeriodConfig } from "../../../types";
import { DayMinutes } from "./types";
import { periodDurationMinutes, resolvePeriodsForDate } from "./helpers";

export const InspectionCalendar: React.FC<{
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
      const datePeriods = resolvePeriodsForDate(entry.date, dayPeriodConfigs);
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
      <div className="py-24 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-slate-950 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl border border-white/5">
          <CalendarRange className="w-10 h-10 text-slate-800" />
        </div>
        <h4 className="text-xl font-black text-white uppercase tracking-tight">No Deployment Data</h4>
        <p className="text-slate-500 text-sm font-medium max-w-xs mx-auto mt-4 leading-relaxed">
          This faculty member has no active session assignments. Run the scheduler to populate logs.
        </p>
      </div>
    );
  }

  const today = startOfToday();
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-2 overflow-y-auto max-h-[calc(100vh-28rem)] min-h-[500px] scrollbar-thin scrollbar-thumb-white/10">
      <div className="flex flex-wrap items-center gap-6 mb-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] bg-slate-900/50 p-4 rounded-xl border border-white/5">
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.4)]" /> Morning
        </span>
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" /> Afternoon
        </span>
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" /> Technical
        </span>
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" /> Standby
        </span>
        <div className="ml-auto flex items-center gap-2 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          <span>Values represent Minutes Assigned</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {monthGrids.map((m) => (
          <div
            key={m.monthKey}
            className="group/month bg-white/[0.01] rounded-[2rem] border border-white/5 p-6 hover:bg-white/[0.02] transition-colors relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] to-transparent pointer-events-none rounded-[2rem]" />
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6 px-1 flex items-center justify-between relative z-10">
              {m.title}
              <div className="h-px flex-1 bg-white/5 ml-4" />
            </h4>
            
            <div className="grid grid-cols-7 gap-2 mb-4 relative z-10">
              {weekDayLabels.map((d) => (
                <div
                  key={d}
                  className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 relative z-10">
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
                      className={`min-h-[72px] rounded-xl flex items-center justify-center text-xs font-black text-slate-800 border border-transparent ${isToday ? "ring-1 ring-indigo-500/30 bg-indigo-500/[0.02]" : ""}`}
                    >
                      {format(d, "d")}
                    </div>
                  );
                }

                const total = bucket.morning + bucket.afternoon + bucket.tech + bucket.standby;
                
                return (
                  <button
                    key={iso}
                    onClick={() => onPickDate(iso)}
                    className={`min-h-[72px] rounded-xl overflow-hidden bg-slate-950/40 border border-white/5 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all flex flex-col group/day relative ${isToday ? "ring-2 ring-indigo-500" : ""}`}
                    title={`${format(d, "EEEE d MMM")} — Total ${total} min`}
                  >
                    <div className="flex items-center justify-between px-2 pt-1.5 pb-1 relative z-10">
                      <span className="text-xs font-black text-white leading-none">
                        {format(d, "d")}
                      </span>
                      <span className="text-[9px] font-black text-slate-500 group-hover/day:text-indigo-400 font-mono leading-none">
                        {total}m
                      </span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-[1px] bg-white/[0.03] mt-auto">
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.morning > 0 ? "bg-indigo-600 text-white" : "bg-transparent text-slate-800"}`}
                        title={`Morning: ${bucket.morning} min`}
                      >
                        {bucket.morning || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.afternoon > 0 ? "bg-emerald-600 text-white" : "bg-transparent text-slate-800"}`}
                        title={`Afternoon: ${bucket.afternoon} min`}
                      >
                        {bucket.afternoon || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.tech > 0 ? "bg-rose-600 text-white" : "bg-transparent text-slate-800"}`}
                        title={`Tech: ${bucket.tech} min`}
                      >
                        {bucket.tech || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[9px] font-black ${bucket.standby > 0 ? "bg-amber-600 text-white" : "bg-transparent text-slate-800"}`}
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
