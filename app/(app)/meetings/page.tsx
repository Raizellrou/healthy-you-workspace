import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricBar } from "@/components/insights/MetricBar";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getMeetingInsights } from "@/lib/supabase/meetings";

/**
 * Manager/HR only. A manager sees their reports, HR sees the org — the same
 * scope the 1:1 surface uses, so the two screens can't disagree.
 */
export default async function MeetingsPage() {
  const me = await getCurrentPerson();
  if (!me || (me.appRole !== "manager" && me.appRole !== "hr")) notFound();

  const { windowDays, people, series, noMeetingDays, totalMeetingHours, daysWithoutDeepWork, peopleAffected, deepWorkMinutes } =
    await getMeetingInsights(me);

  const quietest = noMeetingDays[0];
  const maxSeriesHours = Math.max(1, ...series.map((s) => s.personHours));
  const worstOffenders = people.filter((p) => p.workingDays > 0 && p.daysWithoutDeepWork > 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead
        title="Meeting load"
        description={`How meetings are shaped across the last ${windowDays} days — not just how many hours, but whether they leave anyone a run at real work.`}
      />

      {/* The claim and its caveat travel together, deliberately. See
          scripts/seed-calendar.ts and 0022_calendar_events.sql. */}
      <div className="mb-6 rounded-lg border border-line bg-surface-2 px-4 py-3">
        <div className="text-xs font-bold text-ink">About this data</div>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Daily meeting <span className="font-medium text-ink">totals</span> are real — they reconcile to the
          hours already recorded against each person. Where each meeting sits{" "}
          <span className="font-medium text-ink">within</span> the day is modelled, because this deployment has no
          calendar integration. Treat the hours and costs below as sound, and the gap analysis as a well-founded
          reconstruction rather than an observation.
        </p>
      </div>

      {/* Same exemption as /insights: KPI tiles stay in a row. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-keep-columns>
        <Stat icon="calendar" label="Meeting hours" value={totalMeetingHours} sub={`across ${windowDays} days`} />
        <Stat
          icon="focus"
          label="Days lost"
          value={daysWithoutDeepWork}
          sub={`no ${deepWorkMinutes}-min run · ${peopleAffected} people`}
        />
        <Stat icon="users" label="Recurring series" value={series.length} sub="standing commitments" />
        <Stat
          icon="check"
          label="Quietest day"
          value={quietest?.label ?? "—"}
          sub={quietest ? `${quietest.meetingHours}h booked` : undefined}
        />
      </div>

      <div className="space-y-5">
        <Card>
          <h2 className="text-sm font-bold text-ink">Who never gets a clear run</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Working days with no uninterrupted {deepWorkMinutes}-minute block. This is the number that explains why
            nothing finished — six scattered half-hours cost more than one long meeting.
          </p>
          {people.length === 0 ? (
            <EmptyState icon="users" message="Nobody in scope yet." />
          ) : worstOffenders.length === 0 ? (
            <EmptyState icon="check" message="Everyone got at least one clear block on every day they had meetings." />
          ) : (
            <ul className="space-y-2">
              {worstOffenders.map((person) => (
                <li
                  key={person.employeeId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={person.name} color={person.avatarColor} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-ink">{person.name}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{person.team}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="font-mono text-ink-mute">{person.meetingHours}h</span>
                    <Chip tone={person.deepWorkDayPct === 0 ? "critical" : person.deepWorkDayPct < 50 ? "warning" : "neutral"}>
                      {person.daysWithoutDeepWork} of {person.workingDays} days
                    </Chip>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Recurring meeting audit</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Ranked by person-hours consumed, not by how long the meeting looks. A weekly half-hour with twelve
            people costs more than a monthly two-hour with three.
          </p>
          {series.length === 0 ? (
            <EmptyState icon="calendar" message="No recurring series found in the window." />
          ) : (
            <div className="space-y-3">
              {series.map((s) => (
                <MetricBar
                  key={s.seriesId}
                  label={s.title}
                  value={s.personHours}
                  display={`${s.personHours} person-h`}
                  sub={`· ${s.durationMinutes}m × ${s.attendeeCount} × ${s.occurrences}`}
                  scaleMax={maxSeriesHours}
                  color="#C7A2E5"
                  emphasis
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Where a no-meeting day would fit</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Ranked cheapest to clear. &ldquo;No-meeting Wednesday&rdquo; is a good policy arbitrarily chosen — the
            right day is whichever one is already quietest here.
          </p>
          <div className="space-y-3">
            {noMeetingDays.map((day, i) => (
              <MetricBar
                key={day.weekday}
                label={i === 0 ? `${day.label} — cheapest to clear` : day.label}
                value={day.meetingHours}
                display={`${day.meetingHours}h`}
                sub={day.seriesToMove > 0 ? `· ${day.seriesToMove} series to move` : "· nothing recurring"}
                scaleMax={Math.max(1, ...noMeetingDays.map((d) => d.meetingHours))}
                color={i === 0 ? "var(--risk-low)" : "var(--ink-mute)"}
                emphasis={i === 0}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
