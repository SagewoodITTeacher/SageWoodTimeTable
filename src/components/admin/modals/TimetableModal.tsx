import React, { useState } from "react";
import { Teacher, TeacherTimetable } from "../../../types";
import { PERIODS, SHORT_DAYS } from "../../../constants";
import { Save } from "lucide-react";
import { Modal } from "../../ui";

export function TimetableModal({
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
                    <span className="text-[10px] font-mono font-bold text-text-muted leading-none">
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
