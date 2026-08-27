import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/date";

/**
 * Weekly anonymous pulse (P8 item 9).
 *
 * Note what this module does NOT contain: any way to read an individual
 * response. There is no such query because 0023 grants no SELECT policy on
 * pulse_responses at all — every number here comes from a security-definer
 * aggregate that withholds results below 3 answers. The only per-person
 * fact available is `hasAnswered`, a boolean about yourself.
 */

export interface PulseQuestion {
  id: string;
  prompt: string;
  weekStart: IsoDate;
  lowLabel: string;
  highLabel: string;
}

export interface PulseResults {
  responseCount: number;
  /** Null until at least 3 people have answered. */
  avgScore: number | null;
  distribution: number[] | null;
}

export interface PulseTrendPoint {
  weekStart: IsoDate;
  prompt: string;
  responseCount: number;
  avgScore: number | null;
}

/** The question for the current week, if one has been scheduled. */
export async function getCurrentPulseQuestion(): Promise<PulseQuestion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pulse_questions")
    .select("id, prompt, week_start, low_label, high_label")
    .lte("week_start", new Date().toISOString().slice(0, 10))
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    prompt: data.prompt,
    weekStart: data.week_start,
    lowLabel: data.low_label,
    highLabel: data.high_label,
  };
}

export async function getPulseResults(questionId: string): Promise<PulseResults> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pulse_results", { target_question_id: questionId }).maybeSingle();
  const row = data as
    | {
        response_count: number;
        avg_score: number | null;
        dist_1: number | null;
        dist_2: number | null;
        dist_3: number | null;
        dist_4: number | null;
        dist_5: number | null;
      }
    | null;
  if (!row) return { responseCount: 0, avgScore: null, distribution: null };

  const distribution =
    row.dist_1 === null ? null : [row.dist_1, row.dist_2 ?? 0, row.dist_3 ?? 0, row.dist_4 ?? 0, row.dist_5 ?? 0];

  return { responseCount: row.response_count, avgScore: row.avg_score, distribution };
}

export async function hasAnsweredPulse(questionId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_answered_pulse", { target_question_id: questionId });
  return data === true;
}

export async function getPulseTrend(limitWeeks = 12): Promise<PulseTrendPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pulse_trend", { limit_weeks: limitWeeks });
  return ((data ?? []) as { week_start: string; prompt: string; response_count: number; avg_score: number | null }[])
    .map((r) => ({
      weekStart: r.week_start,
      prompt: r.prompt,
      responseCount: r.response_count,
      avgScore: r.avg_score,
    }))
    .reverse();
}
