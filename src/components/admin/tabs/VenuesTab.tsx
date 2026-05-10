import React, { useState } from "react";
import { Venue } from "../../../types";
import { db, handleFirestoreError, OperationType } from "../../../firebase";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
} from "firebase/firestore";
import {
  MapPin,
  Download,
  Plus,
  Edit2,
  Trash2,
  Building2,
  FlaskConical,
  School,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VenueModal } from "../modals/VenueModal";
import { ConfirmFromState } from "../shared/ConfirmFromState";
import { ConfirmState } from "../shared/types";
import { safeFirestoreWrite } from "../shared/helpers";

export function VenuesTab({
  venues,
  isSaving: parentSaving,
  onBackup,
}: {
  venues: Venue[];
  isSaving: boolean;
  onBackup?: () => void;
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const handleDelete = (venueId: string) => {
    setConfirmState({
      open: true,
      title: "Delete venue",
      message: "Are you sure you want to delete this venue?",
      variant: "destructive",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await safeFirestoreWrite(
          () => deleteDoc(doc(db, "venues", venueId)),
          OperationType.DELETE,
          `venues/${venueId}`,
          handleFirestoreError,
        );
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-xs font-sans">
      <div className="bento-card overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h3 className="font-black text-indigo-400 uppercase tracking-[0.2em] text-[10px] flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                <MapPin className="w-4 h-4 text-rose-400" />
              </div>
              Examination Venues
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 ml-11">
              Manage halls, labs and standard classrooms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 shadow-sm"
              title="Backup Venue Data"
            >
              <Download className="w-3 link-3" />
              <span className="hidden sm:inline">Backup JSON</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all hover:scale-105 active:scale-95 border border-indigo-400/30"
            >
              <Plus className="w-4 h-4" />
              Add Venue
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
          {venues.length === 0 ? (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-white/[0.02] rounded-[2rem] border border-white/5 flex items-center justify-center mb-6 text-slate-700 shadow-inner">
                <Building2 className="w-10 h-10" />
              </div>
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                No Venues Found
              </h4>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-3">
                Start by adding your first examination venue.
              </p>
            </div>
          ) : (
            venues.map((venue) => (
              <motion.div
                key={venue.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 hover:bg-white/[0.04] transition-all group relative overflow-hidden shadow-xl hover:shadow-indigo-500/5 hover:border-white/10 active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] to-transparent pointer-events-none" />
                <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 z-10 translate-y-2 group-hover:translate-y-0">
                  <button
                    onClick={() => setEditingVenue(venue)}
                    className="p-2.5 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all border border-transparent hover:border-indigo-500/20"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
                    className="p-2.5 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-start gap-5 relative z-10">
                  <div
                    className={`p-4 rounded-2xl border shadow-inner ${
                      venue.type === "Lab"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : venue.type === "Hall"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                    }`}
                  >
                    {venue.type === "Lab" ? (
                      <FlaskConical className="w-6 h-6" />
                    ) : venue.type === "Hall" ? (
                      <Building2 className="w-6 h-6" />
                    ) : (
                      <School className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-white text-sm uppercase tracking-[0.1em] truncate group-hover:text-indigo-400 transition-colors">
                      {venue.name}
                    </h4>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 block">
                      {venue.type} Venue
                    </span>

                    <div className="mt-8 flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-bold text-white">
                          {venue.capacity}
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                          Learners
                        </span>
                      </div>
                      <div className="w-px h-8 bg-white/5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-mono font-bold text-indigo-400 truncate">
                          {venue.id}
                        </span>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                          Static Code
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {(isAddModalOpen || editingVenue) && (
          <VenueModal
            venue={editingVenue || undefined}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingVenue(null);
            }}
            onSave={async (vData) => {
              const result = await safeFirestoreWrite(
                async () => {
                  if (editingVenue) {
                    await updateDoc(
                      doc(db, "venues", editingVenue.id),
                      vData as any,
                    );
                  } else {
                    const venueRef = doc(collection(db, "venues"), vData.id);
                    await setDoc(venueRef, vData);
                  }
                },
                OperationType.WRITE,
                "venues",
                handleFirestoreError,
              );
              if (result !== undefined) {
                setIsAddModalOpen(false);
                setEditingVenue(null);
              }
            }}
          />
        )}
      </AnimatePresence>
      <ConfirmFromState state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
