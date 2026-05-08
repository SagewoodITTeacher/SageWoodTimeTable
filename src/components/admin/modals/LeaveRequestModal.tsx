import React, { useState } from "react";
import { Teacher, LeaveRequest } from "../../../types";
import { Calendar, Clock, Trash2, ClipboardCheck, CalendarRange } from "lucide-react";
import { format, parseISO, startOfToday } from "date-fns";
import { Modal } from "../../ui";
import { INPUT_CLASS } from "../shared/helpers";

export function LeaveRequestModal({
  teacher,
  onClose,
  user,
  requests,
  onSave,
  onUpdateStatus,
  onDelete,
  isSaving,
}: {
  teacher: Teacher;
  onClose: () => void;
  user: Teacher;
  requests: LeaveRequest[];
  onSave: (req: Omit<LeaveRequest, "id">) => Promise<void>;
  onUpdateStatus: (id: string, status: "APPROVED" | "DENIED") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<
    Omit<LeaveRequest, "id" | "status" | "teacherId">
  >({
    date: format(startOfToday(), "yyyy-MM-dd"),
    type: "Sick Leave",
    isFullDay: true,
    startTime: "07:50",
    endTime: "14:30",
    reason: "",
  });

  const isAdmin =
    user.roles.includes("ADMIN") || user.roles.includes("WEBMASTER");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      teacherId: teacher.id,
      status: "PENDING",
    });
  };

  return (
    <Modal open onClose={onClose} title={`Schedule Leave – ${teacher.firstName} ${teacher.lastName}`} size="md">
        <div className="grid grid-cols-1 md:grid-cols-2 -mx-6 -my-6">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 border-r border-gray-100"
          >
            <div className="space-y-1">
              <label htmlFor="leave-date" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Leave Date
              </label>
              <input
                id="leave-date"
                required
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="leave-type" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Leave Type
              </label>
              <select
                id="leave-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
                className={INPUT_CLASS}
              >
                <option value="Sick Leave">Sick Leave</option>
                <option value="Arrangement">Arrangement</option>
                <option value="Special leave">Special leave</option>
              </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <input
                type="checkbox"
                id="fullDay"
                checked={formData.isFullDay}
                onChange={(e) =>
                  setFormData({ ...formData, isFullDay: e.target.checked })
                }
                className="w-4 h-4 rounded text-curro-blue focus:ring-curro-blue"
              />
              <label
                htmlFor="fullDay"
                className="text-xs font-bold text-text-dark uppercase tracking-tight"
              >
                Full Day Leave
              </label>
            </div>

            {!formData.isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="leave-start-time" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Start Time
                  </label>
                  <input
                    id="leave-start-time"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="leave-end-time" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    End Time
                  </label>
                  <input
                    id="leave-end-time"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="leave-reason" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                Reason (Optional)
              </label>
              <textarea
                id="leave-reason"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                className={`${INPUT_CLASS} min-h-[80px] resize-none`}
                placeholder="Mention reasons..."
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-curro-blue text-white rounded-xl py-4 font-black text-xs uppercase tracking-widest shadow-xl shadow-curro-blue/20 hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50 border-b-4 border-curro-red"
            >
              {isSaving ? "Submitting..." : "Apply for Leave"}
            </button>
          </form>

          {/* List */}
          <div className="bg-gray-50/50 p-6 flex flex-col h-full overflow-hidden">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-3 h-3" />
              Recent History
            </h4>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {requests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
                  <CalendarRange className="w-12 h-12 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    No Leave Found
                  </p>
                </div>
              ) : (
                requests
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 rounded-2xl border ${
                        req.status === "APPROVED"
                          ? "bg-white border-emerald-100"
                          : req.status === "DENIED"
                            ? "bg-white border-red-100"
                            : "bg-amber-50 border-amber-200 shadow-md transition-all hover:scale-[1.02]"
                      } group`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                          {req.type}
                        </span>
                        <div
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                            req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.status === "DENIED"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700 font-bold animate-pulse"
                          }`}
                        >
                          {req.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3 h-3 text-text-muted" />
                        <span className="text-xs font-black text-text-dark">
                          {format(parseISO(req.date), "EEE, d MMM")}
                        </span>
                      </div>
                      {req.isFullDay ? (
                        <span className="text-[10px] font-bold text-text-muted ml-5 italic">
                          Full Day
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 ml-5">
                          <Clock className="w-2.5 h-2.5 text-text-muted" />
                          <span className="text-[10px] font-bold text-text-muted">
                            {req.startTime} - {req.endTime}
                          </span>
                        </div>
                      )}

                      {isAdmin && req.status === "PENDING" && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => onUpdateStatus(req.id, "APPROVED")}
                            className="flex-1 bg-emerald-600 text-white rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onUpdateStatus(req.id, "DENIED")}
                            className="flex-1 bg-red-600 text-white rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                          >
                            Deny
                          </button>
                        </div>
                      )}

                      <div className="mt-2 text-right">
                        <button
                          onClick={() => onDelete(req.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
    </Modal>
  );
}
