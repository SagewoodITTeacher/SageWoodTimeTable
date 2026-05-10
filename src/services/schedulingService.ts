import { TimetableEntry, Teacher, Subject, SchedulerSettings } from "../types";
import { 
  isITSpecialistTeacher, 
  isLSSpecialistTeacher, 
  isArtSpecialistTeacher,
  isITorCATSubject,
  isLSSubject,
  isArtSubject,
  isTeacherOnLeaveAtPeriod,
  getTimetableCell,
  resolvePeriodsForDate
} from "../components/admin/shared/helpers";
import { format, parseISO } from "date-fns";

export interface SchedulingResult {
  entries: TimetableEntry[];
  logs: string[];
  stats: {
    totalAssigned: number;
    unfilledSlots: number;
    distribution: Record<string, number>;
  };
}

/**
 * Intelligent scheduling algorithm that implements the user's requested logic.
 * Ported from the provided Python PULP model logic to a TypeScript heuristic.
 */
export async function generateSchedule(
  entries: TimetableEntry[],
  teachers: Teacher[],
  dayPeriodConfigs: any[],
  settings: SchedulerSettings,
  leaveRequests: any[]
): Promise<SchedulingResult> {
  const logs: string[] = [];
  const stats = {
    totalAssigned: 0,
    unfilledSlots: 0,
    distribution: {} as Record<string, number>
  };

  // 1. Prepare data
  const updatedEntries = JSON.parse(JSON.stringify(entries)) as TimetableEntry[];
  const teacherDuties: Record<string, number> = {};
  teachers.forEach(t => {
    teacherDuties[t.id] = 0;
    stats.distribution[t.id] = 0;
  });

  // Count existing duties if we were doing incremental, 
  // but usually we clear and regenerate.
  // For now we assume we start fresh or keep what's manually locked?
  // User asked for "roster generation", implying clearing.
  updatedEntries.forEach(entry => {
    entry.invigilatorAssignments = {};
  });

  // Sort entries by date and session
  updatedEntries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.session === "MORNING" ? -1 : 1;
  });

  // 2. Main Generation Loop
  for (const entry of updatedEntries) {
    const dateStr = entry.date;
    const session = entry.session;
    const subject = entry.subject;
    const grade = entry.grade;
    
    // Determine number of invigilators needed
    // Typically 2 as per user requested REQUIRED_INVIGILATORS_PER_SESSION
    const needed = settings.requiredInvigilatorsPerSession || 2;
    
    // Determine relevant periods for this entry
    const activePeriods = resolvePeriodsForDate(dateStr, dayPeriodConfigs);
    const relevantPIdxs: number[] = [];
    if (session === "MORNING") {
        relevantPIdxs.push(0, 1, 2); // Standard morning slots
    } else {
        relevantPIdxs.push(4, 5, 6); // Standard afternoon slots
    }

    // Identify if it's a specialist subject
    const isSpecialist = isITorCATSubject(subject) || isLSSubject(subject) || isArtSubject(subject);

    for (let slotIdx = 0; slotIdx < needed; slotIdx++) {
      let bestTeacher: Teacher | null = null;
      let minScore = Infinity;

      // Filter eligible teachers
      const eligible = teachers.filter(t => {
        // Hard Constraints:
        // 1. Not on leave in any relevant period
        const onLeave = relevantPIdxs.some(pIdx => 
          isTeacherOnLeaveAtPeriod(t.id, pIdx, dateStr, teachers, leaveRequests, dayPeriodConfigs)
        );
        if (onLeave) return false;

        // 2. Not busy teaching in any relevant period
        const busy = relevantPIdxs.some(pIdx => getTimetableCell(t, pIdx, dateStr) !== null);
        if (busy) return false;

        // 3. Not already assigned to this specific session (one entry per session per teacher)
        // Check if assigned in ANY entry on this date/session
        const alreadyAssignedThisSession = updatedEntries.some(e => 
          e.date === dateStr && 
          e.session === session && 
          Object.values(e.invigilatorAssignments || {}).includes(t.id)
        );
        if (alreadyAssignedThisSession) return false;

        // 4. Max duties per day
        const dailyDuties = updatedEntries.filter(e => 
            e.date === dateStr && Object.values(e.invigilatorAssignments || {}).includes(t.id)
        ).length;
        if (dailyDuties >= (settings.maxDutiesPerDay || 2)) return false;

        // 5. Max total duties
        if (teacherDuties[t.id] >= (settings.maxDutiesPerTeacher || 8)) return false;

        // 6. Specialist Constraint: 
        // If it's a specialist subject, we prefer those specialists.
        // If it's NOT a specialist subject, we don't care (unless user wants them reserved).
        
        return true;
      });

      // Score eligible teachers
      for (const t of eligible) {
        let score = teacherDuties[t.id] * (settings.objectiveWeights?.maxLoad || 100);
        
        // Specialist Match Bonus (Lowers score)
        const isMatch = (isITorCATSubject(subject) && isITSpecialistTeacher(t)) ||
                        (isLSSubject(subject) && isLSSpecialistTeacher(t)) ||
                        (isArtSubject(subject) && isArtSpecialistTeacher(t));
        
        if (isSpecialist) {
          if (isMatch) {
            score -= 1000; // Heavy bonus for right specialist
          } else {
            score += (settings.objectiveWeights?.mismatch || 5) * 100; // Penalty for mismatch
          }
        }

        // Rewarded Teachers (Penalty/Avoidance)
        if (settings.rewardedTeachers?.includes(t.firstName + " " + t.lastName) || settings.rewardedTeachers?.includes(t.id)) {
            score += 500;
        }

        // Add small randomness to break ties and vary results
        score += Math.random() * 5;

        if (score < minScore) {
          minScore = score;
          bestTeacher = t;
        }
      }

      if (bestTeacher) {
        const pIdx = relevantPIdxs[0]; // Simplified: assign to the first period of the session for keying
        const assignmentKey = `${pIdx}_DEFAULT_INVIGILATOR_${slotIdx}`;
        if (!entry.invigilatorAssignments) entry.invigilatorAssignments = {};
        entry.invigilatorAssignments[assignmentKey] = bestTeacher.id;
        teacherDuties[bestTeacher.id]++;
        stats.distribution[bestTeacher.id]++;
        stats.totalAssigned++;
      } else {
        stats.unfilledSlots++;
        logs.push(`Warning: Could not find teacher for ${subject} (Grade ${grade}) on ${dateStr} ${session} Slot ${slotIdx}`);
      }
    }
  }

  logs.push(`Generation complete. Assigned ${stats.totalAssigned} spots. ${stats.unfilledSlots} remain unfilled.`);

  return {
    entries: updatedEntries,
    logs,
    stats
  };
}
