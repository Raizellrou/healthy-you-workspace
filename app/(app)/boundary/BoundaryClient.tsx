"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { DAY_NAMES, WORK_START_MIN, WORK_END_MIN } from "@/lib/constants";
import { evaluateBoundary } from "@/lib/boundary";
import { fmtClock, parseTimeInput } from "@/lib/time";
import { sendBoundaryMessage } from "./actions";
import type { Employee } from "@/types/employee";
import type { ActivityEntry, BoundaryStatus } from "@/types/boundary";

const CHANNELS = ["Slack", "Email"] as const;

const STATUS_TONE: Record<BoundaryStatus, "critical" | "warning" | "success" | "neutral"> = {
  blocked: "critical",
  warned: "warning",
  delivered: "success",
  delayed: "neutral",
};

const STATUS_LABEL: Record<BoundaryStatus, string> = {
  blocked: "Blocked",
  warned: "Will warn first",
  delivered: "Delivers immediately",
  delayed: "Delayed",
};

const STATUS_ACCENT: Record<BoundaryStatus, string> = {
  blocked: "#FF8C73",
  warned: "#FFD700",
  delivered: "#87D380",
  delayed: "#87CEEB",
};

const SLIDER_MAX = 1425;

export function BoundaryClient({
  employees,
  currentEmployeeId,
  initialActivity,
}: {
  employees: Employee[];
  currentEmployeeId: string | null;
  initialActivity: ActivityEntry[];
}) {
  const sender =
    employees.find((e) => e.id === currentEmployeeId) ?? employees[0];
  const bob = employees.find((e) => e.name === "Burnout Bob");
  const defaultRecipient =
    bob && bob.id !== sender.id
      ? bob
      : employees.find((e) => e.id !== sender.id) ?? employees[1];

  const [recipientId, setRecipientId] = useState(defaultRecipient.id);
  const [day, setDay] = useState(3); // Thursday
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Slack");
  const [minutes, setMinutes] = useState(14 * 60); // 2:00 PM
  const [timeText, setTimeText] = useState(fmtClock(14 * 60));
  const [message, setMessage] = useState(
    "Hey — no rush, just following up on the Q3 handoff doc when you're back."
  );
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recipient = employees.find((e) => e.id === recipientId) ?? employees[1];

  const preview = useMemo(
    () => evaluateBoundary(sender, recipient, day, minutes, message),
    [sender, recipient, day, minutes, message]
  );

  function handleTimeText(value: string) {
    setTimeText(value);
    const parsed = parseTimeInput(value);
    if (parsed !== null) setMinutes(parsed);
  }

  function handleSlider(value: number) {
    setMinutes(value);
    setTimeText(fmtClock(value));
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendBoundaryMessage(recipientId, day, minutes, channel, message);
      if (!result.ok || !result.entry) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      const entry = result.entry;
      setActivity((prev) => [entry, ...prev]);
      setFlashId(entry.id);
      setMessage("");
      window.setTimeout(() => setFlashId((cur) => (cur === entry.id ? null : cur)), 1400);
    });
  }

  const leftPct = (WORK_START_MIN / SLIDER_MAX) * 100;
  const widthPct = ((WORK_END_MIN - WORK_START_MIN) / SLIDER_MAX) * 100;
  const charCount = message.length;
  const nearLimit = charCount > 260;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              From
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <Avatar name={sender.name} color={sender.avatarColor} size={22} />
              <span className="text-sm text-ink">{sender.name}</span>
            </div>
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              To
            </label>
            <select
              id="to"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
          <Avatar name={recipient.name} color={recipient.avatarColor} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{recipient.name}</div>
            <div className="truncate text-xs text-ink-mute">{recipient.role}</div>
          </div>
          {recipient.onPto ? (
            <Chip tone="warning">
              On PTO{recipient.returnIn ? ` · back ${recipient.returnIn}` : ""}
            </Chip>
          ) : (
            <Chip tone="success">Working hours 9:00 AM–6:00 PM</Chip>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="day" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              Send day
            </label>
            <select
              id="day"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {DAY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="channel" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              Channel
            </label>
            <select
              id="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="send-time" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
            Send time
          </label>
          <input
            id="send-time"
            type="text"
            value={timeText}
            onChange={(e) => handleTimeText(e.target.value)}
            placeholder="2:00 PM"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
          <div className="relative mt-3 h-6">
            <div className="absolute inset-y-0 left-0 right-0 my-auto h-1.5 rounded-full bg-surface-2" />
            <div
              className="absolute inset-y-0 my-auto h-1.5 rounded-full bg-success-bg"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={SLIDER_MAX}
              step={15}
              value={minutes}
              onChange={(e) => handleSlider(Number(e.target.value))}
              aria-label="Send time"
              className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent accent-brand"
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-mute">
            <span>12:00 AM</span>
            <span>Working window 9:00 AM–6:00 PM</span>
            <span>11:45 PM</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="message" className="text-xs font-medium uppercase tracking-wide text-ink-mute">
              Message
            </label>
            <span className={`text-xs ${nearLimit ? "text-warning" : "text-ink-mute"}`}>
              {charCount}/280
            </span>
          </div>
          <textarea
            id="message"
            value={message}
            maxLength={280}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="What do you need to send?"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>

        <div
          className="mt-5 rounded-lg border p-3"
          style={{ borderColor: `${STATUS_ACCENT[preview.status]}40`, background: `${STATUS_ACCENT[preview.status]}12` }}
        >
          <div className="flex items-center gap-2">
            <Chip tone={STATUS_TONE[preview.status]}>{STATUS_LABEL[preview.status]}</Chip>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{preview.message}</p>
        </div>

        {error ? <p className="mt-3 text-sm text-risk-critical">{error}</p> : null}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSend} disabled={preview.status === "blocked" || isPending}>
            {isPending ? "Sending…" : `Send via ${channel}`}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-sm font-semibold text-ink">Recent activity</div>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-mute">Nothing sent yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className={`rounded-lg border p-2.5 text-sm ${flashId === entry.id ? "animate-row-flash" : ""}`}
                style={{ borderColor: "var(--line)", borderLeftColor: STATUS_ACCENT[entry.status], borderLeftWidth: 3 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <Chip tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Chip>
                  <span className="text-[11px] text-ink-mute">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 truncate text-ink-soft">
                  {entry.preview || <span className="italic text-ink-mute">(empty message)</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-mute">{entry.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
