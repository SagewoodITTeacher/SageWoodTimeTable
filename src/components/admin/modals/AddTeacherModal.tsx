import React, { useState } from "react";
import { Teacher } from "../../../types";
import { Modal } from "../../ui";

export function AddTeacherModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (t: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    workloadPercentage: 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id && formData.firstName && formData.lastName) {
      onSave({
        ...formData,
        roles: ["TEACHER"],
        activeRole: "TEACHER",
        totalHours: 0,
        workloadPercentage: formData.workloadPercentage,
      } as any);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add New Faculty" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="add-teacher-code" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Staff Code
              </label>
              <input
                id="add-teacher-code"
                required
                type="text"
                placeholder="e.g. AMOP"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value.toUpperCase() })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-teacher-email" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Email (Optional)
              </label>
              <input
                id="add-teacher-email"
                type="email"
                placeholder="teacher@curro.co.za"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value.toLowerCase(),
                  })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="add-teacher-first" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                First Name
              </label>
              <input
                id="add-teacher-first"
                required
                type="text"
                placeholder="Amoré"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="add-teacher-last" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Last Name
              </label>
              <input
                id="add-teacher-last"
                required
                type="text"
                placeholder="Pienaar"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none placeholder:text-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="add-teacher-load" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
              Invigilation Load (%)
            </label>
            <input
              id="add-teacher-load"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-curro-blue text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? "REGISTERING..." : "REGISTER STAFF"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
