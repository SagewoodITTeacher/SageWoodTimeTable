import { Assignment } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useAssignments() {
  return useFirestoreCollection<Assignment>('assignments');
}
