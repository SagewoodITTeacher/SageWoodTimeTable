import React, { useState } from "react";
import { Venue } from "../../../types";
import { Save, RefreshCw } from "lucide-react";
import { Modal } from "../../ui";

export function VenueModal({
  venue,
  onClose,
  onSave,
}: {
  venue?: Venue;
  onClose: () => void;
  onSave: (v: Venue) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Venue>>(
    venue || {
      id: "",
      name: "",
      type: "Normal",
      capacity: 25,
    },
  );
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Modal open onClose={onClose} title={venue ? "Edit Venue" : "Add New Venue"} size="sm">
        <div>
          <div className="space-y-5 font-sans">
            <div>
              <label htmlFor="venue-id" className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                Venue ID (e.g. HALL1)
              </label>
              <input
                id="venue-id"
                type="text"
                disabled={!!venue}
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value.toUpperCase() })
                }
                placeholder="Unique ID"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="venue-name" className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                Display Name
              </label>
              <input
                id="venue-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. School Hall"
                className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="venue-type" className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                  Venue Type
                </label>
                <select
                  id="venue-type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none appearance-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Lab">Lab</option>
                  <option value="Hall">Hall</option>
                </select>
              </div>
              <div>
                <label htmlFor="venue-capacity" className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1 block">
                  Capacity
                </label>
                <input
                  id="venue-capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-curro-blue focus:bg-white rounded-2xl px-5 py-4 text-sm font-bold transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-10 font-sans">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl text-sm font-black text-text-muted hover:bg-gray-100 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setIsSaving(true);
                await onSave(formData as Venue);
                setIsSaving(false);
              }}
              disabled={isSaving || !formData.id || !formData.name}
              className="flex-1 bg-curro-blue text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {venue ? "Update" : "Save Venue"}
            </button>
          </div>
        </div>
    </Modal>
  );
}
