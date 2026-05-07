import { MarkingExtension } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useMarkingExtensions() {
  return useFirestoreCollection<MarkingExtension>('markingExtensions');
}
