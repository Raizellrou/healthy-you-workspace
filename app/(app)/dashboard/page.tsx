import type { ReactNode } from "react";
import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/icons/Icon";
import { BandChip } from "@/components/burnout/BandChip";
import { Sparkline } from "@/components/burnout/Sparkline";
import { Logo } from "@/components/shell/Logo";
import { NudgeStat } from "./NudgeStat";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees, getBurnoutHistory, getWorkload } from "@/lib/supabase/queries";
import { computeBurnout } from "@/lib/burnout";
import { PILLARS } from "@/lib/pillars";
import type { BurnoutBand } from "@/types/burnout";

const PILLAR_ACCENT: Record<string, string> = {
  "/burnout": "#6F49A6",
  "/nudges": "#C7A2E5",
  "/mood": "#FFB5C5",
  "/boundary": "#A8D592",
  "/kudos": "#87D380",
  "/tasks": "#4E3378",
  "/focus": "#87CEEB",
};

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

function StatTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-2 text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-ink-mute">{sub}</div> : null}
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [employees, currentEmployeeId, workload] = await Promise.all([
    getEmployees(),
    getCurrentEmployeeId(),
    getWorkload(),
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

  // Burnout — computeBurnout is pure, so this needs zero extra queries beyond
  // the employee stats getEmployees() already returns.
  const burnoutRows = employees.map((e) => ({ employee: e, scores: computeBurnout(e) }));
  const flagged = burnoutRows.filter((r) => r.scores.band === "high" || r.scores.band === "critical");
  const criticalCount = flagged.filter((r) => r.scores.band === "critical").length;
  const highCount = flagged.filter((r) => r.scores.band === "high").length;
  const topFlagged = [...flagged].sort((a, b) => b.scores.composite - a.scores.composite).slice(0, 3);
  const topFlaggedWithHistory = await Promise.all(
    topFlagged.map(async (r) => ({ ...r, history: await getBurnoutHistory(r.employee.id) }))
  );

  // Mood — org-wide numbers only exist through the anti-de-anonymization RPC;
  // direct row reads are scoped to your own check-ins by RLS.
  const teams = Array.from(new Set(employees.map((e) => e.team)));
  const teamAggregates = await Promise.all(
    teams.map(async (team) => {
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
  const weekStart = startOfWeekISO();
  const { count: kudosWeekCount } = await supabase
    .from("kudos")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekStart);

  const { data: recentKudosRows } = await supabase
    .from("kudos")
    .select("id, from_employee_id, to_employee_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  const employeeName = new Map(employees.map((e) => [e.id, e.name]));
  const recentKudos = (recentKudosRows ?? []).map((row) => ({
    id: row.id as string,
    fromName: employeeName.get(row.from_employee_id as string) ?? "Someone",
    toName: employeeName.get(row.to_employee_id as string) ?? "a teammate",
    createdAt: row.created_at as string,
  }));

  // Boundary/Anchor — RLS scopes reads to your own sent events (a personal
  // log by design, not an org-wide feed), so this is "your" count, not the org's.
  let myHeldThisWeek = 0;
  if (currentEmployeeId) {
    const { count } = await supabase
      .from("boundary_events")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", currentEmployeeId)
      .eq("action", "delayed")
      .gte("sent_at", weekStart);
    myHeldThisWeek = count ?? 0;
  }

  const openTasksTotal = workload.reduce((s, w) => s + w.open_count, 0);
  const highPriorityOpen = workload.reduce((s, w) => s + w.high_count, 0);

  function pillarMetric(href: string): ReactNode {
    switch (href) {
      case "/burnout":
        return `${flagged.length} flagged`;
      case "/nudges":
        return <NudgeStat />;
      case "/mood":
        return `${totalCheckinsToday} / ${headcount} checked in`;
      case "/boundary":
        return myHeldThisWeek > 0 ? `${myHeldThisWeek} of yours held this wk` : "None of yours held this week";
      case "/kudos":
        return `${kudosWeekCount ?? 0} kudos this week`;
      case "/tasks":
        return `${openTasksTotal} open task${openTasksTotal === 1 ? "" : "s"}`;
      case "/focus":
        return `${flagged.length} stretched today`;
      default:
        return null;
    }
  }

  function pillarNeedsAttention(href: string): boolean {
    switch (href) {
      case "/burnout":
      case "/focus":
        return flagged.length > 0;
      case "/mood":
        return totalCheckinsToday < Math.ceil(headcount / 2);
      case "/tasks":
        return highPriorityOpen > 0;
      default:
        return false;
    }
  }

  const todayRows = [
    { label: "Mood check-ins", value: totalCheckinsToday, max: headcount, color: "#FFB5C5" },
    { label: "Attendance", value: workingToday, max: headcount, color: "#87D380" },
    { label: "Kudos this week", value: kudosWeekCount ?? 0, max: headcount, color: "#87D380" },
    { label: "Stretched today", value: flagged.length, max: headcount, color: "#6F49A6" },
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Headcount" value={headcount} sub={`${teamCount} teams`} color="#6F49A6" />
        <StatTile label="In today" value={workingToday} sub={`of ${headcount}`} color="#87D380" />
        <StatTile
          label="Avg mood"
          value={orgAvgMood !== null ? `${orgAvgMood.toFixed(1)} / 5` : "—"}
          sub={`${totalCheckinsToday} checked in today`}
          color="#FFB5C5"
        />
        <StatTile
          label="Flagged"
          value={flagged.length}
          sub={`${criticalCount} critical · ${highCount} high`}
          color="#FF8C73"
        />
      </div>

      <div className="mt-10">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Wellbeing pillars</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const accent = PILLAR_ACCENT[p.href] ?? "#6F49A6";
            const attention = pillarNeedsAttention(p.href);
            return (
              <Link key={p.href} href={p.href} className="block">
                <Card className="h-full transition-colors hover:border-brand">
                  <div className="flex items-start justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: `${accent}1F`, color: accent }}
                    >
                      <Icon name={p.icon} size={18} />
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${attention ? "bg-risk-critical" : "bg-success"}`}
                      aria-label={attention ? "Needs attention" : "Healthy"}
                    />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-ink">{p.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{p.description}</p>
                  <div className="mt-3 text-xs font-semibold" style={{ color: accent }}>
                    {pillarMetric(p.href)}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Burnout flags</span>
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
                      <span className="text-[10px] text-ink-mute">14d</span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Today</div>
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
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Recent kudos</div>
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
                      <span className="text-[10px] text-ink-mute">{relativeTime(k.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-2.5 rounded-xl p-4" style={{ background: "#1F1F1F" }}>
            <Logo size={22} />
            <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
              Small changes can create healthier and more sustainable workdays.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Predict", "Energize", "Tune In", "Anchor", "Link", "Adapt"].map((label) => (
                <span key={label} className="text-[10px] font-semibold tracking-wide" style={{ color: "#6B7280" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
