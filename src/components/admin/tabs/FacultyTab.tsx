import React from "react";
import { Teacher, LeaveRequest } from "../../../types";
import { Users, UserPlus, Download, Search, Shield } from "lucide-react";
import { FacultyRow } from "../shared/FacultyRow";
import { WorkloadBreakdown } from "../shared/types";

export type WorkloadStats = {
  totalRequired: number;
  assigned: { [teacherId: string]: number };
  breakdown: { [teacherId: string]: WorkloadBreakdown };
  minsPerUnit: number;
  totalUnits: number;
  totalConflicts: number;
};

export interface FacultyTabProps {
  // Data
  teachers: Teacher[];
  leaveRequests: LeaveRequest[];
  allSubjects: string[];
  workloadStats: WorkloadStats;

  // State values
  searchTerm: string;
  selectedSubject: string;
  wideLayout: boolean;

  // State setters
  setSearchTerm: (value: string) => void;
  setSelectedSubject: (value: string) => void;
  setIsAddModalOpen: (value: boolean) => void;
  setSelectedTeacherForTimetable: (teacher: Teacher) => void;
  setSelectedTeacherForSubjects: (teacher: Teacher) => void;
  setSelectedTeacherForEdit: (teacher: Teacher) => void;
  setSelectedTeacherForBreakDuty: (teacher: Teacher) => void;
  setSelectedTeacherForHomeRoom: (teacher: Teacher) => void;
  setSelectedTeacherForLeave: (teacher: Teacher) => void;
  setSelectedInspectionTeacherId: (id: string) => void;
  setSelectedInspectionDate: (date: string | null) => void;
  setInspectionView: (view: string) => void;
  setActiveTab: (tab: string) => void;

  // Computed / callbacks
  getTeacherStatus: (t: Teacher) => string | number | null;
  handleFacultyBackup: () => void;
  handleUpdateTeacher: (id: string, updates: Partial<Teacher>) => void;
  handleRemoveTeacher: (teacher: Teacher) => void;
}

export function FacultyTab({
  teachers,
  leaveRequests,
  allSubjects,
  workloadStats,
  searchTerm,
  selectedSubject,
  wideLayout,
  setSearchTerm,
  setSelectedSubject,
  setIsAddModalOpen,
  setSelectedTeacherForTimetable,
  setSelectedTeacherForSubjects,
  setSelectedTeacherForEdit,
  setSelectedTeacherForBreakDuty,
  setSelectedTeacherForHomeRoom,
  setSelectedTeacherForLeave,
  setSelectedInspectionTeacherId,
  setSelectedInspectionDate,
  setInspectionView,
  setActiveTab,
  getTeacherStatus,
  handleFacultyBackup,
  handleUpdateTeacher,
  handleRemoveTeacher,
}: FacultyTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left Column: Teachers List */}
      <div className="bento-card flex flex-col h-[calc(100vh-14rem)] min-h-[600px] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-white uppercase tracking-widest text-[10px] flex items-center gap-3">
              <Users className="w-5 h-5 text-indigo-400" />
              Faculty Directorate
            </h3>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all rounded-lg border border-indigo-500/20"
              title="Add Staff"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleFacultyBackup}
              className="flex items-center gap-2.5 px-4 py-1.5 bg-slate-900 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800 hover:border-slate-700 shadow-sm"
              title="Backup Faculty Data"
            >
              <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Registry</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Find asset..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-white placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 w-32 md:w-48 transition-all outline-none"
              />
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all uppercase tracking-tighter cursor-pointer"
            >
              <option value="ALL">All Specializations</option>
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Workload Stats Summary */}
        <div className="bg-indigo-600/90 relative overflow-hidden px-8 py-6 flex items-center justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="flex items-center gap-10 relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">
                Total Latency Required
              </span>
              <span className="text-2xl font-black text-white leading-tight">
                {workloadStats.totalRequired.toLocaleString()} <span className="text-sm opacity-60">min</span>
              </span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">
                Load Weighting
              </span>
              <span className="text-2xl font-black text-white leading-tight">
                {workloadStats.totalUnits} <span className="text-sm opacity-60">%</span>
              </span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">
                Nominal 100% Load
              </span>
              <span className="text-2xl font-black text-white leading-tight">
                {Math.round(workloadStats.minsPerUnit * 100).toLocaleString()} <span className="text-sm opacity-60">min</span>
              </span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3 bg-slate-950/20 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10 relative z-10">
            <Shield className="w-5 h-5 text-white" />
            <p className="text-[10px] font-bold text-white/90 uppercase tracking-tight max-w-[180px] leading-relaxed">
              Assignments are algorithmically balanced across the faculty grid.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
          {teachers
            .filter((t) => {
              const matchesSearch =
                t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `${t.firstName} ${t.lastName}`
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase());

              const matchesSubject =
                selectedSubject === "ALL" ||
                t.subjects?.some((s) => s.code === selectedSubject);

              return matchesSearch && matchesSubject;
            })
            .sort((a, b) => {
              const lastA = a.lastName.toLowerCase();
              const lastB = b.lastName.toLowerCase();
              if (lastA < lastB) {return -1;}
              if (lastA > lastB) {return 1;}

              const firstA = a.firstName.toLowerCase();
              const firstB = b.firstName.toLowerCase();
              if (firstA < firstB) {return -1;}
              if (firstA > firstB) {return 1;}
              return 0;
            })
            .map((t) => {
              const hasPendingLeave = leaveRequests.some(
                (l) => l.teacherId === t.id && l.status === "PENDING",
              );
              const target = Math.round(
                (t.workloadPercentage ?? 100) * workloadStats.minsPerUnit,
              );
              const breakdown = workloadStats.breakdown[t.id] || {
                morning: 0,
                afternoon: 0,
                tech: 0,
                standby: 0,
              };
              return (
                <FacultyRow
                  key={t.id}
                  teacher={t}
                  hasPendingLeave={hasPendingLeave}
                  currentTeachingGrade={getTeacherStatus(t)}
                  assigned={workloadStats.assigned[t.id] || 0}
                  target={target}
                  breakdown={breakdown}
                  wideMode={wideLayout}
                  onUpdate={handleUpdateTeacher}
                  onBreakDuty={() => setSelectedTeacherForBreakDuty(t)}
                  onHomeRoom={() => setSelectedTeacherForHomeRoom(t)}
                  onLeave={() => setSelectedTeacherForLeave(t)}
                  onSubjects={() => setSelectedTeacherForSubjects(t)}
                  onTimetable={() => setSelectedTeacherForTimetable(t)}
                  onEdit={() => setSelectedTeacherForEdit(t)}
                  onRemove={() => handleRemoveTeacher(t)}
                  onInspect={() => {
                    setSelectedInspectionTeacherId(t.id);
                    setSelectedInspectionDate(null);
                    setInspectionView("TABLE");
                    setActiveTab("INSPECTION");
                  }}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
}
