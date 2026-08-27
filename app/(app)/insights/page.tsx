import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sparkline } from "@/components/burnout/Sparkline";
import { BandBar, BandLegend } from "@/components/insights/BandBar";
import { MetricBar } from "@/components/insights/MetricBar";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getOrgInsights } from "@/lib/supabase/insights";
import { describeCorrelation, MIN_CORRELATION_SAMPLE } from "@/lib/insights";
import { fmtDate } from "@/lib/date";
import type { BurnoutBand } from "@/types/burnout";
import type { CorrelationStat } from "@/lib/supabase/insights";

/** A whole-org drought (nobody thanked anyone all month) would otherwise
 *  render every employee as a row, burying the six panels below it. */
const DROUGHT_PREVIEW = 8;

/** Shared shape for the two 0028_correlations.sql-backed cards. A low
 *  sample_size (mood check-ins are opt-in, unlike the synthetic
 *  daily_activity rows) makes the Pearson coefficient itself misleading —
 *  the card refuses to show a number below MIN_CORRELATION_SAMPLE rather
 *  than rendering a coefficient a handful of points could flip the sign
 *  of. Verified live: get_offhours_mood_corr currently returns
 *  sample_size=3 against this project's real data, well under the floor,
 *  so that card renders the empty state today — not a hypothetical case. */
