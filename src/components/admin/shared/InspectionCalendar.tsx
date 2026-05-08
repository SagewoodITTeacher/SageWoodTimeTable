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
                  className="text-[10px] font-black text-text-muted uppercase tracking-widest text-center py-1"
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
                      <span className="text-[10px] font-black text-text-muted leading-none">
                        {total}m
                      </span>
                    </div>
                    <div className="grid grid-cols-2 grid-rows-2 flex-1 gap-px mt-0.5 bg-gray-100">
                      <div
                        className={`flex items-center justify-center text-[10px] font-black ${bucket.morning > 0 ? "bg-curro-blue text-white" : "bg-blue-50 text-blue-200"}`}
                        title={`Morning: ${bucket.morning} min`}
                      >
                        {bucket.morning || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[10px] font-black ${bucket.afternoon > 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-200"}`}
                        title={`Afternoon: ${bucket.afternoon} min`}
                      >
                        {bucket.afternoon || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[10px] font-black ${bucket.tech > 0 ? "bg-curro-red text-white" : "bg-red-50 text-red-200"}`}
                        title={`Tech: ${bucket.tech} min`}
                      >
                        {bucket.tech || ""}
                      </div>
                      <div
                        className={`flex items-center justify-center text-[10px] font-black ${bucket.standby > 0 ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-200"}`}
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
