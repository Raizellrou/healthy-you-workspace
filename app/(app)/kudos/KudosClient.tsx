"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Icon } from "@/components/icons/Icon";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Chip } from "@/components/ui/Chip";
import { KUDOS_PROGRESS_CAP, KUDOS_TAGS } from "@/lib/constants";
import { submitKudos, rotateBuddies, raiseConcern, decideConcern, proposeCoffee } from "./actions";
import { useActionToast } from "@/lib/toast-context";
import type { Employee } from "@/types/employee";

const TAG_ACCENT: Record<string, string> = {
  "Great teammate": "#87D380",
  "Made my day": "#FFB5C5",
  "Went above and beyond": "#6F49A6",
  "Really listened": "#87CEEB",
};

const CATEGORIES = [
  { value: "workload", label: "Workload" },
  { value: "conduct", label: "Conduct" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "other", label: "Other" },
];

export interface HrViewItem {
  team: string;
  note: string;
}

export interface ConcernItem {
  id: string;
  aboutName: string;
  category: string;
  note: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}

export function KudosClient({
  buddy,
  alreadySubmitted,
  initialProgress,
  hrView,
  isHr,
  concerns,
  employees,
  currentEmployeeId,
}: {
  buddy: Employee | null;
  alreadySubmitted: boolean;
  initialProgress: number;
  hrView: HrViewItem[];
  isHr: boolean;
  concerns: ConcernItem[];
  employees: Employee[];
  currentEmployeeId: string | null;
}) {
  const router = useRouter();
  const reportableEmployees = employees.filter((e) => e.id !== currentEmployeeId);
  const [coffeeResult, setCoffeeResult] = useState<string | null>(null);
  const [coffeePending, setCoffeePending] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [flagToHR, setFlagToHR] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();

  const [rotating, setRotating] = useState(false);
  const [rotateMsg, setRotateMsg] = useState<string | null>(null);

  const [concernOpen, setConcernOpen] = useState(false);
  const [concernAbout, setConcernAbout] = useState(reportableEmployees[0]?.id ?? "");
  const [concernCategory, setConcernCategory] = useState("wellbeing");
  const [concernNote, setConcernNote] = useState("");
  const [concernAnon, setConcernAnon] = useState(true);
  const [concernPending, setConcernPending] = useState(false);
  const [concernError, setConcernError] = useState<string | null>(null);
  const [concernSent, setConcernSent] = useState(false);

  const [concernRows, setConcernRows] = useState(concerns);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  function handleSubmit() {
    if (submitted || !buddy) return;
    if (!tag) {
      setError("Pick a tag before sending kudos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await run(() => submitKudos(buddy.id, tag, note, flagToHR), {
        success: `Kudos sent to ${buddy.name}.`,
      });
      if (!result.ok) return;
      setSubmitted(true);
      setProgress((p) => Math.min(KUDOS_PROGRESS_CAP, p + 1));
    });
  }

  function handleRotate() {
    setRotating(true);
    setRotateMsg(null);
    startTransition(async () => {
      const result = await rotateBuddies();
      setRotating(false);
      if (result.ok) {
        setRotateMsg("Rotated to a new pairing.");
        router.refresh();
      } else {
        setRotateMsg(result.error ?? "Rotate failed.");
      }
    });
  }

  function handleRaiseConcern() {
    if (!concernNote.trim()) {
      setConcernError("Note needed.");
      return;
    }
    setConcernError(null);
    setConcernPending(true);
    startTransition(async () => {
      const result = await raiseConcern({
        aboutEmployeeId: concernAbout,
        category: concernCategory,
        note: concernNote,
        anonymous: concernAnon,
      });
      setConcernPending(false);
      if (!result.ok) {
        setConcernError(result.error ?? "Send failed.");
        return;
      }
      setConcernSent(true);
      setConcernNote("");
    });
  }

  function handleDecide(id: string, status: "acknowledged" | "resolved") {
    setDecidingId(id);
    startTransition(async () => {
      const result = await decideConcern({ id, status });
      setDecidingId(null);
      if (result.ok) {
        setConcernRows((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    });
  }

  function handleCoffee() {
    if (!buddy) return;
    setCoffeeResult(null);
    setCoffeePending(true);
    startTransition(async () => {
      const result = await proposeCoffee(buddy.id);
      setCoffeePending(false);
      setCoffeeResult(
        result.ok
          ? `Coffee proposed. They've been sent the invite. Picked as the first 30 minutes you're both free.`
          : (result.error ?? "Couldn't find a slot.")
      );
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        {buddy ? (
          <div className="border-b border-line pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={buddy.name} color={buddy.avatarColor} size={40} />
                <div>
                  <div className="text-sm font-semibold text-ink">You &amp; {buddy.name}</div>
                  <div className="text-xs text-ink-mute">This week&apos;s buddy pairing</div>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={handleCoffee} disabled={coffeePending}>
                {coffeePending ? "Finding a time…" : "Find a coffee slot"}
              </Button>
            </div>
            {coffeeResult ? (
              <p className="mt-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-soft">
                {coffeeResult}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="border-b border-line pb-4 text-sm text-ink-soft">
            No buddy pairing yet this week. {isHr ? "Rotate pairings below to start one." : "Check back once HR runs the weekly rotation."}
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-mute">
            What stood out?
            {!submitted && buddy ? <span className="normal-case text-ink-mute/70">(required)</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {KUDOS_TAGS.map((t) => {
              const active = tag === t;
              const accent = TAG_ACCENT[t] ?? "#6F49A6";
              return (
                <button
                  key={t}
                  type="button"
                  disabled={submitted || !buddy}
                  aria-pressed={active}
                  onClick={() => {
                    setTag(t);
                    setError(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    active ? "" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
                  }`}
                  style={active ? { borderColor: accent, background: `${accent}18`, color: accent } : undefined}
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
            disabled={submitted || !buddy}
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
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "#87D38018", color: "#2A7A26" }}
            >
              <Icon name="check" size={16} />
              Kudos sent to {buddy?.name}.
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending || !buddy}>
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
          {/* "0 / 8" on its own never said eight of what. */}
          <div className="mt-1 text-xs text-ink-soft">colleagues thanked this week</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${(progress / KUDOS_PROGRESS_CAP) * 100}%`, background: "var(--band-low-fill)" }}
            />
          </div>
        </Card>

        {isHr ? (
          <Card>
            <div className="mb-2 text-sm font-semibold text-ink">Buddy rotation (HR)</div>
            <Button variant="secondary" size="sm" onClick={handleRotate} disabled={rotating}>
              {rotating ? "Rotating…" : "Rotate this week"}
            </Button>
            {rotateMsg ? <p className="mt-2 text-xs text-ink-mute">{rotateMsg}</p> : null}
          </Card>
        ) : null}

        <Card>
          <div className="mb-2 text-sm font-semibold text-ink">HR view (unlinked)</div>
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
            Flagged kudos are never linked back to the sender. HR only ever sees the
            team and the note.
          </p>
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setConcernOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink"
          >
            Something&apos;s not right?
            <span className="text-xs font-normal text-ink-mute">{concernOpen ? "Hide" : "Tell HR"}</span>
          </button>
          {concernOpen ? (
            concernSent ? (
              <p className="mt-3 text-xs text-ink-soft">Sent to HR. Thanks for flagging it.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <Field label="About">
                  {(props) => (
                    <Select
                      {...props}
                      value={concernAbout}
                      onChange={(e) => setConcernAbout(e.target.value)}
                      options={reportableEmployees.map((e) => ({ value: e.id, label: e.name }))}
                    />
                  )}
                </Field>
                <Field label="Category">
                  {(props) => (
                    <Select
                      {...props}
                      value={concernCategory}
                      onChange={(e) => setConcernCategory(e.target.value)}
                      options={CATEGORIES}
                    />
                  )}
                </Field>
                <Field label="Note">
                  {(props) => (
                    <Textarea
                      {...props}
                      value={concernNote}
                      onChange={(e) => setConcernNote(e.target.value)}
                      rows={3}
                      placeholder="What's going on?"
                    />
                  )}
                </Field>
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <Switch checked={concernAnon} onChange={setConcernAnon} label="Send anonymously" id="concern-anon" />
                  Send anonymously
                </label>
                {concernError ? <p className="text-xs text-risk-critical">{concernError}</p> : null}
                <Button size="sm" onClick={handleRaiseConcern} disabled={concernPending}>
                  {concernPending ? "Sending…" : "Send to HR"}
                </Button>
                <p className="text-[11px] text-ink-mute">
                  Only HR can ever read this. Anonymous means the database itself never records who sent it, not just the UI.
                </p>
              </div>
            )
          ) : null}
        </Card>

        {isHr && concernRows.length > 0 ? (
          <Card>
            <div className="mb-2 text-sm font-semibold text-ink">Concern triage (HR)</div>
            <ul className="space-y-2">
              {concernRows.map((c) => (
                <li key={c.id} className="rounded-lg border border-line p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{c.aboutName}</span>
                    <Chip tone={c.status === "open" ? "warning" : c.status === "acknowledged" ? "brand" : "success"}>
                      {c.status}
                    </Chip>
                  </div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-ink-mute">{c.category}</div>
                  <p className="mt-1 text-ink-soft">{c.note}</p>
                  {c.status === "open" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={decidingId === c.id}
                        onClick={() => handleDecide(c.id, "acknowledged")}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={decidingId === c.id}
                        onClick={() => handleDecide(c.id, "resolved")}
                      >
                        Resolve
                      </Button>
                    </div>
                  ) : c.status === "acknowledged" ? (
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" disabled={decidingId === c.id} onClick={() => handleDecide(c.id, "resolved")}>
                        Resolve
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
