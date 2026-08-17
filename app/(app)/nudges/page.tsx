"use client";

import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/icons/Icon";
import { NudgeToastCard } from "@/components/nudges/NudgeToastCard";
import { useNudges } from "@/lib/nudge-context";
import { NUDGE_DAILY_CAP, NUDGE_META, NUDGE_SESSION_MINUTES } from "@/lib/constants";
import type { NudgeResult, NudgeType } from "@/types/nudge";

const RESULT_LABEL: Record<NudgeResult, string> = {
  sent: "Sent",
  suppressed: "Suppressed",
  done: "Done",
  snoozed: "Snoozed",
};

const RESULT_TONE: Record<NudgeResult, "success" | "warning" | "neutral" | "brand"> = {
  sent: "success",
  suppressed: "warning",
  done: "neutral",
  snoozed: "brand",
};

const NUDGE_ACCENT: Record<NudgeType, string> = {
  stretch: "#C7A2E5",
  hydrate: "#87CEEB",
  eye_rest: "#A8D592",
  posture: "#FFB5C5",
};

function permissionCopy(state: string): string {
  switch (state) {
    case "unsupported":
      return "Notifications aren't supported in this browser.";
    case "granted":
      return "Notifications are enabled — you'll get an alert if a nudge fires while you're on another tab.";
    case "denied":
      return "Notifications are blocked. Enable them in your browser settings to get alerts on other tabs.";
    default:
      return "Notifications haven't been requested yet — click Start to ask.";
  }
}

export default function NudgesPage() {
  const {
    simClock,
    setSimClock,
    meetingSoon,
    setMeetingSoon,
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
  } = useNudges();

  const progressPct = Math.round((sessionMinutes / NUDGE_SESSION_MINUTES) * 100);
  const sentCount = log.filter((l) => l.result === "sent").length;
  const suppressedCount = log.filter((l) => l.result === "suppressed").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#C7A2E5" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#C7A2E5" }}>
          Energize · Wellbeing
        </span>
      </div>
      <PageHead
        title="Nudges"
        description="Simulated wellness nudges — quiet-hours-aware, capped, and snoozable."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { label: "Today", value: dailyCount, color: "#C7A2E5" },
          { label: "Sent", value: sentCount, color: "#87D380" },
          { label: "Suppressed", value: suppressedCount, color: "var(--ink-mute)" },
          { label: "Daily cap", value: NUDGE_DAILY_CAP, color: "#6F49A6" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-surface px-4 py-2 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] text-ink-mute">{s.label}</div>
          </div>
        ))}
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sim-clock" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              Simulated clock
            </label>
            <input
              id="sim-clock"
              type="time"
              value={simClock}
              onChange={(e) => setSimClock(e.target.value || "00:00")}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
            <span className="text-sm text-ink-soft">Meeting in &lt;10 min</span>
            <Switch checked={meetingSoon} onChange={setMeetingSoon} label="Meeting in less than 10 minutes" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Chip tone={isQuietHours ? "neutral" : "success"}>
            {isQuietHours ? "Quiet hours" : "Active hours"}
          </Chip>
          <Chip tone={dailyCount >= NUDGE_DAILY_CAP ? "warning" : "neutral"}>
            Today: {dailyCount}/{NUDGE_DAILY_CAP}
          </Chip>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Focus session</div>
            <div className="text-xs text-ink-mute">
              {sessionMinutes} / {NUDGE_SESSION_MINUTES} simulated minutes
            </div>
          </div>
          <div className="flex gap-2">
            {sessionRunning ? (
              <Button variant="secondary" size="sm" onClick={pause}>
                Pause
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={start}>
                Start
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-ink-mute">{permissionCopy(notifPermission)}</p>
      </Card>

      {activeToast ? (
        <div className="mb-6">
          <NudgeToastCard
            type={activeToast.type}
            onDone={() => resolveToast("done")}
            onSnooze={() => resolveToast("snooze")}
          />
        </div>
      ) : null}

      <Card>
        <div className="mb-3 text-sm font-semibold text-ink">Nudge log</div>
        {log.length === 0 ? (
          <p className="text-sm text-ink-mute">Nothing yet — start a session to begin.</p>
        ) : (
          <ul aria-live="polite" className="flex flex-col gap-2">
            {log.map((entry) => {
              const meta = NUDGE_META[entry.type];
              const accent = NUDGE_ACCENT[entry.type];
              const suppressed = entry.result === "suppressed";
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border py-2.5 pl-3 pr-3 text-sm"
                  style={{
                    borderColor: suppressed ? "var(--line)" : `${accent}40`,
                    borderLeftColor: suppressed ? "var(--line)" : accent,
                    borderLeftWidth: 3,
                    opacity: suppressed ? 0.7 : 1,
                  }}
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-ink-mute">{entry.time}</span>
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${accent}20`, color: accent }}
                  >
                    <Icon name={meta.icon as never} size={14} />
                  </span>
                  <span className="flex-1 text-ink-soft">{meta.title}</span>
                  <Chip tone={RESULT_TONE[entry.result]}>
                    {RESULT_LABEL[entry.result]}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </Chip>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