function CorrelationCard({
  title,
  description,
  stat,
  xLabel,
  yLabel,
}: {
  title: string;
  description: string;
  stat: CorrelationStat;
  xLabel: string;
  yLabel: string;
}) {
  return (
    <Card>
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <p className="mt-0.5 mb-3 text-xs text-ink-mute">{description}</p>
      {stat.sampleSize < MIN_CORRELATION_SAMPLE || stat.correlation === null ? (
        <EmptyState
          icon="activity"
          message={`Only ${stat.sampleSize} matched day${stat.sampleSize === 1 ? "" : "s"} of data — too few to read a correlation from.`}
        />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-ink">{stat.correlation.toFixed(2)}</span>
            <span className="text-xs text-ink-mute">{describeCorrelation(stat.correlation)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-mute">
            {stat.sampleSize} person-days · avg {stat.avgX?.toFixed(1)} {xLabel}, {stat.avgY?.toFixed(1)} {yLabel}
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * HR-only org analytics. Gated with notFound() rather than RoleGate for the
 * same reason /teams is: this is the entire route's purpose, so a 404 beats
 * an empty shell. RLS and the two is_hr()-gated RPCs are the real boundary —
 * a manager who reached this code would see their own team's numbers, not
 * the org's.
 */
export default async function InsightsPage() {
  const me = await getCurrentPerson();
  if (!me || me.appRole !== "hr") notFound();

  const insights = await getOrgInsights(me.timezone);
  const {
    headcount,
    windowDays,
    avgBurnout,
    atRiskCount,
    bandsByTeam,
    capacity,
    pto,
    recognition,
    offHours,
    offHoursByTeam,
    holds,
    moodTrend,
    meetingOffHoursCorr,
    offHoursMoodCorr,
  } = insights;

  const bandTotals = bandsByTeam.reduce(
    (acc, t) => {
      acc.low += t.low;
      acc.medium += t.medium;
      acc.high += t.high;
      acc.critical += t.critical;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 } as Record<BurnoutBand, number>
  );

  // n>=3 gated by get_org_mood_trend, so most days can legitimately be null.
  // Plotting only the days that cleared the floor is the honest line; the
  // caption says how many days those were.
  const moodPoints = moodTrend.filter((p) => p.avgMood !== null).map((p) => p.avgMood as number);
  const latestMood = moodPoints.length > 0 ? moodPoints[moodPoints.length - 1] : null;

  const maxTeamPtoDays = Math.max(1, ...pto.byTeam.map((t) => t.days));
  const maxOffHoursSent = Math.max(1, ...offHoursByTeam.map((t) => t.totalSent));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Org Insights"
        description={`Organisation-wide wellbeing and capacity signals over the last ${windowDays} days. Visible to HR only — every number here is an aggregate of data the pillars already collect.`}
      />

      {/* Exempt from the single-column preference: four small KPI tiles
          stacked would push the actual content a screen down without
          making anything easier to read. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-keep-columns>
        <Stat
          icon="activity"
          label="Avg burnout"
          value={avgBurnout}
          sub={`${atRiskCount} at high or critical risk`}
        />
        <Stat
          icon="shield"
          label="Off-hours index"
          value={`${offHours.ratePct}%`}
          sub={`${offHours.offHoursEvents} of ${offHours.totalEvents} task actions`}
        />
        <Stat
          icon="coffee"
          label="Recognition"
          value={`${recognition.coveragePct}%`}
          sub={`${recognition.coveredCount} of ${headcount} thanked`}
        />
        <Stat
          icon="inbox"
          label="Held notifications"
          value={`${holds.heldPct}%`}
          sub={`${holds.held} of ${holds.total} deferred`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-bold text-ink">Burnout by team</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Task-aware composite band per person, grouped by team. Most at-risk team first.
          </p>
          <div className="mb-3">
            <BandLegend totals={bandTotals} />
          </div>
          {bandsByTeam.length === 0 ? (
            <EmptyState icon="users" message="No employees in scope." />
          ) : (
            <div className="space-y-3">
              {bandsByTeam.map((team) => (
                <div key={team.team}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-medium text-ink-soft">{team.team}</span>
                    <span className="font-mono text-ink-mute">
                      avg <span className="font-semibold text-ink">{team.avgScore}</span> · {team.total}{" "}
                      {team.total === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <BandBar
                    counts={{ low: team.low, medium: team.medium, high: team.high, critical: team.critical }}
                    total={team.total}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Capacity by team</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Mean committed hours as a share of weekly capacity. Everyone counts, including people with nothing
            assigned.
          </p>
          {capacity.length === 0 ? (
            <EmptyState icon="list" message="No capacity data yet." />
          ) : (
            <div className="space-y-3">
              {capacity.map((team) => (
                <MetricBar
                  key={team.team}
                  label={team.team}
                  value={team.avgLoadPct}
                  display={`${team.avgLoadPct}%`}
                  sub={team.overCapacityCount > 0 ? `· ${team.overCapacityCount} over` : undefined}
                  emphasis
                  color={team.avgLoadPct > 100 ? "#FF8C73" : team.avgLoadPct >= 75 ? "#FFD700" : "#87D380"}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Mood trend</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Org-wide daily average. Days with fewer than 3 check-ins are withheld entirely — the anonymity floor
            is enforced in the database, not here.
          </p>
          {moodPoints.length === 0 ? (
            <EmptyState
              icon="smile"
              message={`No day in the last ${windowDays} reached the 3-check-in anonymity floor.`}
            />
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold text-ink">{latestMood?.toFixed(1)}</span>
                <span className="text-xs text-ink-mute">most recent qualifying day</span>
              </div>
              <div className="mt-3">
                <Sparkline values={moodPoints} stroke="#FFB5C5" filled width={272} height={56} />
              </div>
              <p className="mt-2 text-xs text-ink-mute">
                {moodPoints.length} of {moodTrend.length} days cleared the floor.
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">PTO utilisation</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Approved weekdays taken per team in the window. A weekend inside a request doesn&rsquo;t count as
            time off.
          </p>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-ink">{pto.avgDaysPerPerson}</span>
            <span className="text-xs text-ink-mute">
              avg days per person · {pto.peopleWithPto} of {pto.headcount} took any
            </span>
          </div>
          {pto.byTeam.length === 0 ? (
            <EmptyState icon="timer" message="No teams in scope." />
          ) : (
            <div className="space-y-3">
              {pto.byTeam.map((team) => (
                <MetricBar
                  key={team.team}
                  label={team.team}
                  value={team.days}
                  display={`${team.days}d`}
                  sub={`· ${team.memberCount} ${team.memberCount === 1 ? "person" : "people"}`}
                  scaleMax={maxTeamPtoDays}
                  color="#87CEEB"
                  emphasis
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Recognition drought</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Nobody has sent these people kudos in {windowDays} days. A healthy total kudos count can still hide
            this — the same few people often collect most of it.
          </p>
          {recognition.drought.length === 0 ? (
            <EmptyState icon="check" message="Everyone has been recognised in the window." />
          ) : (
            <ul className="space-y-1.5">
              {recognition.drought.slice(0, DROUGHT_PREVIEW).map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs">
                    <Avatar name={person.name} color={person.avatarColor} size={22} />
                    <span className="truncate font-medium text-ink">{person.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-mute">{person.team}</span>
                </li>
              ))}
              {recognition.drought.length > DROUGHT_PREVIEW ? (
                <li className="px-3 pt-1 text-xs text-ink-mute">
                  + {recognition.drought.length - DROUGHT_PREVIEW} more with no kudos in the window
                </li>
              ) : null}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Boundary pressure</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Scheduled messages per team, and how many landed outside the recipient&rsquo;s hours and had to be
            held.
          </p>
          {offHoursByTeam.length === 0 ? (
            <EmptyState icon="shield" message={`No messages scheduled in the last ${windowDays} days.`} />
          ) : (
            <div className="space-y-3">
              {offHoursByTeam.map((team) => (
                <MetricBar
                  key={team.team}
                  label={team.team}
                  value={team.totalSent}
                  display={`${team.delayedCount} held`}
                  sub={`of ${team.totalSent} sent`}
                  scaleMax={maxOffHoursSent}
                  color="#A8D592"
                  emphasis
                />
              ))}
            </div>
          )}
        </Card>

        <CorrelationCard
          title="Meetings vs. off-hours work"
          description="Does a heavier meeting day push people into working off-hours? Correlation across every scheduled day, org-wide."
          stat={meetingOffHoursCorr}
          xLabel="meeting hours"
          yLabel="off-hours messages"
        />

        <CorrelationCard
          title="Off-hours work vs. mood"
          description="Does working off-hours track with lower self-reported mood? Correlation on days with both a real signal."
          stat={offHoursMoodCorr}
          xLabel="off-hours messages"
          yLabel="mood (1-5)"
        />
      </div>

      <Card className="mt-5">
        <h2 className="text-sm font-bold text-ink">Where notifications went</h2>
        <p className="mt-0.5 mb-3 text-xs text-ink-mute">
          Every notification in the window, by what the delivery funnel decided to do with it. This is the
          right-to-disconnect machinery&rsquo;s actual output — not a settings screen.
        </p>
        {holds.total === 0 ? (
          <EmptyState icon="inbox" message={`No notifications in the last ${windowDays} days.`} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {holds.breakdown.map((item) => (
              <Chip key={item.reason} tone={item.reason === "delivered" ? "neutral" : "brand"}>
                {item.label}
                <span className="font-mono font-semibold">{item.count}</span>
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-5 text-xs text-ink-mute">
        Window: {fmtDate(insights.today)} back {windowDays} days · {headcount} people in scope.
      </p>
    </div>
  );
}
