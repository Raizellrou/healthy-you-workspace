import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { MoodClient, type TeamAggregate } from "./MoodClient";

export default async function MoodPage() {
  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId();
  const today = new Date().toISOString().slice(0, 10);

  let initialPicked: 1 | 2 | 3 | 4 | 5 | null = null;
  if (employeeId) {
    const { data } = await supabase
      .from("mood_checkins")
      .select("mood_value")
      .eq("employee_id", employeeId)
      .eq("date", today)
      .maybeSingle();
    if (data) initialPicked = data.mood_value as 1 | 2 | 3 | 4 | 5;
  }

  const employees = await getEmployees();
  const teams = Array.from(new Set(employees.map((e) => e.team)));

  const aggregateEntries = await Promise.all(
    teams.map(async (team) => {
      const { data } = await supabase.rpc("get_team_mood_aggregate", {
        target_team: team,
      });
      const row = data?.[0] ?? { avg_mood: null, checkin_count: 0 };
      const aggregate: TeamAggregate = {
        avgMood: row.avg_mood as number | null,
        checkinCount: row.checkin_count as number,
      };
      return [team, aggregate] as const;
    })
  );
  const teamAggregates = Object.fromEntries(aggregateEntries);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead title="Track the Mood" description="A quick, private daily check-in." />
      <MoodClient initialPicked={initialPicked} teamAggregates={teamAggregates} />
    </div>
  );
}
