import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/icons/Icon";
import { BandChip } from "@/components/burnout/BandChip";
import { Sparkline } from "@/components/burnout/Sparkline";
import { SessionBar } from "@/components/dashboard/SessionBar";
import { LiveSessionRefresh } from "@/components/dashboard/LiveSessionRefresh";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees, getBurnoutHistory, getMyTasks } from "@/lib/supabase/queries";
import { getCurrentPerson, getVisibleEmployees, getTeams } from "@/lib/supabase/people";
import { getOpenSession, getAttendanceSignals, getMyRollups } from "@/lib/supabase/attendance";
import { getMySettings } from "@/lib/supabase/notifications";
import { getTaskBurnoutSignals } from "@/lib/supabase/tasks";
import { getForecastsForEmployees } from "@/lib/supabase/forecast";
import { getMyOneOnOnes } from "@/lib/supabase/one-on-ones";
import { getCurrentMeeting } from "@/lib/supabase/meetings";
import { hasCheckedInMoodToday, getNeedsYou, getFirstRunItems } from "@/lib/supabase/needs-you";
import { computeBurnout } from "@/lib/burnout";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { visibleTo } from "@/lib/authz";
import { todayInTz, fmtDate } from "@/lib/date";
import type { BurnoutBand } from "@/types/burnout";
import type { BurnoutInputs } from "@/lib/burnout";
import type { BurnoutV2Extras } from "@/lib/burnout-signals";
import type { ForecastPoint } from "@/lib/forecast";

const RISK_STROKE: Record<BurnoutBand, string> = {
  low: "var(--risk-low)",
  medium: "var(--risk-medium)",
  high: "var(--risk-high)",
  critical: "var(--risk-critical)",
};

