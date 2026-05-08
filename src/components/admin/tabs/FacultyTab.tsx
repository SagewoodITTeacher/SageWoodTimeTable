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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-[calc(100vh-14rem)] min-h-[600px] overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-text-dark uppercase tracking-tight text-xs flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Faculty Members
            </h3>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-1 hover:bg-curro-blue hover:text-white text-curro-blue transition-colors rounded"
              title="Add Staff"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFacultyBackup}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-amber-200/50 shadow-sm"
              title="Backup Faculty Data"
            >
              <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Faculty JSON Backup</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Find staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-curro-blue w-28 md:w-36 transition-all"
              />
            </div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-white border border-gray-100 text-[10px] font-bold rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-curro-blue outline-none transition-all uppercase tracking-tighter"
            >
              <option value="ALL">All Subjects</option>
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Workload Stats Summary */}
        <div className="bg-curro-blue px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                Total Slot Minutes Required
              </span>
              <span className="text-lg font-black text-white leading-tight">
                {workloadStats.totalRequired.toLocaleString()} min
              </span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                Weighting Units
              </span>
              <span className="text-lg font-black text-white leading-tight">
                {workloadStats.totalUnits} %
              </span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                Min per 100% Load
              </span>
              <span className="text-lg font-black text-white leading-tight">
                {Math.round(workloadStats.minsPerUnit * 100).toLocaleString()} min
              </span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl backdrop-blur-sm border border-white/10">
            <Shield className="w-4 h-4 text-white/80" />
            <p className="text-[10px] font-bold text-white/90 uppercase tracking-tight max-w-[150px] leading-tight">
              Load is balanced dynamically across all faculty based on weighting.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
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
