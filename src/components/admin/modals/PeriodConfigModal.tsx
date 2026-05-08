import React, { useState } from "react";
import { PeriodConfig } from "../../../types";
import { Save, History } from "lucide-react";
import { Modal } from "../../ui";

export function PeriodConfigModal({
  isOpen,
  onClose,
  activePeriods,
  dayName,
  selectedDate,
  onSave,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  activePeriods: PeriodConfig[];
  dayName: string;
  selectedDate: string;
  onSave: (periods: PeriodConfig[], type: "DAY" | "DATE") => void;
  onReset: () => void;
}) {
  const [localPeriods, setLocalPeriods] = useState<PeriodConfig[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalPeriods(JSON.parse(JSON.stringify(activePeriods)));
    }
  }, [isOpen, activePeriods]);

  if (!isOpen) {return null;}

  return (
    <Modal open={isOpen} onClose={onClose} title={`Configure Period Times – ${dayName} (${selectedDate})`} size="md">
        <div>
          <div className="space-y-3">
            {localPeriods.map((period, idx) => (
              <div
                key={period.id}
                className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-curro-blue border border-gray-200 shadow-sm shrink-0">
                  {period.label}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                      Start
                    </label>
                    <input
                      type="time"
                      value={period.start}
                      onChange={(e) => {
                        const newPeriods = [...localPeriods];
                        newPeriods[idx].start = e.target.value;
                        setLocalPeriods(newPeriods);
                      }}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-curro-blue transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                      End
                    </label>
                    <input
                      type="time"
                      value={period.end}
                      onChange={(e) => {
                        const newPeriods = [...localPeriods];
                        newPeriods[idx].end = e.target.value;
                        setLocalPeriods(newPeriods);
                      }}
                      className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-curro-blue transition-all"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 min-w-[60px]">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    Break
                  </label>
                  <button
                    onClick={() => {
                      const newPeriods = [...localPeriods];
                      newPeriods[idx].break = !newPeriods[idx].break;
                      setLocalPeriods(newPeriods);
                    }}
                    className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${period.break ? "bg-amber-500" : "bg-gray-200"}`}
                  >
                    <div
                      className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${period.break ? "translate-x-4" : ""}`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onSave(localPeriods, "DATE")}
              className="bg-text-dark text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Date
            </button>
            <button
              onClick={() => onSave(localPeriods, "DAY")}
              className="bg-curro-blue text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <History className="w-4 h-4" />
              Save Daily
            </button>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] font-black text-curro-red uppercase tracking-widest hover:underline text-center"
          >
            Reset to Defaults
          </button>
        </div>
    </Modal>
  );
}
