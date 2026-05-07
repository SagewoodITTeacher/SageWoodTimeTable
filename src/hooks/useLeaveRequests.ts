import { LeaveRequest } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

export function useLeaveRequests() {
  return useFirestoreCollection<LeaveRequest>('leaveRequests');
}
