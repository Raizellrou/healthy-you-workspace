import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { todayInTz, addDays } from "@/lib/date";
import { weightedMoodAverage } from "@/lib/mood";
import { MoodClient, type TeamAggregate, type OrgTrendPoint } from "./MoodClient";

export default async function MoodPage() {
  const supabase = await createClient();
  const [employeeId, currentPerson] = await Promise.all([getCurrentEmployeeId(), getCurrentPerson()]);
  const today = todayInTz(currentPerson?.timezone);

  let initialPicked: 1 | 2 | 3 | 4 | 5 | null = null;
  let initialEnergy: number | null = null;
  let initialNote = "";
  let initialTags: string[] = [];
  let streak = 0;
  if (employeeId) {
    const [{ data }, { data: streakData }] = await Promise.all([
      supabase
        .from("mood_checkins")
        .select("mood_value, energy, note, tags")
        .eq("employee_id", employeeId)
        .eq("date", today)
        .maybeSingle(),
      supabase.rpc("get_mood_streak", { target_employee_id: employeeId }),
    ]);
    if (data) {
      initialPicked = data.mood_value as 1 | 2 | 3 | 4 | 5;
      initialEnergy = data.energy as number | null;
      initialNote = (data.note as string | null) ?? "";
      initialTags = (data.tags as string[] | null) ?? [];
    }
    streak = (streakData as number | null) ?? 0;
  }

  const employees = await getEmployees();
  const teams = Array.from(new Set(employees.map((e) => e.team)));
  const lastWeek = addDays(today, -7);

  const aggregateEntries = await Promise.all(
    teams.map(async (team) => {
      const [todayRes, lastWeekRes] = await Promise.all([
        supabase.rpc("get_team_mood_aggregate", { target_team: team, target_date: today }),
        supabase.rpc("get_team_mood_aggregate", { target_team: team, target_date: lastWeek }),
      ]);
      const row = todayRes.data?.[0] ?? { avg_mood: null, checkin_count: 0 };
      const priorRow = lastWeekRes.data?.[0] ?? { avg_mood: null, checkin_count: 0 };
      const aggregate: TeamAggregate = {
        avgMood: row.avg_mood as number | null,
        checkinCount: row.checkin_count as number,
        avgMoodLastWeek: priorRow.avg_mood as number | null,
        checkinCountLastWeek: priorRow.checkin_count as number,
      };
      return [team, aggregate] as const;
    })
  );
  const teamAggregates = Object.fromEntries(aggregateEntries);

  const allAggregates = aggregateEntries.map(([, agg]) => agg);
  const totalCheckinsToday = allAggregates.reduce((s, a) => s + a.checkinCount, 0);
  const orgAvgToday = weightedMoodAverage(allAggregates);
  const orgAvgLastWeek = weightedMoodAverage(
    allAggregates.map((a) => ({ avgMood: a.avgMoodLastWeek, checkinCount: a.checkinCountLastWeek }))
  );

  const { data: trendRows } = await supabase.rpc("get_org_mood_trend", { days: 30 });
  const orgTrend: OrgTrendPoint[] = (trendRows ?? []).map((row: { day: string; avg_mood: number | null; checkin_count: number }) => ({
    day: row.day,
    avgMood: row.avg_mood,
    checkinCount: row.checkin_count,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FFB5C5" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#D4728A" }}>
          Tune In · Pillar 3
        </span>
      </div>
      <PageHead title="Track the Mood" description="A quick, private daily check-in." />
      <MoodClient
        initialPicked={initialPicked}
        initialEnergy={initialEnergy}
        initialNote={initialNote}
        initialTags={initialTags}
        streak={streak}
        teamAggregates={teamAggregates}
        orgAvgToday={orgAvgToday}
        orgAvgLastWeek={orgAvgLastWeek}
        totalCheckinsToday={totalCheckinsToday}
        headcount={employees.length}
        orgTrend={orgTrend}
      />
    </div>
  );
}
