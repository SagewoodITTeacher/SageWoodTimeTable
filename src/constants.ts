import { PeriodConfig } from './types';

export const PERIODS: PeriodConfig[] = [
  { id: 1, start: '07:50', end: '08:40', label: 'P1' },
  { id: 2, start: '08:40', end: '09:30', label: 'P2' },
  { id: 3, start: '09:30', end: '10:20', label: 'P3' },
  { id: 4, start: '10:20', end: '10:40', label: 'B1', break: true },
  { id: 5, start: '10:40', end: '11:30', label: 'P4' },
  { id: 6, start: '11:30', end: '12:20', label: 'P5' },
  { id: 7, start: '12:20', end: '13:10', label: 'P6' },
  { id: 8, start: '13:10', end: '13:40', label: 'B2', break: true },
  { id: 9, start: '13:40', end: '14:30', label: 'P7' },
  { id: 10, start: '14:30', end: '15:20', label: 'A1' },
  { id: 11, start: '15:20', end: '16:10', label: 'A2' },
  { id: 12, start: '16:10', end: '17:00', label: 'A3' },
];

export const WEDNESDAY_PERIODS: PeriodConfig[] = [
  { id: 1, start: '07:50', end: '09:00', label: 'P1' },
  { id: 2, start: '09:00', end: '09:50', label: 'P2' },
  { id: 3, start: '09:50', end: '10:30', label: 'P3' },
  { id: 4, start: '10:30', end: '10:50', label: 'B1', break: true },
  { id: 5, start: '10:50', end: '11:40', label: 'P4' },
  { id: 6, start: '11:40', end: '12:20', label: 'P5' },
  { id: 7, start: '12:20', end: '13:00', label: 'P6' },
  { id: 8, start: '13:00', end: '13:40', label: 'B2', break: true },
  { id: 9, start: '13:40', end: '14:30', label: 'P7' },
  { id: 10, start: '14:30', end: '15:20', label: 'A1' },
  { id: 11, start: '15:20', end: '16:10', label: 'A2' },
  { id: 12, start: '16:10', end: '17:00', label: 'A3' },
];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to get Cycle based on date
// User specified: Apr 13-17 2026 is Cycle 1.
// Week 15 of 2026? 
// April 13, 2026 is a Monday.
export function getCycleForDate(date: Date): 1 | 2 {
  const startOfReference = new Date('2026-04-13'); // Cycle 1 start
  const diffInMs = date.getTime() - startOfReference.getTime();
  const diffInWeeks = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 7));
  return (Math.abs(diffInWeeks) % 2 === 0) ? 1 : 2;
}

export function getCurrentPeriodIndex(date: Date): number | null {
  const minutes = date.getHours() * 60 + date.getMinutes();
  
  const pTimes = [
    { start: 7 * 60 + 50, end: 8 * 60 + 40 },
    { start: 8 * 60 + 40, end: 9 * 60 + 30 },
    { start: 9 * 60 + 30, end: 10 * 60 + 20 },
    { start: 10 * 60 + 40, end: 11 * 60 + 30 },
    { start: 11 * 60 + 30, end: 12 * 60 + 20 },
    { start: 12 * 60 + 20, end: 13 * 60 + 10 },
    { start: 13 * 60 + 40, end: 14 * 60 + 30 },
    { start: 14 * 60 + 30, end: 15 * 60 + 20 },
    { start: 15 * 60 + 20, end: 16 * 60 + 10 },
    { start: 16 * 60 + 10, end: 17 * 60 },
  ];

  return pTimes.findIndex(p => minutes >= p.start && minutes < p.end);
}

export const FAL_SUBJECTS = ['Afrikaans', 'Zulu FAL', 'Sesotho', 'Xhosa FAL', 'Sepedi FAL'];

export const SPECIAL_CIRCUMSTANCE_SUBJECTS = [
  'Information Technology',
  'Computer Application Technology',
  'Life Sciences',
  'Physical Sciences',
  'Visual Art',
  'Dramatic Art',
  'Engineering Graphics and Design'
];

export function normalizeSubjectName(name: string): string {
  const mapping: { [key: string]: string } = {
    'CAT': 'Computer Application Technology',
    'COMPUTER APPLICATION TECHNOLOGY': 'Computer Application Technology',
    'IT': 'Information Technology',
    'INFORMATION TECHNOLOGY': 'Information Technology',
    'LO': 'Life Orientation',
    'LIFE ORIENTATION': 'Life Orientation',
    'ENGLISH HL': 'English HL',
  };
  const upper = name.trim().toUpperCase();
  return mapping[upper] || name.trim();
}
