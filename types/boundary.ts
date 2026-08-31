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
  recipientId: string;
  recipientName: string;
  /** ISO instant the recipient's next working hours begin — only set when
   *  status === "delayed". Kept as a raw instant (not pre-formatted) so the
   *  UI can render it in the recipient's own timezone via fmtInstant,
   *  consistent with how boundary-v2.ts describes it to the sender. */
  scheduledDelivery: string | null;
  /** True once a "delayed" entry's held-until time has actually passed.
   *  `status` stays "delayed" forever — get_boundary_offhours_rate counts
   *  it as an off-hours send, a historical fact that shouldn't change —
   *  but the UI needs to stop showing something long-delivered as still
   *  pending. Always false for "blocked"/"warned"/"delivered". */
  resolved?: boolean;
}
