export type BoundaryStatus = "blocked" | "warned" | "delivered" | "delayed";

export interface BoundaryResult {
  status: BoundaryStatus;
  message: string;
}

export interface BoundaryInput {
  senderId: string;
  recipientId: string;
  day: number; // 0=Mon .. 6=Sun
  timeMinutes: number; // minutes from midnight
  message: string;
}

export interface ActivityEntry {
  id: string;
  preview: string;
  status: BoundaryStatus;
  message: string;
  timestamp: number;
}
