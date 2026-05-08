import { DayPeriodConfig } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useDayPeriodConfigs() {
  return useFirestoreCollection<DayPeriodConfig>('dayPeriodConfigs');
}
