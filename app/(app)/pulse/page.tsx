import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Sparkline } from "@/components/burnout/Sparkline";
import { MetricBar } from "@/components/insights/MetricBar";
import {
  getCurrentPulseQuestion,
  getPulseResults,
  hasAnsweredPulse,
  getPulseTrend,
} from "@/lib/supabase/pulse";
import { fmtDate } from "@/lib/date";
import { PulseClient } from "./PulseClient";

/** Open to everyone — the whole point is that everyone answers it and
 *  nobody, including HR, can see an individual answer. */
export default async function PulsePage() {
  const question = await getCurrentPulseQuestion();

  if (!question) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHead title="Weekly pulse" description="One question a week, answered anonymously." />
        <EmptyState icon="smile" message="No pulse question is scheduled yet." />
      </div>
    );
  }

  const [results, answered, trend] = await Promise.all([
    getPulseResults(question.id),
    hasAnsweredPulse(question.id),
    getPulseTrend(12),
  ]);

  const scored = trend.filter((t) => t.avgScore !== null);
  const maxDist = Math.max(1, ...(results.distribution ?? [1]));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHead
        title="Weekly pulse"
        description="One question a week, answered anonymously."
        actions={
          <InfoTooltip label="About anonymity">
            Anonymous by construction: no policy anywhere lets a response be read back to the person who gave
            it, and results stay hidden until at least three people have replied.
          </InfoTooltip>
        }
      />

      <div className="space-y-5">
        <PulseClient question={question} alreadyAnswered={answered} />

        <Card>
          <h2 className="text-sm font-bold text-ink">This week&rsquo;s results</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Week of {fmtDate(question.weekStart)} · {results.responseCount}{" "}
            {results.responseCount === 1 ? "response" : "responses"}
          </p>
          {results.avgScore === null || !results.distribution ? (
            <EmptyState
              icon="lock"
              message={`Held until 3 people answer. ${results.responseCount} so far. Publishing a result from one or two answers would identify them.`}
            />
          ) : (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold text-ink">{results.avgScore.toFixed(1)}</span>
                <span className="text-xs text-ink-mute">out of 5</span>
              </div>
              <div className="space-y-2">
                {results.distribution.map((count, i) => (
                  <MetricBar
                    key={i}
                    label={`${i + 1}`}
                    value={count}
                    display={String(count)}
                    scaleMax={maxDist}
                    color="#FFB5C5"
                  />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-ink">Trend</h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-mute">
            Weekly averages across past questions. Weeks that never reached three answers stay blank rather than
            being estimated.
          </p>
          {scored.length === 0 ? (
            <EmptyState icon="activity" message="No past week has cleared the 3-answer floor yet." />
          ) : (
            <>
              <Sparkline
                // Sparkline plots on a 0-100 scale; a 1-5 score maps by x20.
                values={scored.map((t) => (t.avgScore as number) * 20)}
                stroke="#FFB5C5"
                filled
                width={520}
                height={64}
              />
              <ul className="mt-3 space-y-1.5">
                {scored.slice(-4).reverse().map((t) => (
                  <li key={t.weekStart} className="flex items-start justify-between gap-3 text-xs">
                    <span className="min-w-0 text-ink-soft">{t.prompt}</span>
                    <span className="shrink-0 font-mono text-ink">{t.avgScore?.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
