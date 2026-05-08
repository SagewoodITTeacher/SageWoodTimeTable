import { Teacher, TimetableEntry, DayPeriodConfig } from '../types';
import { resolvePeriodsForDate, periodDurationMinutes, isExcludedFromInvigilation } from '../components/admin/shared/helpers';

export interface WorkloadRow {
  name: string;
  firstName: string;
  lastName: string;
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
  total: number;
  id: string;
  loadWeight: number;
  adjTotal: number;
}

export interface StaffConfig {
  excludedNames: string[];
  specialistIds: string[];
  specialistLoadWeight: number;
}

const DEFAULT_STAFF_CONFIG: StaffConfig = {
  excludedNames: ['merike van dyk'],
  specialistIds: ['FRAN', 'JACB', 'NORT', 'ORMA', 'CHAM', 'EZNY', 'ORIM', 'CPMO', 'ENYA', 'SHEH', 'SHHU'],
  specialistLoadWeight: 0.7,
};

export function computeWorkload(
  entries: TimetableEntry[],
  teachers: Teacher[],
  dayPeriodConfigs: DayPeriodConfig[],
  config: StaffConfig = DEFAULT_STAFF_CONFIG,
): WorkloadRow[] {
  const morning = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const afternoon = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const tech = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const standbyMinutes = Object.fromEntries(teachers.map(t => [t.id, 0]));
  const total = Object.fromEntries(teachers.map(t => [t.id, 0]));

  entries.forEach(entry => {
    if (!entry.invigilatorAssignments) { return; }

    const periodsToUse = resolvePeriodsForDate(entry.date, dayPeriodConfigs);

    Object.entries(entry.invigilatorAssignments).forEach(([key, tid]) => {
      if (!total.hasOwnProperty(tid)) { return; }

      const parts = key.split('_');
      const pIdx = parseInt(parts[0]);
      const vId = parts[1];
      const role = parts[2];

      if (vId !== 'GRADE' && !entry.venueIds?.includes(vId)) { return; }

      const p = periodsToUse[pIdx];
      let duration = entry.durationMinutes || 120;
      if (p) {
        duration = periodDurationMinutes(p);
      }

      if (role === 'STANDBY') {
        standbyMinutes[tid] += duration;
        total[tid] += duration;
      } else if (role === 'TECH') {
        tech[tid] += duration;
        total[tid] += duration;
      } else if (entry.session === 'MORNING') {
        morning[tid] += duration;
        total[tid] += duration;
      } else if (entry.session === 'AFTERNOON') {
        afternoon[tid] += duration;
        total[tid] += duration;
      }
    });
  });

  return teachers
    .filter(t => {
      const isSpecialist = config.specialistIds.includes(t.id);
      return (t.activeRole !== 'WEBMASTER' || isSpecialist) &&
             (t.canInvigilate !== false || isSpecialist) &&
             !isExcludedFromInvigilation(t);
    })
    .map(t => {
      const isSpecialist = config.specialistIds.includes(t.id);
      const loadWeight = isSpecialist ? config.specialistLoadWeight : 1.0;
      return {
        name: `${t.lastName}, ${t.firstName}`,
        firstName: t.firstName,
        lastName: t.lastName,
        morning: morning[t.id],
        afternoon: afternoon[t.id],
        tech: tech[t.id],
        standby: standbyMinutes[t.id],
        total: total[t.id],
        id: t.id,
        loadWeight,
        adjTotal: Math.round(total[t.id] / loadWeight),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
