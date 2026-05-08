import React, { useState } from "react";
import { Teacher } from "../../../types";
import { Modal } from "../../ui";

interface TeacherFormModalProps {
  mode: "add" | "edit";
  teacher?: Teacher;
  onClose: () => void;
  onSave: (t: Partial<Teacher>) => Promise<void>;
  isSaving: boolean;
}

export function TeacherFormModal({
  mode,
  teacher,
  onClose,
  onSave,
  isSaving,
}: TeacherFormModalProps) {
  const isAdd = mode === "add";

  const [formData, setFormData] = useState({
    id: teacher?.id || "",
    firstName: teacher?.firstName || "",
    lastName: teacher?.lastName || "",
    email: teacher?.email || "",
    workloadPercentage: teacher?.workloadPercentage ?? 100,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdd) {
      if (formData.id && formData.firstName && formData.lastName) {
        onSave({
          ...formData,
          roles: ["TEACHER"],
          activeRole: "TEACHER",
          totalHours: 0,
          workloadPercentage: formData.workloadPercentage,
        } as any);
      }
    } else {
      onSave(formData).then(() => onClose());
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isAdd ? "Add New Faculty" : `Edit Profile – ${teacher?.id}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isAdd && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="add-teacher-code"
                className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
              >
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
              <label
                htmlFor="add-teacher-email"
                className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
              >
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
        )}

        {!isAdd && (
          <div className="space-y-1">
            <label
              htmlFor="edit-teacher-email"
              className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
            >
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
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label
              htmlFor={isAdd ? "add-teacher-first" : "edit-teacher-first"}
              className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
            >
              First Name
            </label>
            <input
              id={isAdd ? "add-teacher-first" : "edit-teacher-first"}
              required
              type="text"
              placeholder={isAdd ? "Amoré" : undefined}
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none${isAdd ? " placeholder:text-gray-300" : ""}`}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor={isAdd ? "add-teacher-last" : "edit-teacher-last"}
              className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
            >
              Last Name
            </label>
            <input
              id={isAdd ? "add-teacher-last" : "edit-teacher-last"}
              required
              type="text"
              placeholder={isAdd ? "Pienaar" : undefined}
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none${isAdd ? " placeholder:text-gray-300" : ""}`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor={isAdd ? "add-teacher-load" : "edit-teacher-load"}
            className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1"
          >
            Invigilation Load (%)
          </label>
          <input
            id={isAdd ? "add-teacher-load" : "edit-teacher-load"}
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
            {isAdd ? "Cancel" : "Discard"}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`flex-1 text-white rounded-xl py-3 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 ${
              isAdd
                ? "bg-curro-blue shadow-blue-500/20"
                : "bg-zinc-800 shadow-black/20 border-b-2 border-curro-blue"
            }`}
          >
            {isSaving
              ? isAdd
                ? "REGISTERING..."
                : "UPDATING..."
              : isAdd
                ? "REGISTER STAFF"
                : "UPDATE PROFILE"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
