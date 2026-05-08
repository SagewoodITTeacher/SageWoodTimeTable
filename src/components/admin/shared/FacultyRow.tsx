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
      className={`group p-3 px-4 transition-colors ${
        hasPendingLeave
          ? "bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100/60"
          : isOps
            ? "bg-purple-50/40 hover:bg-purple-50/70"
            : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center font-black text-sm transition-all ${
            isOps
              ? "bg-purple-100 text-purple-700 ring-1 ring-purple-200"
              : "bg-bg-gray text-curro-blue group-hover:bg-curro-blue group-hover:text-white"
          }`}
        >
          {t.lastName[0]}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-sm font-black text-text-dark leading-tight truncate max-w-[260px]">
              {t.firstName} {t.lastName}
            </span>
            {t.hasReward && (
              <Gift className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
            )}
            {subjectCode && (
              <span className="text-[10px] font-black text-curro-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">
                {subjectCode}
                {subjectExtra ? ` ${subjectExtra}` : ""}
              </span>
            )}
            {currentTeachingGrade && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border border-emerald-100 shrink-0">
                <Circle className="w-1.5 h-1.5 fill-current animate-pulse" />
                Now Gr {currentTeachingGrade}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium min-w-0 flex-wrap leading-none">
            <span className="font-black uppercase tracking-tighter">
              {t.id}
            </span>
            {t.email && (
              <>
                <span className="text-gray-300">·</span>
                <span
                  className="truncate max-w-[140px]"
                  title={t.email}
                >
                  {t.email}
                </span>
              </>
            )}
            {t.homeRoomGrade && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-indigo-600">
                  HR {t.homeRoomGrade}E{t.homeRoomClass}
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span
              className={`font-black uppercase tracking-tighter ${isMarathon ? "text-orange-600" : isOps ? "text-purple-600" : "text-sky-600"}`}
            >
              {t.invigilationPreference || "SCATTERED"}
            </span>
            {(t.breakDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-rose-600 inline-flex items-center gap-0.5">
                  <Coffee className="w-2.5 h-2.5" />
                  BD {t.breakDutyDates?.length}
                </span>
              </>
            )}
            {(t.afternoonDutyDates?.length || 0) > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="font-black uppercase tracking-tighter text-amber-600 inline-flex items-center gap-0.5">
                  <Clock3 className="w-2.5 h-2.5" />
                  AD {t.afternoonDutyDates?.length}
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span
              className={`font-black uppercase tracking-tighter inline-flex items-center gap-0.5 ${hasHall ? "text-curro-blue" : "text-curro-red"}`}
            >
              {hasHall ? (
                <ShieldCheck className="w-2.5 h-2.5" />
              ) : (
                <ShieldAlert className="w-2.5 h-2.5" />
              )}
              {hasHall ? "Hall" : "Restricted"}
            </span>
          </div>
        </div>

        <WorkloadBar
          breakdown={breakdown}
          assigned={assigned}
          target={target}
          onClick={onInspect}
        />

        <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-1 rounded border border-gray-100 shrink-0">
          <input
            type="number"
            value={t.workloadPercentage ?? 100}
            onChange={(e) =>
              onUpdate(t.id, {
                workloadPercentage: parseInt(e.target.value) || 0,
              })
            }
            className="w-8 bg-transparent text-[10px] font-black text-curro-blue text-right focus:outline-none focus:ring-1 focus:ring-curro-blue rounded border-none p-0"
            title="Workload weighting %"
          />
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
            %
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={cyclePref}
            className={`p-2 rounded-lg transition-all ${
              isMarathon
                ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                : isOps
                  ? "bg-purple-50 text-purple-600 hover:bg-purple-100"
                  : "bg-sky-50 text-sky-600 hover:bg-sky-100"
            }`}
            title={`Preference: ${t.invigilationPreference || "SCATTERED"} (click to cycle)`}
            aria-label="Cycle invigilation preference"
          >
            {isMarathon ? (
              <Clock3 className="w-3.5 h-3.5" />
            ) : isOps ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
            title="Edit profile"
            aria-label="Edit profile"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {wideMode ? (
            <>
              <button
                onClick={() => onUpdate(t.id, { hasReward: !t.hasReward })}
                className={`p-2 rounded-lg transition-colors ${t.hasReward ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "hover:bg-amber-50 text-text-muted hover:text-amber-600"}`}
                title={t.hasReward ? "Disable reward" : "Enable reward"}
                aria-label="Toggle reward"
              >
                <Trophy
                  className={`w-3.5 h-3.5 ${t.hasReward ? "fill-amber-400" : ""}`}
                />
              </button>
              <button
                onClick={() => onUpdate(t.id, { hallPass: !hasHall })}
                className={`p-2 rounded-lg transition-colors ${hasHall ? "bg-blue-50 text-curro-blue hover:bg-blue-100" : "bg-red-50 text-curro-red hover:bg-red-100"}`}
                title={hasHall ? "Restrict hall pass" : "Grant hall pass"}
                aria-label="Toggle hall pass"
              >
                {hasHall ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onBreakDuty}
                className={`p-2 rounded-lg transition-colors ${(t.breakDutyDates?.length || 0) > 0 ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "hover:bg-rose-50 text-text-muted hover:text-rose-600"}`}
                title="Break duty dates"
                aria-label="Break duty dates"
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onHomeRoom}
                className={`p-2 rounded-lg transition-colors ${t.homeRoomGrade ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" : "hover:bg-indigo-50 text-text-muted hover:text-indigo-600"}`}
                title="Home room class"
                aria-label="Home room class"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onLeave}
                className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                title="Schedule leave"
                aria-label="Schedule leave"
              >
                <CalendarOff className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onSubjects}
                className="p-2 hover:bg-blue-50 text-text-muted hover:text-curro-blue rounded-lg transition-colors"
                title="Manage subjects"
                aria-label="Manage subjects"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onTimetable}
                className="p-2 hover:bg-red-50 text-text-muted hover:text-curro-red rounded-lg transition-colors"
                title="Edit timetable"
                aria-label="Edit timetable"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-0.5" />
              <button
                onClick={onRemove}
                className="p-2 hover:bg-red-50 text-text-muted hover:text-red-600 rounded-lg transition-colors"
                title="Remove staff"
                aria-label="Remove staff"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <OverflowMenu
              items={[
                {
                  label: t.hasReward ? "Disable reward" : "Enable reward",
                  icon: (
                    <Trophy
                      className={`w-3.5 h-3.5 ${t.hasReward ? "text-amber-500 fill-amber-400" : ""}`}
                    />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hasReward: !t.hasReward }),
                },
                {
                  label: hasHall ? "Restrict hall pass" : "Grant hall pass",
                  icon: hasHall ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-curro-blue" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-curro-red" />
                  ),
                  onClick: () =>
                    onUpdate(t.id, { hallPass: !hasHall }),
                },
                {
                  label: "Break duty dates",
                  icon: <Coffee className="w-3.5 h-3.5" />,
                  onClick: onBreakDuty,
                },
                {
                  label: "Home room class",
                  icon: <Home className="w-3.5 h-3.5" />,
                  onClick: onHomeRoom,
                },
                {
                  label: "Schedule leave",
                  icon: <CalendarOff className="w-3.5 h-3.5" />,
                  onClick: onLeave,
                },
                {
                  label: "Manage subjects",
                  icon: <BookOpen className="w-3.5 h-3.5" />,
                  onClick: onSubjects,
                },
                {
                  label: "Edit timetable",
                  icon: <Calendar className="w-3.5 h-3.5" />,
                  onClick: onTimetable,
                },
              ]}
              danger={{
                label: "Remove staff",
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: onRemove,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
