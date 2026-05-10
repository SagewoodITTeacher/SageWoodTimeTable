import React, { useState } from "react";
import { SchedulerSettings, Teacher, Subject } from "../../../types";
import { Modal } from "../../ui";
import { Save, X, Plus, Trash2, Settings, Calendar, Shield, Users, Clock } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SchedulerSettings;
  teachers: Teacher[];
  subjects: Subject[];
  onSave: (settings: SchedulerSettings) => Promise<void>;
}

export function SchedulerSettingsModal({
  isOpen,
  onClose,
  settings: initialSettings,
  teachers,
  subjects,
  onSave,
}: Props) {
  const [settings, setSettings] = useState<SchedulerSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(settings);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const addTechAssignment = () => {
    setSettings({
      ...settings,
      techAssignments: [...settings.techAssignments, { teacherId: "", subject: "" }],
    });
  };

  const removeTechAssignment = (index: number) => {
    setSettings({
      ...settings,
      techAssignments: settings.techAssignments.filter((_, i) => i !== index),
    });
  };

  const updateTechAssignment = (index: number, teacherId: string, subject: string) => {
    const newAssignments = [...settings.techAssignments];
    newAssignments[index] = { teacherId, subject };
    setSettings({ ...settings, techAssignments: newAssignments });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Scheduler Configuration"
      size="lg"
    >
      <div className="space-y-8 p-1">
        {/* Date Ranges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Grade 12 Range
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={settings.grade12Range.start}
                onChange={(e) => setSettings({ ...settings, grade12Range: { ...settings.grade12Range, start: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="date"
                value={settings.grade12Range.end}
                onChange={(e) => setSettings({ ...settings, grade12Range: { ...settings.grade12Range, end: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Grade 10 & 11 Range
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={settings.grade10_11Range.start}
                onChange={(e) => setSettings({ ...settings, grade10_11Range: { ...settings.grade10_11Range, start: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="date"
                value={settings.grade10_11Range.end}
                onChange={(e) => setSettings({ ...settings, grade10_11Range: { ...settings.grade10_11Range, end: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Grade 8 & 9 Range
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={settings.grade8_9Range.start}
                onChange={(e) => setSettings({ ...settings, grade8_9Range: { ...settings.grade8_9Range, start: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="date"
                value={settings.grade8_9Range.end}
                onChange={(e) => setSettings({ ...settings, grade8_9Range: { ...settings.grade8_9Range, end: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Reserve Range
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={settings.reserveRange.start}
                onChange={(e) => setSettings({ ...settings, reserveRange: { ...settings.reserveRange, start: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <input
                type="date"
                value={settings.reserveRange.end}
                onChange={(e) => setSettings({ ...settings, reserveRange: { ...settings.reserveRange, end: e.target.value } })}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Global Flags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={settings.techManualOnly}
              onChange={(e) => setSettings({ ...settings, techManualOnly: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">Manual Tech Slots</span>
              <span className="text-[10px] text-slate-500">Tech slots can only be manually assigned</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={settings.techTeachersNoInvigilationOnTechDay}
              onChange={(e) => setSettings({ ...settings, techTeachersNoInvigilationOnTechDay: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">Tech Teacher Exemption</span>
              <span className="text-[10px] text-slate-500">Tech teachers don't invigilate on tech days</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={settings.equalizeMinutesWithTechDiscount}
              onChange={(e) => setSettings({ ...settings, equalizeMinutesWithTechDiscount: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">Equalize With Tech Discount</span>
              <span className="text-[10px] text-slate-500">Tech teachers get 20% discount on total load</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={settings.wednesdayHomeroomInvigilation}
              onChange={(e) => setSettings({ ...settings, wednesdayHomeroomInvigilation: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-indigo-600"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight text-slate-900">Wednesday Homerooms</span>
              <span className="text-[10px] text-slate-500">Homeroom teachers invigilate their grade on Wednesdays</span>
            </div>
          </label>
        </div>

        {/* Tech Assignments */}
        <div className="p-6 bg-slate-900 rounded-[2.5rem] border border-slate-800 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
              <Shield className="w-5 h-5 text-indigo-400" />
              Assigned TECH Teachers
            </h4>
            <button
              onClick={addTechAssignment}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add TECH
            </button>
          </div>

          <div className="space-y-3">
            {settings.techAssignments.map((assignment, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-800/50 p-3 rounded-2xl border border-slate-700">
                <div className="md:col-span-5">
                  <select
                    value={assignment.teacherId}
                    onChange={(e) => updateTechAssignment(index, e.target.value, assignment.subject)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.filter(t => t.activeRole !== 'OPERATIONAL_MANAGER').map(t => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.id})</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5">
                  <select
                    value={assignment.subject}
                    onChange={(e) => updateTechAssignment(index, assignment.teacherId, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={() => removeTechAssignment(index)}
                    className="p-2 text-rose-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Load & Pattern */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-5 bg-white border border-slate-200 rounded-[2rem] space-y-4 shadow-sm">
             <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
               <Clock className="w-4 h-4 text-indigo-600" />
               Daily Load Limit (min)
             </div>
             <input
               type="number"
               value={settings.maxDailyMinutes}
               onChange={(e) => setSettings({ ...settings, maxDailyMinutes: parseInt(e.target.value) })}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
             />
           </div>

           <div className="p-5 bg-white border border-slate-200 rounded-[2rem] space-y-4 shadow-sm">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Role Active Range
                </div>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <input
                 type="date"
                 value={settings.roleActiveRange.start}
                 onChange={(e) => setSettings({ ...settings, roleActiveRange: { ...settings.roleActiveRange, start: e.target.value } })}
                 className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
               />
               <input
                 type="date"
                 value={settings.roleActiveRange.end}
                 onChange={(e) => setSettings({ ...settings, roleActiveRange: { ...settings.roleActiveRange, end: e.target.value } })}
                 className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
               />
             </div>
           </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
