import React, { useState } from "react";
import {
  Subject,
  Teacher,
  TimetableEntry,
} from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  addDoc,
} from "firebase/firestore";
import { normalizeSubjectName } from "../../../constants";
import {
  BookOpen,
  Download,
  Plus,
  X,
  Save,
  Trash2,
  Database,
  Edit2,
  CheckCircle2,
  Users,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../../ui";
import { motion } from "motion/react";
import { ConfirmFromState } from "../shared/ConfirmFromState";
import { ConfirmState } from "../shared/types";
import { safeFirestoreWrite } from "../shared/helpers";

export function SubjectsTab({
  subjects,
  teachers,
  entries,
  isSaving,
  onBackup,
}: {
  subjects: Subject[];
  teachers: Teacher[];
  entries: TimetableEntry[];
  isSaving: boolean;
  onBackup?: () => void;
}) {
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSave = async () => {
    if (!newCode || !newName) {return;}
    const normalizedName = normalizeSubjectName(newName);

    // Uniqueness check (Case-insensitive)
    const exists = subjects.some(
      (s) =>
        s.id !== editingId &&
        (s.code.toLowerCase() === newCode.toLowerCase() ||
          s.name.toLowerCase() === normalizedName.toLowerCase()),
    );

    if (exists) {
      toast.error("This subject code or name already exists in the master list.");
      return;
    }

    const result = await safeFirestoreWrite(
      async () => {
        if (editingId) {
          await updateDoc(doc(db, "subjects", editingId), {
            code: newCode.toUpperCase(),
            name: normalizedName,
          });
        } else {
          await addDoc(collection(db, "subjects"), {
            code: newCode.toUpperCase(),
            name: normalizedName,
          });
        }
      },
      OperationType.WRITE,
      "subjects",
      handleFirestoreError,
    );
    if (result !== undefined) { reset(); }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      open: true,
      title: "Remove subject",
      message: "Are you sure? This will remove the subject from the master list.",
      variant: "destructive",
      confirmLabel: "Remove",
      onConfirm: async () => {
        await safeFirestoreWrite(
          () => deleteDoc(doc(db, "subjects", id)),
          OperationType.DELETE,
          `subjects/${id}`,
          handleFirestoreError,
        );
      },
    });
  };

  const reset = () => {
    setNewCode("");
    setNewName("");
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSyncAndLink = () => {
    setConfirmState({
      open: true,
      title: "Sync subjects from faculty + schedule",
      message: "This will populate the Master Subject list from Faculty profiles and the current schedule, then ensure all timetable entries use the normalized names. This may take a moment. Proceed?",
      confirmLabel: "Sync",
      onConfirm: async () => {
        setIsSyncing(true);
        let addedCount = 0;
        let linkedCount = 0;

        try {
      const foundNames = new Set<string>();

      // 1. Collect from Faculty
      if (teachers && Array.isArray(teachers)) {
        teachers.forEach((t) => {
          if (t.subjects && Array.isArray(t.subjects)) {
            t.subjects.forEach((s) => {
              const name = s.name || s.code;
              if (name) {foundNames.add(normalizeSubjectName(name));}
            });
          }
        });
      }

      // 2. Collect from Schedule
      if (entries && Array.isArray(entries)) {
        entries.forEach((e) => {
          if (e.subject) {foundNames.add(normalizeSubjectName(e.subject));}
        });
      }

      // 3. Ensure master list contains all (Sequential to avoid race conditions with onSnapshot)
      const currentSubjectNames = new Set(
        subjects.map((s) => s.name.toLowerCase()),
      );

      for (const name of Array.from(foundNames)) {
        if (!currentSubjectNames.has(name.toLowerCase())) {
          const code = name.slice(0, 4).toUpperCase();
          await addDoc(collection(db, "subjects"), { code, name });
          addedCount++;
          // Add to local set to avoid duplicates if onSnapshot is slow
          currentSubjectNames.add(name.toLowerCase());
        }
      }

      // 4. Link/Update timetable entries (Parallelized for speed)
      if (entries && Array.isArray(entries)) {
        const updatePromises = entries.map(async (entry) => {
          if (!entry.subject) {return;}
          const normName = normalizeSubjectName(entry.subject);
          if (entry.subject !== normName) {
            await updateDoc(doc(db, "timetableEntries", entry.id), {
              subject: normName,
            });
            linkedCount++;
          }
        });
        await Promise.all(updatePromises);
      }

      toast.success(
        `Sync complete. Found ${foundNames.size} unique subjects, added ${addedCount} to the master registry, normalized ${linkedCount} timetable entries.`,
      );
        } catch (e) {
          console.error("Sync Error:", e);
          handleFirestoreError(e, OperationType.WRITE, "subjects/sync");
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  const handleReconstructVisualArt = () => {
    setConfirmState({
      open: true,
      title: "Reconstruct Visual Art sessions",
      message: "This will reconstruct Visual Art sessions for 18-19 June (Thu/Fri) to 8.5 hours starting at 07:50. Proceed?",
      confirmLabel: "Reconstruct",
      onConfirm: async () => {
        try {
          // Find entries that are ALREADY Visual Art on those OR nearby dates
      const targets = ["2026-06-18", "2026-06-19", "2026-06-20"];
      const visualArtEntries = entries.filter(
        (e) =>
          e.subject.toLowerCase().includes("visual art") &&
          targets.includes(e.date),
      );

      if (visualArtEntries.length === 0) {
        toast.error(
          "No Visual Art entries found on 18, 19, or 20 June to reconstruct.",
        );
        return;
      }

      for (const entry of visualArtEntries) {
        let newDate = entry.date;
        // If it was Fri (19) move to Thu (18)
        // If it was Sat (20) move to Fri (19)
        if (entry.date === "2026-06-19") {newDate = "2026-06-18";}
        if (entry.date === "2026-06-20") {newDate = "2026-06-19";}

        await setDoc(
          doc(db, "timetableEntries", entry.id),
          {
            date: newDate,
            durationMinutes: 510, // 8.5 hours
            session: "MORNING",
            paperType: "Prac", // Ensure it's Prac
          },
          { merge: true },
        );

        // Assign Shelton Hu as TECH
        if (entry.venueIds && entry.venueIds.length > 0) {
          const key = `0_${entry.venueIds[0]}_TECH_0`; // Period 0, First venue, TECH role
          await updateDoc(doc(db, "timetableEntries", entry.id), {
            [`invigilatorAssignments.${key}`]: "SHEH"
          });
        } else {
          // If no venue yet, use a manual key
          const key = `0_manual_TECH_0`;
          await updateDoc(doc(db, "timetableEntries", entry.id), {
            [`invigilatorAssignments.${key}`]: "SHEH"
          });
        }
      }
          toast.success("Visual Art reconstruction complete.");
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, "Visual Art Reconstruction");
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bento-card overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h3 className="font-black text-indigo-400 uppercase tracking-[0.2em] text-[10px] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                <BookOpen className="w-4 h-4" />
              </div>
              Master Subject List
            </h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest ml-11">
              Define subjects used throughout the program
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup JSON</span>
            </button>
            <button
              onClick={handleReconstructVisualArt}
              className="px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all border border-amber-500/20 shadow-sm"
            >
              Reconstruct VA
            </button>
            <button
              onClick={handleSyncAndLink}
              disabled={isSyncing}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50 border border-emerald-500/20 shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Processing..." : "Sync & Link All"}
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 border border-indigo-400/30"
            >
              <Plus className="w-4 h-4" />
              Add Manual
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {isAdding || editingId ? (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.02] p-8 rounded-[2rem] border border-white/5 mb-10 max-w-2xl mx-auto shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">
                  {editingId ? "Edit Subject" : "New Subject Entry"}
                </h4>
                <button
                  onClick={reset}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="subject-code" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Subject Code
                  </label>
                  <input
                    id="subject-code"
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MATH"
                    className="px-5 py-3.5 bg-slate-950 border border-white/5 rounded-2xl text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-800 font-mono tracking-wider"
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="subject-name" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                    Full Name
                  </label>
                  <input
                    id="subject-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="px-5 py-3.5 bg-slate-950 border border-white/5 rounded-2xl text-sm font-bold text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-white/5 relative z-10">
                <button
                  onClick={reset}
                  className="px-6 py-2.5 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newCode || !newName || isSaving}
                  className="flex items-center gap-2 px-10 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-30 border border-indigo-400/30"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          ) : null}

          <div className="space-y-12">
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3 ml-2">
                <Database className="w-4 h-4" />
                Current Master List ({subjects.length})
              </h4>
              <div className="overflow-hidden border border-white/5 rounded-2xl shadow-2xl bg-white/[0.01]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/5">
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Code
                      </th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Full Subject Name
                      </th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {subjects.length > 0 ? (
                      subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-indigo-500/[0.03] transition-colors group"
                          >
                            <td className="px-8 py-5">
                              <span className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-black rounded-lg border border-indigo-500/20 font-mono tracking-wider">
                                {s.code}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-sm font-bold text-slate-200">
                                {s.name}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={() => {
                                    setEditingId(s.id!);
                                    setNewCode(s.code);
                                    setNewName(s.name);
                                  }}
                                  className="p-2.5 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all border border-transparent hover:border-indigo-500/20"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(s.id!)}
                                  className="p-2.5 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-8 py-20 text-center text-slate-700 italic text-[11px] uppercase font-black tracking-[0.3em]"
                        >
                          Empty Master Registry
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Extract Faculty Subjects Preview */}
            <div className="mt-16 bg-white/[0.01] p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] to-transparent pointer-events-none" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-3 relative z-10">
                <Users className="w-4 h-4" />
                Extracted from Faculty Profiles
              </h4>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] mb-10 relative z-10">
                These are the subjects currently defined in the faculty member
                profiles. Use the sync button above to import missing ones into
                the master registry.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 relative z-10">
                {Array.from(
                  new Set(
                    teachers
                      .flatMap((t) => t.subjects || [])
                      .map((s) => normalizeSubjectName(s.name || s.code)),
                  ),
                )
                  .sort()
                  .map((name, idx) => {
                    const isInMaster = subjects.some(
                      (ms) => ms.name.toLowerCase() === name.toLowerCase(),
                    );
                    return (
                      <div
                        key={idx}
                        className={`p-6 rounded-3xl border transition-all hover:scale-[1.02] flex flex-col gap-2 ${isInMaster ? "bg-white/[0.02] border-indigo-500/20 shadow-lg shadow-indigo-500/5" : "bg-slate-950/20 border-white/5 opacity-50 gray-scale"}`}
                      >
                        <span className="text-xs font-bold text-slate-200 leading-tight">
                          {name}
                        </span>
                        {isInMaster && (
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3" /> REGISTERED
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
