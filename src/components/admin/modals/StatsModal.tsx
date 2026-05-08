import React, { useMemo } from "react";
import { Teacher, TimetableEntry, DayPeriodConfig } from "../../../types";
import { Modal } from "../../ui";

export function StatsModal({
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
