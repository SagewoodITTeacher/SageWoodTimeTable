/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'WEBMASTER' | 'ADMIN' | 'TEACHER' | 'OPERATIONAL_MANAGER';

export interface Subject {
  id?: string;
  code: string;
  name: string;
}

export interface MarkingExtension {
  id: string;
  entryId: string;
  subject: string;
  grade: number;
  requestDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  mitigationComments?: string;
  additionalGreenDays: number;
  requestedBy: string;
  resolvedBy?: string;
}

export interface Venue {
  id: string;
  name: string;
  type: 'Normal' | 'Lab' | 'Hall';
  capacity: number;
}

export interface TeacherTimetable {
  cycle1: { [key: string]: string[] }; // '0' = Mon, '1' = Tue, etc.
  cycle2: { [key: string]: string[] };
}

export interface Teacher {
  id: string; // The CODE (e.g., AMOP)
  firstName: string;
  lastName: string;
  email?: string;
  roles: Role[];
  activeRole: Role;
  totalHours: number; // For rewards
  uid?: string;
  subjects?: Subject[];
  timetable?: TeacherTimetable;
  breakDutyDates?: string[]; // Array of YYYY-MM-DD strings
  afternoonDutyDates?: string[]; // Array of YYYY-MM-DD strings
  canInvigilate?: boolean;
  invigilationPreference?: 'SCATTERED' | 'MARATHON' | 'OPS';
  workloadPercentage?: number; // e.g. 100 for 100%, 85 for 85%
  homeRoomGrade?: number; // 8-12
  homeRoomClass?: number; // 1-5
  hallPass?: boolean;
  hasReward?: boolean;
}

export interface ExamSession {
  id: string;
  date: string; // ISO format
  subject: string;
  paper: string;
  grade: number;
  location: string;
  startTime: string; // "HH:mm"
  durationMinutes: number;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Assignment {
  id: string;
  sessionId: string;
  teacherId: string;
  type: 'PRIMARY' | 'STANDBY' | 'REPLACEMENT';
  startTimeOffset: number; // minutes from session start (for replacements)
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  date: string;
  type: 'Sick Leave' | 'Arrangement' | 'Special leave';
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface PeriodConfig {
  id: number;
  label: string;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  break?: boolean;
}

export interface DayPeriodConfig {
  id: string; // Day name (e.g. "Wednesday") or specific date
  periods: PeriodConfig[];
  venuesOverridden?: boolean;
}

export interface TimetableEntry {
  id: string; // date_grade_session
  date: string; // YYYY-MM-DD
  grade: number;
  session: 'MORNING' | 'AFTERNOON';
  subject: string;
  venueIds?: string[];
  paperType: 'Normal' | 'P1' | 'P2' | 'Prac' | 'Seminar';
  durationMinutes?: number;
  totalBoys?: number;
  totalGirls?: number;
  totalStudents?: number;
  sessionMode?: 'SIMULTANEOUS' | 'SEQUENTIAL';
  invigilatorAssignments?: {
    [assignmentKey: string]: string; // Key "periodIdx_venueId_role" -> teacherId
  };
  updatedAt?: string; // ISO string
}

export type HelpOption = 'Question Paper Required' | 'Folio required' | 'Toiletpaper required' | 'Bathroom Break' | 'SOS';

export interface HelpRequest {
  id: string;
  venueId: string;
  venueName: string;
  invigilatorId: string;
  invigilatorName: string;
  standbyId: string;
  option: HelpOption;
  quantity?: number;
  subject: string;
  grade: number;
  status: 'PENDING' | 'COMPLETED';
  createdAt: any; // serverTimestamp
}
