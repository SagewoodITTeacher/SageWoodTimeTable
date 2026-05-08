import React, { useState } from "react";
import { Teacher, Subject } from "../../../types";
import { Save, Trash2 } from "lucide-react";
import { Modal } from "../../ui";

export function SubjectsModal({
  teacher,
  onClose,
  onSave,
  isSaving,
  allSubjects,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (u: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
  allSubjects: Subject[];
}) {
  const [subjects, setSubjects] = useState<Subject[]>(teacher.subjects || []);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const addSubject = () => {
    const s = allSubjects.find((sub) => sub.id === selectedSubjectId);
    if (s && subjects.length < 10 && !subjects.some((sub) => sub.id === s.id)) {
      setSubjects([...subjects, s]);
      setSelectedSubjectId("");
    }
  };

  const removeSubject = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  return (
    <Modal open onClose={onClose} title={`${teacher.firstName} ${teacher.lastName} – Subject Specialization`} size="md">
        <div className="space-y-6">
          <div className="space-y-3">
            <label htmlFor="subject-master-list" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 mb-1 block">
              Add Subject from Master List
            </label>
            <div className="flex gap-2">
              <select
                id="subject-master-list"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              >
                <option value="">Select a subject...</option>
                {allSubjects
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((s) => !subjects.some((sub) => sub.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
              </select>
              <button
                onClick={addSubject}
                disabled={subjects.length >= 10 || !selectedSubjectId}
                className="px-6 bg-curro-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-50 hover:bg-opacity-90 transition-all active:scale-95"
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black text-text-muted uppercase tracking-widest px-2">
              <span>Managed Subjects ({subjects.length}/10)</span>
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 max-h-[300px] overflow-auto">
              {subjects.length === 0 ? (
                <div className="p-8 text-center text-text-muted font-bold text-xs uppercase italic tracking-widest opacity-50">
                  No subjects listed for this staff member
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {subjects.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-white/50 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="bg-curro-blue text-white px-2 py-1 rounded text-[10px] font-black tracking-tighter">
                          {s.code}
                        </span>
                        <span className="text-sm font-bold text-text-dark">
                          {s.name}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSubject(i)}
                        className="p-1.5 text-text-muted hover:text-curro-red hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-text-muted font-bold max-w-xs italic leading-tight">
            Subjects are used to prioritize exam assignments based on
            specialization.
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
              onClick={() => onSave({ subjects }).then(() => onClose())}
              className="flex items-center gap-2 px-8 py-2 bg-curro-red text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </div>
    </Modal>
  );
}
