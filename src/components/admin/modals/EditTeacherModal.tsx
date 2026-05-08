import React, { useState } from "react";
import { Teacher } from "../../../types";
import { Modal } from "../../ui";

export function EditTeacherModal({
  teacher,
  onClose,
  onSave,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSave: (t: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    email: teacher.email || "",
    workloadPercentage: teacher.workloadPercentage ?? 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData).then(() => onClose());
  };

  return (
    <Modal open onClose={onClose} title={`Edit Profile – ${teacher.id}`} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="edit-teacher-email" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Email Association
            </label>
            <input
              id="edit-teacher-email"
              type="email"
              placeholder="Assign to Google Account..."
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value.toLowerCase(),
                })
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
            />
            <p className="text-[10px] text-text-muted mt-1 px-1 italic">
              When a user logs in with this email, they will be linked to this
              staff profile.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-teacher-first" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                First Name
              </label>
              <input
                id="edit-teacher-first"
                required
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-teacher-last" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Last Name
              </label>
              <input
                id="edit-teacher-last"
                required
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-teacher-load" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Invigilation Load (%)
            </label>
            <input
              id="edit-teacher-load"
              required
              type="number"
              min="0"
              max="200"
              value={formData.workloadPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  workloadPercentage: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-curro-blue outline-none"
            />
            <p className="text-[10px] text-text-muted mt-1 px-1 italic">
              100% is standard full-time load.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-xs font-black text-text-muted uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-zinc-800 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 border-b-2 border-curro-blue"
            >
              {isSaving ? "UPDATING..." : "UPDATE PROFILE"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
