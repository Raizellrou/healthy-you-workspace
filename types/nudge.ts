export type NudgeType = "stretch" | "hydrate" | "eye_rest" | "posture";

export type NudgeResult = "sent" | "suppressed" | "done" | "snoozed";

export interface NudgeLogEntry {
  id: string;
  time: string;
  type: NudgeType;
  result: NudgeResult;
  reason?: string;
}

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";
