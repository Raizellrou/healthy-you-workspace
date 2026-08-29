/** Org/team mood aggregates come from `get_team_mood_aggregate` per team,
 *  each already averaged within that team — combining them into one number
 *  needs a checkin-count-weighted mean, not a plain average of averages
 *  (a 2-person team's mood shouldn't move the org number as much as a
 *  20-person team's). Teams with no check-ins (`avgMood: null`) are
 *  excluded from both the weighted sum and the total. */
export function weightedMoodAverage(entries: { avgMood: number | null; checkinCount: number }[]): number | null {
  const eligible = entries.filter((e) => e.avgMood !== null);
  const totalCheckins = eligible.reduce((sum, e) => sum + e.checkinCount, 0);
  if (totalCheckins === 0) return null;
  return eligible.reduce((sum, e) => sum + e.avgMood! * e.checkinCount, 0) / totalCheckins;
}
