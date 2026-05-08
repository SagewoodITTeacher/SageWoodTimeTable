import { Venue } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useVenues() {
  return useFirestoreCollection<Venue>('venues');
}
