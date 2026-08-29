"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { evaluateBoundaryV2, fmtInstant } from "@/lib/boundary-v2";
import { useToast, useActionToast } from "@/lib/toast-context";
import type { ToastVariant } from "@/lib/toast-context";
import type { WorkSchedule } from "@/lib/schedule";
import { sendBoundaryMessage, cancelBoundaryMessage } from "./actions";
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

/** Non-"delayed" outcomes resolve immediately, so they're surfaced as a
 *  toast rather than a row in the persistent activity panel below — that
 *  panel is reserved for messages still waiting on the recipient's working
 *  hours (see BoundaryPage's query). */
const RESULT_TOAST_VARIANT: Record<Exclude<BoundaryStatus, "delayed">, ToastVariant> = {
  blocked: "error",
  warned: "info",
  delivered: "success",
};

export interface RecipientAvailability {
  schedule: WorkSchedule;
  onPto: boolean;
  returnDate: string | null;
}

/** `datetime-local`'s value has no timezone — new Date() on it is parsed in
 *  the browser's own local zone, giving a genuine instant in real time.
 *  That instant is what gets evaluated against the recipient's actual
 *  schedule/timezone, which is the whole point: two people can be in
 *  different zones and this still resolves correctly for both. */
function defaultSendAt(): string {
  const d = new Date();
  d.setHours(21, 0, 0, 0); // 9pm local — outside most default schedules, a livelier demo default
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BoundaryClient({
  employees,
  currentEmployeeId,
  initialActivity,
  availabilityByEmployee,
  offHoursByTeam,
}: {
  employees: Employee[];
  currentEmployeeId: string | null;
  initialActivity: ActivityEntry[];
  availabilityByEmployee: Record<string, RecipientAvailability>;
  offHoursByTeam: { team: string; totalSent: number; delayedCount: number }[];
}) {
  const sender =
    employees.find((e) => e.id === currentEmployeeId) ?? employees[0];
  const bob = employees.find((e) => e.name === "Burnout Bob");
  const defaultRecipient =
    bob && bob.id !== sender.id
      ? bob
      : employees.find((e) => e.id !== sender.id) ?? employees[1];

  const [recipientId, setRecipientId] = useState(defaultRecipient.id);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Slack");
  const [sendAt, setSendAt] = useState(defaultSendAt());
  const [message, setMessage] = useState(
    "Hey — no rush, just following up on the Q3 handoff doc when you're back."
  );
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, startCancelTransition] = useTransition();
  const { toast } = useToast();
  const run = useActionToast();

  const recipient = employees.find((e) => e.id === recipientId) ?? employees[1];
  const recipientAvailability = availabilityByEmployee[recipientId];

  const preview = useMemo(() => {
    const instant = new Date(sendAt);
    if (!recipientAvailability || Number.isNaN(instant.getTime())) {
      return { status: "blocked" as BoundaryStatus, message: "Pick a valid time" };
    }
    return evaluateBoundaryV2({
      senderId: sender.id,
      recipientId: recipient.id,
      recipientSchedule: recipientAvailability.schedule,
      recipientOnPto: recipientAvailability.onPto,
      recipientReturnDate: recipientAvailability.returnDate,
      instant,
      message,
    });
  }, [sender.id, recipient.id, recipientAvailability, sendAt, message]);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const instant = new Date(sendAt);
      const result = await sendBoundaryMessage(recipientId, instant.toISOString(), channel, message);
      if (!result.ok || !result.entry) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      const entry = result.entry;
      if (entry.status === "delayed") {
        setActivity((prev) => [entry, ...prev]);
        setFlashId(entry.id);
        window.setTimeout(() => setFlashId((cur) => (cur === entry.id ? null : cur)), 1400);
      } else {
        toast({ title: `${recipient.name}: ${entry.message}`, variant: RESULT_TOAST_VARIANT[entry.status] });
      }
      setMessage("");
    });
  }

  function handleCancel() {
    const id = cancelTarget;
    if (!id) return;
    setCancelTarget(null);
    startCancelTransition(async () => {
      const result = await run(() => cancelBoundaryMessage(id), { success: "Message cancelled." });
      if (result.ok) {
        setActivity((prev) => prev.filter((entry) => entry.id !== id));
      }
    });
  }

  const charCount = message.length;
  const nearLimit = charCount > 260;
  const recipientNow = recipientAvailability
    ? fmtInstant(new Date(), recipientAvailability.schedule.timezone)
    : null;

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
            <div className="truncate text-xs text-ink-mute">
              {recipient.role}
              {recipientNow ? ` · it's ${recipientNow} for them` : ""}
            </div>
          </div>
          {recipientAvailability?.onPto ? (
            <Chip tone="warning">
              On PTO{recipientAvailability.returnDate ? ` · back ${recipientAvailability.returnDate}` : ""}
            </Chip>
          ) : recipientAvailability ? (
            <Chip tone="success">
              Working hours {String(Math.floor(recipientAvailability.schedule.startMin / 60)).padStart(2, "0")}:
              {String(recipientAvailability.schedule.startMin % 60).padStart(2, "0")}–
              {String(Math.floor(recipientAvailability.schedule.endMin / 60)).padStart(2, "0")}:
              {String(recipientAvailability.schedule.endMin % 60).padStart(2, "0")}
            </Chip>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="send-at" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
              Send time
            </label>
            <input
              id="send-at"
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
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
        <p className="mt-1.5 text-[11px] text-ink-mute">
          Evaluated against {recipient.name.split(" ")[0]}&apos;s real working hours and timezone, not yours.
        </p>

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

      <div className="flex flex-col gap-6">
        <Card>
          <div className="mb-0.5 text-sm font-semibold text-ink">Your held messages</div>
          <p className="mb-3 text-xs text-ink-mute">
            Messages you sent that are waiting on the recipient&apos;s working hours.
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-mute">Nothing held right now.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((entry) => {
                // `resolved` overrides the display only — entry.status stays
                // "delayed" (see types/boundary.ts) so a message held past
                // working hours doesn't read as still-pending forever once
                // that time has come and gone.
                const displayTone = entry.resolved ? "success" : STATUS_TONE[entry.status];
                const displayLabel = entry.resolved ? "Delivered" : STATUS_LABEL[entry.status];
                const displayAccent = entry.resolved ? STATUS_ACCENT.delivered : STATUS_ACCENT[entry.status];
                return (
                  <li
                    key={entry.id}
                    className={`rounded-lg border p-2.5 text-sm ${flashId === entry.id ? "animate-row-flash" : ""}`}
                    style={{ borderColor: "var(--line)", borderLeftColor: displayAccent, borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Chip tone={displayTone}>{displayLabel}</Chip>
                      <span className="text-[11px] text-ink-mute">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-ink-soft">To {entry.recipientName}</p>
                    <p className="mt-0.5 truncate text-ink-soft">
                      {entry.preview || <span className="italic text-ink-mute">(empty message)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-mute">{entry.message}</p>
                    {!entry.resolved ? (
                      <div className="mt-1.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setCancelTarget(entry.id)}
                          className="text-xs font-medium text-ink-mute underline-offset-2 hover:text-risk-critical hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {offHoursByTeam.length > 0 ? (
          <Card>
            <div className="mb-1 text-sm font-semibold text-ink">Off-hours send rate — HR</div>
            <p className="mb-3 text-xs text-ink-mute">Share of messages sent outside the recipient&apos;s hours, last 30 days.</p>
            <ul className="space-y-2">
              {offHoursByTeam.map((row) => {
                const pct = row.totalSent > 0 ? Math.round((row.delayedCount / row.totalSent) * 100) : 0;
                return (
                  <li key={row.team} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink-soft">{row.team}</span>
                    <span className="font-mono text-xs text-ink-mute">
                      {row.delayedCount}/{row.totalSent} ({pct}%)
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel this message?"
        message="The recipient won't receive it once their working hours begin. This can't be undone."
        tone="default"
        confirmLabel="Cancel message"
        pending={isCancelling}
      />
    </div>
  );
}
