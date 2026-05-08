import React, { useState } from "react";
import { Teacher } from "../../../types";
import { AlertCircle, Calendar, Trash2 } from "lucide-react";
import { format, parseISO, startOfToday } from "date-fns";
import { Modal } from "../../ui";

export function BreakDutyModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (breakDates: string[], afternoonDates: string[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [breakDates, setBreakDates] = useState<string[]>(
    teacher.breakDutyDates || [],
  );
  const [afternoonDates, setAfternoonDates] = useState<string[]>(
    teacher.afternoonDutyDates || [],
  );
  const [activeTab, setActiveTab] = useState<"BREAK" | "AFTERNOON">("BREAK");
  const [newDate, setNewDate] = useState(format(startOfToday(), "yyyy-MM-dd"));

  const addDate = () => {
    if (activeTab === "BREAK") {
      if (!breakDates.includes(newDate)) {
        setBreakDates([...breakDates, newDate].sort());
      }
    } else {
      if (!afternoonDates.includes(newDate)) {
        setAfternoonDates([...afternoonDates, newDate].sort());
      }
    }
  };

  const removeDate = (date: string, type: "BREAK" | "AFTERNOON") => {
    if (type === "BREAK") {
      setBreakDates(breakDates.filter((d) => d !== date));
    } else {
      setAfternoonDates(afternoonDates.filter((d) => d !== date));
    }
  };

  const handleSave = () => {
    onSave(breakDates, afternoonDates).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Staff Duties – ${teacher.lastName}`} size="sm">
        <div className="space-y-6">
          <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab("BREAK")}
              className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "BREAK"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-text-muted hover:bg-white/50"
              }`}
            >
              Break Duty
            </button>
            <button
              onClick={() => setActiveTab("AFTERNOON")}
              className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === "AFTERNOON"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-text-muted hover:bg-white/50"
              }`}
            >
              Afternoon Duty
            </button>
          </div>

          <div
            className={`rounded-xl p-4 border flex items-start gap-3 ${
              activeTab === "BREAK"
                ? "bg-amber-50 border-amber-100"
                : "bg-blue-50 border-blue-100"
            }`}
          >
            <AlertCircle
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                activeTab === "BREAK" ? "text-amber-600" : "text-blue-600"
              }`}
            />
            <p
              className={`text-[10px] font-bold leading-relaxed uppercase tracking-tight ${
                activeTab === "BREAK" ? "text-amber-800" : "text-blue-800"
              }`}
            >
              {activeTab === "BREAK"
                ? "Teachers on break duty are automatically blocked from invigilating during ALL breaks on specified dates."
                : "Teachers on afternoon duty are automatically blocked from invigilating during ALL AFTERNOON sessions on specified dates."}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="break-duty-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Add New Date
            </label>
            <div className="flex gap-2">
              <input
                id="break-duty-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={`flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 ${
                  activeTab === "BREAK"
                    ? "focus:ring-amber-500"
                    : "focus:ring-blue-500"
                }`}
              />
              <button
                onClick={addDate}
                className={`px-6 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${
                  activeTab === "BREAK"
                    ? "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                    : "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
                }`}
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Active {activeTab === "BREAK" ? "Break" : "Afternoon"} Duties
            </label>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
              {(activeTab === "BREAK" ? breakDates : afternoonDates).length ===
              0 ? (
                <div className="p-8 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                    No dates assigned
                  </p>
                </div>
              ) : (
                (activeTab === "BREAK" ? breakDates : afternoonDates).map(
                  (date) => (
                    <div
                      key={date}
                      className="flex items-center justify-between p-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar
                          className={`w-3.5 h-3.5 ${
                            activeTab === "BREAK"
                              ? "text-amber-500"
                              : "text-blue-500"
                          }`}
                        />
                        <span className="text-xs font-bold text-text-dark">
                          {format(parseISO(date), "EEEE, do MMM yyyy")}
                        </span>
                      </div>
                      <button
                        onClick={() => removeDate(date, activeTab)}
                        className="p-1.5 text-text-muted hover:text-curro-red hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                activeTab === "BREAK"
                  ? "bg-amber-600 shadow-amber-600/20 hover:bg-opacity-90"
                  : "bg-blue-600 shadow-blue-600/20 hover:bg-opacity-90"
              }`}
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
    </Modal>
  );
}
