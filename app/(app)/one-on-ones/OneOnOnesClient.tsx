"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/Modal";
import { useActionToast } from "@/lib/toast-context";
import { Tabs } from "@/components/ui/Tabs";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BandChip } from "@/components/burnout/BandChip";
import { fmtDate, addDays } from "@/lib/date";
import { scheduleOneOnOne, completeOneOnOne, cancelOneOnOne } from "./actions";
import type { AgendaItem, AgendaSeverity } from "@/lib/one-on-one";
import type { ReportAgenda, OneOnOne } from "@/lib/supabase/one-on-ones";
import type { BurnoutBand } from "@/types/burnout";

const SEVERITY_TONE: Record<AgendaSeverity, "critical" | "warning" | "neutral"> = {
  urgent: "critical",
  watch: "warning",
  info: "neutral",
};

const SEVERITY_LABEL: Record<AgendaSeverity, string> = {
  urgent: "Urgent",
  watch: "Watch",
  info: "FYI",
};

function AgendaList({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-ink-mute">
        Nothing flagged right now. A good week to ask about what they want to be working on.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.kind} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-ink">{item.headline}</span>
            <Chip tone={SEVERITY_TONE[item.severity]} className="shrink-0">
              {SEVERITY_LABEL[item.severity]}
            </Chip>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.prompt}</p>
        </li>
      ))}
    </ul>
  );
}

function ReportCard({
  agenda,
  today,
  onScheduled,
}: {
  agenda: ReportAgenda;
  today: string;
  onScheduled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(addDays(today, 1));
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();

  function handleSchedule() {
    startTransition(async () => {
      const result = await run(() => scheduleOneOnOne({ employeeId: agenda.person.id, scheduledFor: date }), {
        success: `1:1 with ${agenda.person.name} scheduled for ${fmtDate(date)}.`,
      });
      if (!result.ok) return;
      setOpen(false);
      onScheduled();
    });
  }

  const upcoming = agenda.lastMeeting?.status === "scheduled" ? agenda.lastMeeting : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={agenda.person.name} color={agenda.person.avatarColor} size={36} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{agenda.person.name}</div>
            <div className="truncate text-xs text-ink-mute">{agenda.person.team}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BandChip band={agenda.band as BurnoutBand} />
          {agenda.pressing > 0 ? (
            <Chip tone="brand">
              {agenda.pressing} to raise
            </Chip>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <AgendaList items={agenda.items} />
      </div>

      {upcoming ? (
        <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-soft">
          Already scheduled for {fmtDate(upcoming.scheduledFor)}.
        </p>
      ) : open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
            aria-label={`1:1 date for ${agenda.person.name}`}
          />
          <Button size="sm" onClick={handleSchedule} disabled={isPending}>
            {isPending ? "Scheduling…" : "Confirm"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Schedule a 1:1
          </Button>
        </div>
      )}

    </Card>
  );
}

function MeetingCard({ meeting, canRun }: { meeting: OneOnOne; canRun: boolean }) {
  const [notes, setNotes] = useState(meeting.sharedNotes ?? "");
  const [isPending, startTransition] = useTransition();
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const runAction = useActionToast();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      await runAction(action);
    });
  }

  function handleComplete() {
    setConfirmCompleteOpen(false);
    run(() => completeOneOnOne({ id: meeting.id, sharedNotes: notes }));
  }

  function handleCancelMeeting() {
    setConfirmCancelOpen(false);
    run(() => cancelOneOnOne(meeting.id));
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={meeting.employeeName} color={meeting.employeeAvatarColor} size={32} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{meeting.employeeName}</div>
            <div className="truncate text-xs text-ink-mute">
              {fmtDate(meeting.scheduledFor)} · with {meeting.managerName}
            </div>
          </div>
        </div>
        <Chip tone={meeting.status === "completed" ? "success" : meeting.status === "cancelled" ? "neutral" : "brand"}>
          {meeting.status}
        </Chip>
      </div>

      {meeting.agenda.length > 0 ? (
        <div className="mt-3">
          <SectionLabel className="mb-2">Agenda when scheduled</SectionLabel>
          <AgendaList items={meeting.agenda} />
        </div>
      ) : null}

      {meeting.status === "scheduled" && canRun ? (
        <div className="mt-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Shared notes. Visible to both of you…"
            rows={3}
            maxLength={5000}
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Mark done"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={isPending}
            >
              Cancel meeting
            </Button>
          </div>
        </div>
      ) : meeting.sharedNotes ? (
        <div className="mt-3">
          <SectionLabel className="mb-1">Shared notes</SectionLabel>
          <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
            {meeting.sharedNotes}
          </p>
        </div>
      ) : null}


      <ConfirmModal
        open={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={handleComplete}
        title="Complete 1:1"
        message="Mark this 1:1 as complete?"
        tone="default"
        confirmLabel="Mark done"
        pending={isPending}
      />
      <ConfirmModal
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={handleCancelMeeting}
        title="Cancel 1:1"
        message="Cancel this 1:1? This can't be undone."
        confirmLabel="Cancel meeting"
        pending={isPending}
      />
    </Card>
  );
}

export function OneOnOnesClient({
  agendas,
  meetings,
  currentPersonId,
  canManage,
  today,
}: {
  agendas: ReportAgenda[];
  meetings: OneOnOne[];
  currentPersonId: string;
  canManage: boolean;
  today: string;
}) {
  const [tab, setTab] = useState<"agendas" | "meetings">(canManage ? "agendas" : "meetings");
  const [, startTransition] = useTransition();

  const scheduled = meetings.filter((m) => m.status === "scheduled");
  const past = meetings.filter((m) => m.status !== "scheduled");

  return (
    <div>
      {canManage ? (
        <Tabs
          ariaLabel="1:1 sections"
          className="mb-5"
          active={tab}
          onSelect={(key) => setTab(key as "agendas" | "meetings")}
          items={[
            { key: "agendas", label: "Team", count: agendas.length },
            { key: "meetings", label: "Meetings", count: meetings.length },
          ]}
        />
      ) : null}

      {canManage && tab === "agendas" ? (
        agendas.length === 0 ? (
          <EmptyState icon="users" message="Nobody reports to you yet. HR assigns team managers on the Teams screen." />
        ) : (
          <div className="space-y-4">
            {agendas.map((agenda) => (
              <ReportCard
                key={agenda.person.id}
                agenda={agenda}
                today={today}
                onScheduled={() => startTransition(() => setTab("meetings"))}
              />
            ))}
          </div>
        )
      ) : meetings.length === 0 ? (
        <EmptyState
          icon="calendar"
          message={canManage ? "No 1:1s scheduled yet." : "You have no 1:1s on record yet."}
        />
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">Upcoming</h2>
              <div className="space-y-4">
                {scheduled.map((m) => (
                  <MeetingCard key={m.id} meeting={m} canRun={m.managerId === currentPersonId} />
                ))}
              </div>
            </div>
          ) : null}
          {past.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">Past</h2>
              <div className="space-y-4">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} canRun={false} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
