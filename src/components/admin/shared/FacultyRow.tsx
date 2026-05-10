import React from "react";
import {
  Gift,
  Circle,
  Coffee,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Edit2,
  Trophy,
  Home,
  CalendarOff,
  BookOpen,
  Calendar,
  Trash2,
} from "lucide-react";
import { Teacher } from "../../../types";
import { WorkloadBreakdown } from "./types";
import { WorkloadBar } from "./WorkloadBar";
import { OverflowMenu, OverflowItem } from "./OverflowMenu";

export type FacultyRowProps = {
  teacher: Teacher;
  hasPendingLeave: boolean;
  currentTeachingGrade: string | number | null;
  assigned: number;
  target: number;
  breakdown: WorkloadBreakdown;
  wideMode?: boolean;
  onUpdate: (id: string, updates: Partial<Teacher>) => void;
  onBreakDuty: () => void;
  onHomeRoom: () => void;
  onLeave: () => void;
  onSubjects: () => void;
  onTimetable: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onInspect?: () => void;
};

export const FacultyRow: React.FC<FacultyRowProps> = ({
  teacher: t,
  hasPendingLeave,
  currentTeachingGrade,
  assigned,
  target,
  breakdown,
  wideMode = false,
  onUpdate,
  onBreakDuty,
  onHomeRoom,
  onLeave,
  onSubjects,
  onTimetable,
  onEdit,
  onRemove,
  onInspect,
}) => {
  const isOps = t.invigilationPreference === "OPS";
  const isMarathon = t.invigilationPreference === "MARATHON";
  const isMerikeVanDyk =
    t.firstName.toLowerCase().includes("merike") &&
    t.lastName.toLowerCase().includes("van dyk");
  const hasHall = t.hallPass ?? !isMerikeVanDyk;
  const subjectCode = t.subjects?.[0]?.code;
  const subjectExtra =
    (t.subjects?.length ?? 0) > 1
      ? `+${(t.subjects?.length ?? 0) - 1}`
      : null;

  const cyclePref = () => {
    let next: "SCATTERED" | "MARATHON" | "OPS" = "SCATTERED";
    if (t.invigilationPreference === "SCATTERED") {
      next = "MARATHON";
    } else if (t.invigilationPreference === "MARATHON") {
      next = "OPS";
    } else {
      next = "SCATTERED";
    }
    const updates: Partial<Teacher> = { invigilationPreference: next };
    if (next === "OPS") {
      updates.workloadPercentage = 0;
      updates.canInvigilate = false;
      updates.hallPass = false;
    } else if (t.invigilationPreference === "OPS") {
      updates.workloadPercentage = 100;
      updates.canInvigilate = true;
    }
    onUpdate(t.id, updates);
  };

  return (
    <div
      className={`group p-4 px-6 transition-all border-l-4 ${
        hasPendingLeave
          ? "bg-amber-500/10 border-amber-500 hover:bg-amber-500/20"
          : isOps
            ? "bg-purple-500/10 border-purple-500/50 hover:bg-purple-500/20"
            : "border-transparent hover:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-5">
        <div
          className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-300 shadow-inner border border-white/5 ${
            isOps
              ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
              : "bg-slate-900 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110"
          }`}
        >
          {t.lastName[0]}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="text-sm font-bold text-slate-100 leading-tight truncate group-hover:text-white transition-colors">
              {t.firstName} {t.lastName}
            </span>
            {t.hasReward && (
              <Gift className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
            )}
            {subjectCode && (
              <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg uppercase tracking-widest shrink-0">
                {subjectCode}
                {subjectExtra ? ` ${subjectExtra}` : ""}
              </span>
            )}
            {currentTeachingGrade && (
              <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shrink-0">
                <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                Live: Gr {currentTeachingGrade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium min-w-0 flex-wrap leading-none">
            <span className="font-black uppercase tracking-widest text-slate-400">
              {t.id}
            </span>
            {t.email && (
              <>
                <span className="text-slate-800">·</span>
                <span
                  className="truncate max-w-[160px] hover:text-slate-300 transition-colors cursor-help"
                  title={t.email}
                >
                  {t.email}
                </span>
              </>
            )}
            {t.homeRoomGrade && (
              <>
                <span className="text-slate-800">·</span>
                <span className="font-black uppercase tracking-widest text-indigo-400">
                  Nexus Gr {t.homeRoomGrade}E{t.homeRoomClass}
                </span>
              </>
            )}
            <span className="text-slate-800">·</span>
            <span
              className={`font-black uppercase tracking-widest ${isMarathon ? "text-amber-500" : isOps ? "text-purple-400" : "text-sky-400"}`}
            >
              {t.invigilationPreference || "SCATTERED"}
            </span>
            {(t.breakDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-slate-800">·</span>
                <span className="font-black uppercase tracking-widest text-rose-500 inline-flex items-center gap-1">
                  <Coffee className="w-3 h-3" />
                  {t.breakDutyDates?.length}
                </span>
              </>
            )}
            {(t.afternoonDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-slate-800">·</span>
                <span className="font-black uppercase tracking-widest text-amber-500 inline-flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  {t.afternoonDutyDates?.length}
                </span>
              </>
            )}
            <span className="text-slate-800">·</span>
            <span
              className={`font-black uppercase tracking-widest inline-flex items-center gap-1 ${hasHall ? "text-indigo-400" : "text-rose-500"}`}
            >
              {hasHall ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <ShieldAlert className="w-3 h-3" />
              )}
              {hasHall ? "Nexus Access" : "Restricted"}
            </span>
          </div>
        </div>

        <WorkloadBar
          breakdown={breakdown}
          assigned={assigned}
          target={target}
          onClick={onInspect}
        />

        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-xl border border-white/5 shrink-0 hover:border-indigo-500/50 transition-colors group/input">
          <input
            type="number"
            value={t.workloadPercentage ?? 100}
            onChange={(e) =>
              onUpdate(t.id, {
                workloadPercentage: parseInt(e.target.value) || 0,
              })
            }
            className="w-8 bg-transparent text-[10px] font-black text-indigo-400 text-right focus:outline-none focus:text-indigo-300 rounded border-none p-0"
            title="Workload weighting %"
          />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            %
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={cyclePref}
            className={`p-2.5 rounded-xl transition-all duration-300 border border-transparent shadow-lg ${
              isMarathon
                ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white hover:border-amber-400"
                : isOps
                  ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white hover:border-purple-400"
                  : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-400"
            }`}
            title={`Preference: ${t.invigilationPreference || "SCATTERED"} (click to cycle)`}
            aria-label="Cycle invigilation preference"
          >
            {isMarathon ? (
              <Clock3 className="w-4 h-4" />
            ) : isOps ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shadow-lg"
            title="Edit profile"
            aria-label="Edit profile"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {wideMode ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdate(t.id, { hasReward: !t.hasReward })}
                className={`p-2.5 rounded-xl transition-all border ${t.hasReward ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white" : "bg-slate-900 border-white/5 text-slate-500 hover:text-amber-500 hover:border-amber-500/50"}`}
                title={t.hasReward ? "Disable reward" : "Enable reward"}
                aria-label="Toggle reward"
              >
                <Trophy
                  className={`w-4 h-4 ${t.hasReward ? "fill-current" : ""}`}
                />
              </button>
              <button
                onClick={() => onUpdate(t.id, { hallPass: !hasHall })}
                className={`p-2.5 rounded-xl transition-all border ${hasHall ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500 hover:text-white" : "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white"}`}
                title={hasHall ? "Restrict hall access" : "Grant hall access"}
                aria-label="Toggle hall access"
              >
                {hasHall ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onBreakDuty}
                className={`p-2.5 rounded-xl transition-all border ${(t.breakDutyDates?.length || 0) > 0 ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white" : "bg-slate-900 border-white/5 text-slate-500 hover:text-rose-500 hover:border-rose-500/50"}`}
                title="Break duty dates"
                aria-label="Break duty dates"
              >
                <Coffee className="w-4 h-4" />
              </button>
              <button
                onClick={onHomeRoom}
                className={`p-2.5 rounded-xl transition-all border ${t.homeRoomGrade ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500 hover:text-white" : "bg-slate-900 border-white/5 text-slate-500 hover:text-indigo-500 hover:border-indigo-500/50"}`}
                title="Home room class"
                aria-label="Home room class"
              >
                <Home className="w-4 h-4" />
              </button>
              <button
                onClick={onLeave}
                className="p-2.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-500 hover:text-indigo-400 rounded-xl transition-all"
                title="Schedule leave"
                aria-label="Schedule leave"
              >
                <CalendarOff className="w-4 h-4" />
              </button>
              <button
                onClick={onSubjects}
                className="p-2.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-500 hover:text-indigo-400 rounded-xl transition-all"
                title="Manage subjects"
                aria-label="Manage subjects"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={onTimetable}
                className="p-2.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-500 hover:text-rose-500 rounded-xl transition-all"
                title="Edit timetable"
                aria-label="Edit timetable"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <div className="w-[2px] h-6 bg-white/5 mx-1" />
              <button
                onClick={onRemove}
                className="p-2.5 bg-slate-950 border border-rose-500/20 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 rounded-xl transition-all shadow-inner"
                title="Decommission Staff"
                aria-label="Remove staff"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <OverflowMenu
              items={[
                {
                  label: t.hasReward ? "Disable reward" : "Enable reward",
                  icon: (
                    <Trophy
                      className={`w-4 h-4 ${t.hasReward ? "text-amber-500 fill-amber-400" : ""}`}
                    />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hasReward: !t.hasReward }),
                },
                {
                  label: hasHall ? "Restrict hall access" : "Grant hall access",
                  icon: hasHall ? (
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hallPass: !hasHall }),
                },
                {
                  label: "Break duty dates",
                  icon: <Coffee className="w-4 h-4" />,
                  onClick: onBreakDuty,
                },
                {
                  label: "Home room class",
                  icon: <Home className="w-4 h-4" />,
                  onClick: onHomeRoom,
                },
                {
                  label: "Schedule leave",
                  icon: <CalendarOff className="w-4 h-4" />,
                  onClick: onLeave,
                },
                {
                  label: "Manage subjects",
                  icon: <BookOpen className="w-4 h-4" />,
                  onClick: onSubjects,
                },
                {
                  label: "Edit timetable",
                  icon: <Calendar className="w-4 h-4" />,
                  onClick: onTimetable,
                },
              ]}
              danger={{
                label: "Decommission Staff",
                icon: <Trash2 className="w-4 h-4" />,
                onClick: onRemove,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
