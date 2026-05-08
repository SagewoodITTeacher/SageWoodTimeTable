import React, { useState } from "react";
import { TimetableEntry, Venue } from "../../../types";
import { Save, Trash2, CheckCircle2, RefreshCw, Building2 } from "lucide-react";

export interface TimetableFieldProps {
  entry?: TimetableEntry;
  grade: number | string;
  onSave: (
    subject: string,
    paperType: TimetableEntry["paperType"],
    duration: number,
    boys: number,
    girls: number,
    venueIds?: string[],
  ) => Promise<void>;
  teacherCodes: string;
  paperTypes: TimetableEntry["paperType"][];
  allSubjects: string[];
  venues: Venue[];
  isLocked?: boolean;
}

export const TimetableField: React.FC<TimetableFieldProps> = ({
  entry,
  grade,
  onSave,
  teacherCodes,
  paperTypes,
  allSubjects,
  venues,
  isLocked,
}) => {
  const [subject, setSubject] = useState(entry?.subject || "");
  const [paperType, setPaperType] = useState<TimetableEntry["paperType"]>(
    entry?.paperType || "Normal",
  );
  const [duration, setDuration] = useState<number>(entry?.durationMinutes || 0);
  const [boys, setBoys] = useState<number>(entry?.totalBoys || 0);
  const [girls, setGirls] = useState<number>(entry?.totalGirls || 0);
  const [venueIds, setVenueIds] = useState<string[]>(entry?.venueIds || []);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync with prop when entry changes
  React.useEffect(() => {
    if (entry) {
      setSubject(entry.subject);
      setPaperType(entry.paperType);
      setDuration(entry.durationMinutes || 0);
      setBoys(entry.totalBoys || 0);
      setGirls(entry.totalGirls || 0);
      setVenueIds(entry.venueIds || []);
    } else {
      setSubject("");
      setPaperType("Normal");
      setDuration(0);
      setBoys(0);
      setGirls(0);
      setVenueIds([]);
    }
    setIsUpdating(false);
  }, [entry]);

  const handleInternalSave = async () => {
    setIsUpdating(true);
    await onSave(subject, paperType, duration, boys, girls, venueIds);
  };

  const toggleVenue = (vId: string) => {
    setVenueIds((prev) =>
      prev.includes(vId)
        ? prev.filter((id) => id !== vId)
        : prev.length < 8
          ? [...prev, vId]
          : prev,
    );
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 group relative hover:border-curro-blue/30 transition-all">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-4 py-2.5 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
            >
              <option value="">Select Subject...</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {subject && !allSubjects.includes(subject) && (
                <option key={subject} value={subject}>{subject}</option>
              )}
            </select>
          </div>
          <div className="w-32 flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Type
            </label>
            <select
              value={paperType}
              onChange={(e) => setPaperType(e.target.value as any)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2.5 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all uppercase tracking-tighter disabled:opacity-50"
            >
              {paperTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Duration (Min)
            </label>
            <input
              type="number"
              value={duration || ""}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Boys
            </label>
            <input
              type="number"
              value={boys || ""}
              onChange={(e) => setBoys(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Girls
            </label>
            <input
              type="number"
              value={girls || ""}
              onChange={(e) => setGirls(parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-full bg-bg-gray border border-transparent rounded-xl px-3 py-2 text-xs font-bold text-text-dark focus:bg-white focus:border-curro-blue outline-none transition-all disabled:opacity-50"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
              Total
            </label>
            <div className="w-full bg-blue-50 border border-blue-100 text-blue-600 rounded-xl px-3 py-2 text-xs font-black flex items-center justify-center">
              {boys + girls}
            </div>
          </div>
        </div>

        {grade === 12 &&
          !paperType?.toLowerCase().includes("prac") && (
            <div className="mt-1 text-[10px] font-black text-curro-red uppercase tracking-tight flex items-center gap-1.5 bg-red-50 p-2 rounded-xl border border-red-100 italic">
              <Building2 className="w-3 h-3" />
              Hall / Assembly Required for Grade 12
            </div>
          )}
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
          Assigned Venues (Max 8)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {venues.map((v) => {
            const isSelected = venueIds.includes(v.id);
            return (
              <button
                key={v.id}
                onClick={() => toggleVenue(v.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-curro-blue text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-100"
                    : "bg-gray-100 text-text-muted hover:bg-gray-200"
                }`}
              >
                {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-col">
          <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-1">
            Staff Restricted
          </label>
          <div className="flex flex-wrap gap-1">
            {teacherCodes ? (
              teacherCodes.split(", ").map((code) => (
                <span
                  key={code}
                  className="text-[10px] font-black text-curro-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                >
                  {code}
                </span>
              ))
            ) : (
              <span className="text-[10px] font-bold text-text-muted italic opacity-50 text-[10px]">
                No matches...
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {entry && (
            <button
              onClick={() => onSave("", "Normal", 0, 0, 0)}
              className="p-2 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear entry"
              disabled={isUpdating || isLocked}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleInternalSave}
            disabled={isUpdating || !subject || isLocked}
            className={`min-w-[100px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
              isUpdating || isLocked
                ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-curro-blue text-white hover:bg-blue-700 shadow-blue-500/20"
            }`}
          >
            {isUpdating ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {entry ? "Update" : "Save"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
