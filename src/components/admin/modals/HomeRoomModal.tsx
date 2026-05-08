import React, { useState } from "react";
import { Teacher } from "../../../types";
import { Modal } from "../../ui";

export function HomeRoomModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (grade: number | undefined, cls: number | undefined) => Promise<void>;
  isSaving: boolean;
}) {
  const [grade, setGrade] = useState<number | undefined>(teacher.homeRoomGrade);
  const [cls, setCls] = useState<number | undefined>(teacher.homeRoomClass);

  const handleSave = () => {
    onSave(grade, cls).then(() => onClose());
  };

  const handleClear = () => {
    onSave(undefined, undefined).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Home Room – ${teacher.firstName} ${teacher.lastName}`} size="sm">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Select Grade
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[8, 9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-2 rounded-lg font-black text-xs transition-all ${
                      grade === g
                        ? "bg-indigo-600 text-white shadow-lg scale-105"
                        : "bg-gray-50 text-text-muted hover:bg-gray-100"
                    }`}
                  >
                    Gr {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Select Class
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCls(c)}
                    className={`py-2 rounded-lg font-black text-xs transition-all ${
                      cls === c
                        ? "bg-indigo-600 text-white shadow-lg scale-105"
                        : "bg-gray-50 text-text-muted hover:bg-gray-100"
                    }`}
                  >
                    E{c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !grade || !cls}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "SAVING..." : "SAVE"}
              </button>
            </div>
            {teacher.homeRoomGrade && (
              <button
                onClick={handleClear}
                disabled={isSaving}
                className="w-full py-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear Home Room Assignment
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
}
