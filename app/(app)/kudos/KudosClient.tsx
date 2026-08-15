"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Icon } from "@/components/icons/Icon";
import { KUDOS_PROGRESS_CAP, KUDOS_TAGS } from "@/lib/constants";
import { submitKudos } from "./actions";
import type { Employee } from "@/types/employee";

const CYCLE = "2026-Q3";

export interface HrViewItem {
  team: string;
  note: string;
}

export function KudosClient({
  buddy,
  alreadySubmitted,
  initialProgress,
  hrView,
}: {
  buddy: Employee;
  alreadySubmitted: boolean;
  initialProgress: number;
  hrView: HrViewItem[];
}) {
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [flagToHR, setFlagToHR] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (submitted) return;
    if (!tag) {
      setError("Pick a tag before sending kudos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitKudos(buddy.id, tag, note, flagToHR);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setSubmitted(true);
      setProgress((p) => Math.min(KUDOS_PROGRESS_CAP, p + 1));
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Avatar name={buddy.name} color={buddy.avatarColor} size={40} />
          <div>
            <div className="text-sm font-semibold text-ink">You &amp; {buddy.name}</div>
            <div className="text-xs text-ink-mute">Buddy pairing · cycle {CYCLE}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-mute">
            What stood out?
          </div>
          <div className="flex flex-wrap gap-2">
            {KUDOS_TAGS.map((t) => {
              const active = tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={submitted}
                  aria-pressed={active}
                  onClick={() => {
                    setTag(t);
                    setError(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : "border-line bg-surface text-ink-soft hover:bg-surface-2"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {error ? <p className="mt-2 text-xs text-risk-critical">{error}</p> : null}
        </div>

        <div className="mt-4">
          <label htmlFor="kudos-note" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
            Private note (optional)
          </label>
          <textarea
            id="kudos-note"
            value={note}
            disabled={submitted}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Say a bit more…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <div>
            <div className="text-sm text-ink">Flag to HR</div>
            <div className="text-xs text-ink-mute">Surface this in the unlinked HR view</div>
          </div>
          <Switch
            checked={flagToHR}
            onChange={setFlagToHR}
            label="Flag to HR"
            id="flag-hr"
          />
        </div>

        <div className="mt-5">
          {submitted ? (
            <div className="flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2.5 text-sm text-success">
              <Icon name="check" size={16} />
              Kudos sent to {buddy.name}.
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Sending…" : "Send kudos"}
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">
            My progress
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-ink">
            {progress} / {KUDOS_PROGRESS_CAP}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${(progress / KUDOS_PROGRESS_CAP) * 100}%` }}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-2 text-sm font-semibold text-ink">HR view — unlinked</div>
          {hrView.length === 0 ? (
            <p className="text-sm text-ink-mute">No flagged kudos yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {hrView.map((item, i) => (
                <li key={i} className="rounded-lg border border-line p-2.5">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">
                    {item.team}
                  </div>
                  <p className="mt-0.5 text-ink-soft">{item.note}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-mute">
            Flagged kudos are never linked back to the sender — HR only ever sees the
            team and the note.
          </p>
        </Card>
      </div>
    </div>
  );
}
