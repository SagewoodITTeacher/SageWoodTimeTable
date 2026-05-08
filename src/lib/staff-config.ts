export const APPROVERS = ['MERV', 'PLAL', 'EZRN'];

export const PUBLIC_HOLIDAYS_2026 = ['2026-05-01', '2026-06-16'];

// TODO: Move to Firestore config for multi-year support
export function getPublicHolidays(): string[] {
  return PUBLIC_HOLIDAYS_2026;
}
