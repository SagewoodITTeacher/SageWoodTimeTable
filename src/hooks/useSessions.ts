import { ExamSession } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useSessions() {
  return useFirestoreCollection<ExamSession>('sessions');
}
