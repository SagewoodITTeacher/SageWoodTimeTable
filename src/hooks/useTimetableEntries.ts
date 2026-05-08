import { TimetableEntry } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useTimetableEntries() {
  return useFirestoreCollection<TimetableEntry>('timetableEntries');
}
