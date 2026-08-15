export interface Employee {
  id: string;
  name: string;
  team: string;
  role: string;
  email: string;
  worked: boolean;
  meeting: number;
  offHours: number;
  available: number;
  meetingAvg: number;
  streakDays: number;
  daysSincePto: number;
  onPto: boolean;
  offHoursWeekly: number;
  returnIn: string | null;
  avatarColor: string;
}