function startOfWeekISO(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as the start of the week
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [employees, currentEmployeeId, me] = await Promise.all([
    getEmployees(),
    getCurrentEmployeeId(),
    getCurrentPerson(),
  ]);

  const headcount = employees.length;
  const teamCount = new Set(employees.map((e) => e.team)).size;
  const workingToday = employees.filter((e) => e.worked).length;

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const title = currentEmployee ? `${greeting}, ${currentEmployee.name.split(" ")[0]}` : "Dashboard";
  const dateLine = `${new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })} · ${teamCount} teams · ${headcount} people`;

  // --- Zone A/B/C: personal signals. Nothing here fires if `me` is null
  // (session mid-migration, no matching employee row) — same defensive
  // posture app/(app)/layout.tsx already takes for openSession et al.
  const [openSession, myTasks, myOneOnOnes, currentMeeting, moodCheckedIn, needsYou, myRollups, mySettings] = me
    ? await Promise.all([
        getOpenSession(me.id),
        getMyTasks(me.id),
        getMyOneOnOnes(),
        getCurrentMeeting(me.id),
        hasCheckedInMoodToday(me.id, me.timezone),
        getNeedsYou(me),
        getMyRollups(me.id, 7),
        getMySettings(me.id),
      ])
    : [null, [], [], null, false, [], [], null];

  // First-run prompts lead: someone who has just been onboarded should see
  // "set your working hours" above their unread count.
  const needsYouItems = [...getFirstRunItems(mySettings?.schedule ?? null), ...needsYou];

  const last7DaysHours = myRollups.reduce((sum, r) => sum + r.netHours, 0);

  const today = me ? todayInTz(me.timezone) : null;
  const dueToday = myTasks.filter((t) => t.due_date === today);
  const topTasks = myTasks.slice(0, 5);
  const nextOneOnOne = myOneOnOnes
    .filter((m) => m.status === "scheduled" && today && m.scheduledFor >= today)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0];

  // Burnout — computeBurnout is pure, so this needs zero extra queries beyond
  // the employee stats getEmployees() already returns. The flagged list is
  // then narrowed through the same visibleTo() model app/(app)/burnout/page.tsx
  // enforces (self/team/org by role) — the dashboard was showing this
  // org-wide to every viewer regardless of role before this phase, which
  // disagreed with what /burnout itself is willing to show the same person.
  const burnoutRows = employees.map((e) => ({ employee: e, scores: computeBurnout(e) }));
  const allFlagged = burnoutRows.filter((r) => r.scores.band === "high" || r.scores.band === "critical");
  const [visiblePeople, teams] = me ? await Promise.all([getVisibleEmployees(), getTeams()]) : [[], []];
  const visibleIds = me ? new Set(visibleTo(me, visiblePeople, (p) => p, teams).map((p) => p.id)) : null;
  const flagged = visibleIds ? allFlagged.filter((r) => visibleIds.has(r.employee.id)) : allFlagged;
  const criticalCount = flagged.filter((r) => r.scores.band === "critical").length;
  const highCount = flagged.filter((r) => r.scores.band === "high").length;
  const topFlagged = [...flagged].sort((a, b) => b.scores.composite - a.scores.composite).slice(0, 3);
  const topFlaggedWithHistory = await Promise.all(
    topFlagged.map(async (r) => ({ ...r, history: await getBurnoutHistory(r.employee.id) }))
  );

  // 7-day forecast, scoped to just these (at most 3) flagged people rather
  // than the whole org — the same buildBurnoutV2 + getForecastsForEmployees
  // pipeline app/(app)/burnout/page.tsx runs for every visible employee,
  // kept small here since the dashboard is the first page every session
  // loads.
  const topFlaggedIds = topFlagged.map((r) => r.employee.id);
  let forecastByEmployee: Record<string, ForecastPoint[]> = {};
  if (topFlaggedIds.length > 0) {
    const timezoneByEmployee = new Map(visiblePeople.map((p) => [p.id, p.timezone]));
    const capacityByEmployee = new Map(visiblePeople.map((p) => [p.id, p.weeklyCapacityHours]));
    const todayForSignals = todayInTz(me?.timezone);
    const [attendanceSignals, taskSignals] = await Promise.all([
      getAttendanceSignals(topFlaggedIds, timezoneByEmployee, todayForSignals),
      getTaskBurnoutSignals(topFlaggedIds, todayForSignals),
    ]);
    const inputsExtrasByEmployee = new Map<string, { inputs: BurnoutInputs; extras: BurnoutV2Extras }>();
    for (const r of topFlagged) {
      const weeklyCapacityHours = capacityByEmployee.get(r.employee.id) ?? 40;
      const { inputs, extras } = buildBurnoutV2(
        r.employee,
        attendanceSignals.get(r.employee.id),
        taskSignals.get(r.employee.id),
        weeklyCapacityHours
      );
      inputsExtrasByEmployee.set(r.employee.id, { inputs, extras });
    }
    forecastByEmployee = await getForecastsForEmployees(
      topFlaggedIds,
      timezoneByEmployee,
      capacityByEmployee,
      inputsExtrasByEmployee
    );
  }

  // Mood — org-wide numbers only exist through the anti-de-anonymization RPC;
  // direct row reads are scoped to your own check-ins by RLS.
  const teamNames = Array.from(new Set(employees.map((e) => e.team)));
  const teamAggregates = await Promise.all(
    teamNames.map(async (team) => {
      const { data } = await supabase.rpc("get_team_mood_aggregate", { target_team: team });
      const row = data?.[0] ?? { avg_mood: null, checkin_count: 0 };
      return { avgMood: row.avg_mood as number | null, checkinCount: row.checkin_count as number };
    })
  );
  const totalCheckinsToday = teamAggregates.reduce((s, a) => s + a.checkinCount, 0);
  const avgEligible = teamAggregates.filter((a) => a.avgMood !== null);
  const avgWeightedCount = avgEligible.reduce((s, a) => s + a.checkinCount, 0);
  const orgAvgMood =
    avgWeightedCount > 0
      ? avgEligible.reduce((s, a) => s + a.avgMood! * a.checkinCount, 0) / avgWeightedCount
      : null;

  // Kudos — readable org-wide by design (kudos are semi-public praise).
  // The count and the recent rows don't depend on each other, so they go
  // out together rather than as two back-to-back round trips.
  const weekStart = startOfWeekISO();
  const [{ count: kudosWeekCount }, { data: recentKudosRows }] = await Promise.all([
    supabase.from("kudos").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
    supabase
      .from("kudos")
      .select("id, from_employee_id, to_employee_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const employeeName = new Map(employees.map((e) => [e.id, e.name]));
  const recentKudos = (recentKudosRows ?? []).map((row) => ({
    id: row.id as string,
    fromName: employeeName.get(row.from_employee_id as string) ?? "Someone",
    toName: employeeName.get(row.to_employee_id as string) ?? "a teammate",
    createdAt: row.created_at as string,
  }));

  const todayRows = [
    { label: "Mood check-ins", value: totalCheckinsToday, max: headcount, color: "var(--pillar-mood)" },
    { label: "Attendance", value: workingToday, max: headcount, color: "var(--success)" },
    { label: "Kudos this week", value: kudosWeekCount ?? 0, max: headcount, color: "var(--pillar-kudos)" },
    { label: "Stretched today", value: flagged.length, max: headcount, color: "var(--pillar-burnout)" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title={title}
        description={dateLine}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {employees.slice(0, 6).map((e) => (
                <span key={e.id} className="inline-flex rounded-full ring-2 ring-surface">
                  <Avatar name={e.name} color={e.avatarColor} size={28} />
                </span>
              ))}
            </div>
            <span className="text-xs text-ink-mute">{workingToday} in today</span>
          </div>
        }
      />

      {/* Zone A — your session, and your day */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <SectionLabel className="mb-3">Your session</SectionLabel>
          {me ? (
            <SessionBar
              openSession={openSession}
              schedule={mySettings ? { startMin: mySettings.schedule.startMin, endMin: mySettings.schedule.endMin } : null}
              timezone={me.timezone}
              last7DaysHours={last7DaysHours}
            />
          ) : (
            <p className="text-xs text-ink-mute">Sign in to clock in.</p>
          )}
          {currentEmployeeId ? <LiveSessionRefresh employeeId={currentEmployeeId} /> : null}
        </Card>

        <Card>
          <SectionLabel className="mb-3">Your day</SectionLabel>
          <div className="space-y-2.5">
            {!moodCheckedIn ? (
              <Link href="/mood" className="flex items-center gap-2 text-xs font-medium text-brand-ink hover:underline">
                <Icon name="smile" size={14} />
                Check in your mood today
              </Link>
            ) : null}
            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <Icon name="list" size={14} className="text-ink-mute" />
              {dueToday.length > 0 ? (
                <Link href="/tasks" className="hover:underline">
                  {dueToday.length} task{dueToday.length === 1 ? "" : "s"} due today
                </Link>
              ) : (
                "Nothing due today"
              )}
            </div>
            {nextOneOnOne ? (
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Icon name="check" size={14} className="text-ink-mute" />
                <Link href="/one-on-ones" className="hover:underline">
                  1:1 with {nextOneOnOne.managerId === me?.id ? nextOneOnOne.employeeName : nextOneOnOne.managerName}{" "}
                  on {fmtDate(nextOneOnOne.scheduledFor)}
                </Link>
              </div>
            ) : null}
            {currentMeeting ? (
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Icon name="calendar" size={14} className="text-ink-mute" />
                In &ldquo;{currentMeeting.title}&rdquo; until{" "}
                {new Date(currentMeeting.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}
              </div>
            ) : null}
            {moodCheckedIn && dueToday.length === 0 && !nextOneOnOne && !currentMeeting ? (
              <p className="text-xs text-ink-mute">Nothing else on your plate right now.</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Zone B — needs you. Absent entirely when empty, not a zero-state card. */}
      {needsYouItems.length > 0 ? (
        <div className="mt-6">
          <SectionLabel className="mb-3">Needs you</SectionLabel>
          <Card className="divide-y divide-line p-0">
            {needsYouItems.map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2"
              >
                <Icon name={item.icon} size={16} className="text-ink-mute" />
                {item.label}
                <Icon name="check" size={14} className="ml-auto text-ink-mute" />
              </Link>
            ))}
          </Card>
        </div>
      ) : null}

      {/* Zone C — your work */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Your work</SectionLabel>
          <Link href="/tasks" className="text-xs font-semibold text-brand-ink hover:underline">
            View all →
          </Link>
        </div>
        {topTasks.length === 0 ? (
          <EmptyState icon="list" message="Nothing assigned to you right now." />
        ) : (
          <Card className="divide-y divide-line p-0">
            {topTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: task.project_color ?? "var(--brand)" }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{task.title}</span>
                <span className="shrink-0 text-xs text-ink-mute">{task.project_name}</span>
                {task.due_date ? (
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      today && task.due_date < today ? "text-risk-high" : "text-ink-mute"
                    }`}
                  >
                    {task.due_date === today ? "Today" : fmtDate(task.due_date)}
                  </span>
                ) : null}
              </Link>
            ))}
          </Card>
        )}
      </div>

      {/* Zone D — org pulse. Same query set for everyone; the burnout flags
          above are already narrowed to what this viewer may see, so this
          zone doesn't need a second, cruder role split on top of that. */}
      <div className="mt-10">
        <SectionLabel className="mb-3">Org pulse</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Headcount" value={headcount} sub={`${teamCount} teams`} color="var(--brand)" />
          <StatTile label="In today" value={workingToday} sub={`of ${headcount}`} color="var(--success)" />
          {/* A bare em-dash here is the 3-check-in anonymity floor doing its
              job, but it reads exactly like a query that failed. /mood and
              /insights both say why in this situation; this now matches them. */}
          <StatTile
            label="Avg mood"
            value={orgAvgMood !== null ? `${orgAvgMood.toFixed(1)} / 5` : "Needs 3+"}
            sub={
              orgAvgMood !== null
                ? `${totalCheckinsToday} checked in today`
                : `${totalCheckinsToday} checked in today · hidden until 3 people have`
            }
            color="var(--pillar-mood)"
          />
          <StatTile
            label="Flagged"
            value={flagged.length}
            sub={`${criticalCount} critical · ${highCount} high`}
            color="var(--risk-high)"
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Burnout flags</SectionLabel>
              <Link href="/burnout" className="text-xs font-semibold text-brand-ink hover:underline">
                View all →
              </Link>
            </div>
            {topFlaggedWithHistory.length === 0 ? (
              <EmptyState icon="activity" message="Nobody is currently flagged for elevated burnout risk." />
            ) : (
              <Card className="divide-y divide-line p-0">
                {topFlaggedWithHistory.map(({ employee, scores, history }) => (
                  <div key={employee.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={employee.name} color={employee.avatarColor} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{employee.name}</div>
                      <div className="text-xs text-ink-mute">
                        {employee.team} · {employee.role}
                      </div>
                    </div>
                    <BandChip band={scores.band} />
                    <div className="flex flex-col items-end gap-0.5">
                      <Sparkline
                        values={history.map((h) => h.composite)}
                        width={72}
                        height={22}
                        stroke={RISK_STROKE[scores.band]}
                      />
                      <span className="text-xs text-ink-mute">14d</span>
                    </div>
                    {(() => {
                      const forecast = forecastByEmployee[employee.id];
                      const last = forecast?.[forecast.length - 1];
                      if (!last) return null;
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono text-sm font-semibold" style={{ color: RISK_STROKE[last.bandV2] }}>
                            {last.compositeV2}
                          </span>
                          <span className="text-xs text-ink-mute">in 7d</span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionLabel className="mb-3">Today</SectionLabel>
            {todayRows.map((row) => (
              <div key={row.label} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-soft">{row.label}</span>
                  <span className="font-semibold text-ink">
                    {row.value}
                    <span className="font-normal text-ink-mute">/{row.max}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionLabel className="mb-3">Recent kudos</SectionLabel>
            {recentKudos.length === 0 ? (
              <p className="text-xs text-ink-mute">No kudos sent yet.</p>
            ) : (
              <div className="space-y-3">
                {recentKudos.map((k) => (
                  <div key={k.id} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                      <Icon name="coffee" size={14} />
                    </span>
                    <div>
                      <p className="text-xs leading-snug text-ink">
                        {k.toName} received kudos from {k.fromName}
                      </p>
                      <span className="text-xs text-ink-mute">{relativeTime(k.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
