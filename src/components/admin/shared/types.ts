export type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  variant?: "default" | "destructive";
  requireTyped?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
} | null;

export type WorkloadBreakdown = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};

export type DayMinutes = {
  morning: number;
  afternoon: number;
  tech: number;
  standby: number;
};
