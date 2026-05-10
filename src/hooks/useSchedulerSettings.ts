import { useFirestoreCollection } from "./useFirestoreCollection";
import { SchedulerSettings } from "../types";

export function useSchedulerSettings() {
  return useFirestoreCollection<SchedulerSettings>("settings");
}
