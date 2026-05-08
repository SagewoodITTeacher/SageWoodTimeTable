import { Subject } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useSubjects() {
  return useFirestoreCollection<Subject>('subjects');
}
