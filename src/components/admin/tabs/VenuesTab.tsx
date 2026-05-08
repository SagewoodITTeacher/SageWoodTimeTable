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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-black text-text-dark uppercase tracking-tight text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-curro-red" />
              Examination Venues
            </h3>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
              Manage halls, labs and standard classrooms
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackup}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-200/50 shadow-sm"
              title="Backup Venue Data"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Venue JSON Backup</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-curro-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Venue
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {venues.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                <Building2 className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-black text-text-dark uppercase tracking-tight">
                No Venues Found
              </h4>
              <p className="text-xs font-medium text-text-muted mt-1">
                Start by adding your first examination venue.
              </p>
            </div>
          ) : (
            venues.map((venue) => (
              <motion.div
                key={venue.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-curro-blue/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                  <button
                    onClick={() => setEditingVenue(venue)}
                    className="p-1.5 hover:bg-gray-100 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(venue.id)}
                    className="p-1.5 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${
                      venue.type === "Lab"
                        ? "bg-purple-50 text-purple-600"
                        : venue.type === "Hall"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-blue-50 text-curro-blue"
                    }`}
                  >
                    {venue.type === "Lab" ? (
                      <FlaskConical className="w-5 h-5" />
                    ) : venue.type === "Hall" ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <School className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-text-dark text-sm uppercase tracking-tight">
                      {venue.name}
                    </h4>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      {venue.type} Venue
                    </span>

                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-text-dark">
                          {venue.capacity}
                        </span>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                          Learners
                        </span>
                      </div>
                      <div className="w-px h-6 bg-gray-100" />
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-curro-blue">
                          ID: {venue.id}
                        </span>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
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
