"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  NotificationPermissionState,
  NudgeLogEntry,
  NudgeType,
} from "@/types/nudge";
import {
  NUDGE_DAILY_CAP,
  NUDGE_META,
  NUDGE_SESSION_MINUTES,
  NUDGE_SNOOZE_MINUTES,
  NUDGE_TICK_MS,
  NUDGE_TYPES,
  QUIET_HOURS_END_MIN,
  QUIET_HOURS_START_MIN,
} from "@/lib/constants";
import { fmtClock } from "@/lib/time";

interface ActiveToast {
  id: string;
  type: NudgeType;
}

interface NudgeContextValue {
  simClock: string;
  setSimClock: (v: string) => void;
  meetingSoon: boolean;
  setMeetingSoon: (v: boolean) => void;
  currentSimMinutes: number;
  isQuietHours: boolean;

  sessionMinutes: number;
  sessionRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;

  dailyCount: number;
  log: NudgeLogEntry[];
  activeToast: ActiveToast | null;
  resolveToast: (action: "done" | "snooze") => void;

  notifPermission: NotificationPermissionState;

  unseenCount: number;
  isOnNudgesRoute: boolean;
}

const NudgeContext = createContext<NudgeContextValue | null>(null);

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseBaseMinutes(simClock: string): number {
  const [h, m] = simClock.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function NudgeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isOnNudgesRoute = pathname === "/nudges";

  const [simClock, setSimClock] = useState("10:00");
  const [meetingSoon, setMeetingSoon] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [log, setLog] = useState<NudgeLogEntry[]>([]);
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const [lastType, setLastType] = useState<NudgeType | null>(null);
  const [snoozedUntilElapsed, setSnoozedUntilElapsed] = useState<number | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );
  const [unseenCount, setUnseenCount] = useState(0);
  const [hidden, setHidden] = useState(false);

  const originalTitle = useRef<string>("Petal");
  const titleFlashRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const sessionRef = useRef(0);

  useEffect(() => {
    // One-time read of a browser-only API on mount, deferred to an effect
    // (rather than a lazy useState initializer) specifically so the SSR pass
    // and the first client render agree before this value can diverge.
    if (typeof window === "undefined") return;
    if (typeof window.Notification === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(window.Notification.permission as NotificationPermissionState);
    }
    originalTitle.current = document.title;
  }, []);

  useEffect(() => {
    function onVisibility() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // reset unseen badge + stop title flash once the user is back on /nudges and visible
  const seenNow = isOnNudgesRoute && !hidden;
  const [prevSeenNow, setPrevSeenNow] = useState(seenNow);
  if (seenNow !== prevSeenNow) {
    setPrevSeenNow(seenNow);
    if (seenNow) setUnseenCount(0);
  }

  const currentSimMinutes = (parseBaseMinutes(simClock) + elapsedMinutes) % 1440;
  const isQuietHours =
    currentSimMinutes < QUIET_HOURS_START_MIN || currentSimMinutes >= QUIET_HOURS_END_MIN;

  const fireOrSuppress = useCallback(
    (nowElapsed: number, nowMinutes: number) => {
      const time = fmtClock(nowMinutes);
      const stillSnoozed = snoozedUntilElapsed !== null && nowElapsed < snoozedUntilElapsed;
      const quiet = nowMinutes < QUIET_HOURS_START_MIN || nowMinutes >= QUIET_HOURS_END_MIN;

      let reason: string | null = null;
      if (stillSnoozed) reason = "Snoozed";
      else if (meetingSoon) reason = "Meeting soon";
      else if (quiet) reason = "Quiet hours";
      else if (dailyCount >= NUDGE_DAILY_CAP) reason = "Daily cap reached";

      if (reason) {
        setLog((prev) => [
          { id: makeId(), time, type: lastType ?? NUDGE_TYPES[0], result: "suppressed", reason },
          ...prev,
        ]);
        return;
      }

      const candidates = NUDGE_TYPES.filter((t) => t !== lastType);
      const type = candidates[Math.floor(Math.random() * candidates.length)];
      setLastType(type);
      setDailyCount((c) => c + 1);
      setActiveToast({ id: makeId(), type });
      setLog((prev) => [{ id: makeId(), time, type, result: "sent" }, ...prev]);

      const offNudgesRoute = !isOnNudgesRoute;
      if (offNudgesRoute || hidden) {
        setUnseenCount((c) => c + 1);
      }
      if (hidden) {
        if (notifPermission === "granted" && typeof window !== "undefined") {
          const meta = NUDGE_META[type];
          new window.Notification(meta.title, { body: meta.body });
        }
      }
    },
    [snoozedUntilElapsed, meetingSoon, dailyCount, lastType, isOnNudgesRoute, hidden, notifPermission]
  );

  useEffect(() => {
    if (!sessionRunning) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      const nowElapsed = elapsedRef.current;

      if (snoozedUntilElapsed !== null && nowElapsed >= snoozedUntilElapsed) {
        setSnoozedUntilElapsed(null);
      }
      setElapsedMinutes(nowElapsed);

      sessionRef.current += 1;
      if (sessionRef.current >= NUDGE_SESSION_MINUTES) {
        sessionRef.current = 0;
        const nowMinutes = (parseBaseMinutes(simClock) + nowElapsed) % 1440;
        fireOrSuppress(nowElapsed, nowMinutes);
      }
      setSessionMinutes(sessionRef.current);
    }, NUDGE_TICK_MS);
    return () => window.clearInterval(id);
  }, [sessionRunning, fireOrSuppress, simClock, snoozedUntilElapsed]);

  // title flash while hidden and there's an unresolved, unseen toast
  useEffect(() => {
    const shouldFlash = hidden && activeToast !== null;
    if (shouldFlash) {
      const meta = NUDGE_META[activeToast!.type];
      let on = false;
      titleFlashRef.current = window.setInterval(() => {
        on = !on;
        document.title = on ? `(1) ${meta.title}` : originalTitle.current;
      }, 1100);
    }
    return () => {
      if (titleFlashRef.current !== null) {
        window.clearInterval(titleFlashRef.current);
        titleFlashRef.current = null;
        document.title = originalTitle.current;
      }
    };
  }, [hidden, activeToast]);

  const start = useCallback(() => {
    if (typeof window !== "undefined" && typeof window.Notification !== "undefined") {
      if (window.Notification.permission === "default") {
        window.Notification.requestPermission().then((p) =>
          setNotifPermission(p as NotificationPermissionState)
        );
      }
    }
    setSessionRunning(true);
  }, []);

  const pause = useCallback(() => setSessionRunning(false), []);

  const reset = useCallback(() => {
    setSessionRunning(false);
    sessionRef.current = 0;
    setSessionMinutes(0);
  }, []);

  const resolveToast = useCallback(
    (action: "done" | "snooze") => {
      if (!activeToast) return;
      const current = activeToast;
      const time = fmtClock(currentSimMinutes);
      if (action === "snooze") {
        setSnoozedUntilElapsed(elapsedMinutes + NUDGE_SNOOZE_MINUTES);
        setLog((prev) => [
          { id: makeId(), time, type: current.type, result: "snoozed" },
          ...prev,
        ]);
      } else {
        setLog((prev) => [
          { id: makeId(), time, type: current.type, result: "done" },
          ...prev,
        ]);
      }
      setActiveToast(null);
    },
    [activeToast, currentSimMinutes, elapsedMinutes]
  );

  const value: NudgeContextValue = {
    simClock,
    setSimClock,
    meetingSoon,
    setMeetingSoon,
    currentSimMinutes,
    isQuietHours,
    sessionMinutes,
    sessionRunning,
    start,
    pause,
    reset,
    dailyCount,
    log,
    activeToast,
    resolveToast,
    notifPermission,
    unseenCount,
    isOnNudgesRoute,
  };

  return <NudgeContext.Provider value={value}>{children}</NudgeContext.Provider>;
}

export function useNudges(): NudgeContextValue {
  const ctx = useContext(NudgeContext);
  if (!ctx) throw new Error("useNudges must be used within NudgeProvider");
  return ctx;
}
