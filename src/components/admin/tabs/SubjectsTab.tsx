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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-black text-text-dark uppercase tracking-tight text-xs flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              Master Subject List
            </h3>
            <p className="text-[10px] text-text-muted font-bold mt-0.5">
              Define subjects used throughout the program
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-blue-200/50 shadow-sm"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Subject JSON Backup</span>
            </button>
            <button
              onClick={handleReconstructVisualArt}
              className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100"
            >
              Reconstruct Visual Art
            </button>
            <button
              onClick={handleSyncAndLink}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50 border border-emerald-100"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Processing..." : "Sync & Link All"}
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-curro-blue text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-opacity-90 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {isAdding || editingId ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 max-w-2xl mx-auto shadow-inner"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-curro-blue uppercase tracking-widest">
                  {editingId ? "Edit Subject" : "New Subject Entry"}
                </h4>
                <button
                  onClick={reset}
                  className="text-text-muted hover:text-text-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="subject-code" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Subject Code
                  </label>
                  <input
                    id="subject-code"
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MATH"
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="subject-name" className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input
                    id="subject-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-curro-blue outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={reset}
                  className="px-6 py-2 rounded-lg text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-text-dark transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!newCode || !newName || isSaving}
                  className="flex items-center gap-2 px-8 py-2 bg-curro-blue text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </motion.div>
          ) : null}

          <div className="space-y-8">
            <div>
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1">
                <Database className="w-3 h-3" />
                Current Master List ({subjects.length})
              </h4>
              <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Code
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest">
                        Full Subject Name
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjects.length > 0 ? (
                      subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-blue-50/30 transition-colors group"
                          >
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-blue-50 text-curro-blue text-[10px] font-black rounded border border-blue-100">
                                {s.code}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-text-dark">
                                {s.name}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingId(s.id!);
                                    setNewCode(s.code);
                                    setNewName(s.name);
                                  }}
                                  className="p-1.5 hover:bg-blue-100 text-curro-blue rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(s.id!)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-12 text-center text-text-muted italic text-[10px] uppercase font-black tracking-widest opacity-40"
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
            <div className="mt-12 bg-gray-50/50 p-8 rounded-[32px] border border-gray-100">
              <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ml-1">
                <Users className="w-3 h-3" />
                Extracted from Faculty Profiles
              </h4>
              <p className="text-[10px] text-text-muted italic mb-6 ml-1">
                These are the subjects currently defined in the faculty member
                profiles. Use the sync button above to import missing ones into
                the master registry.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                        className={`p-4 rounded-2xl border flex flex-col gap-1 ${isInMaster ? "bg-white border-emerald-100" : "bg-white border-gray-200 opacity-60 shadow-inner"}`}
                      >
                        <span className="text-xs font-bold text-text-dark leading-tight">
                          {name}
                        </span>
                        {isInMaster && (
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> IN MASTER
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
