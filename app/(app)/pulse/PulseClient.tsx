"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { submitPulse } from "./actions";
import type { PulseQuestion } from "@/lib/supabase/pulse";

const SCORES = [1, 2, 3, 4, 5];

export function PulseClient({
  question,
  alreadyAnswered,
}: {
  question: PulseQuestion;
  alreadyAnswered: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(alreadyAnswered);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(score: number) {
    setSelected(score);
    setError(null);
    startTransition(async () => {
      const result = await submitPulse({ questionId: question.id, score });
      if (!result.ok) {
        setError(result.error ?? "Couldn't record that.");
        setSelected(null);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <Card>
        <p className="text-sm font-medium text-ink">Answer recorded.</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-mute">
          Your score isn&rsquo;t readable by anyone — not your manager, not HR, not the person who set the
          question. Results appear below once at least three people have answered.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-medium text-ink">{question.prompt}</p>
      <div className="mt-4 flex gap-2">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => submit(score)}
            disabled={isPending}
            aria-label={`${score} out of 5`}
            className={`flex-1 rounded-lg border py-3 font-mono text-sm font-semibold transition-colors disabled:opacity-60 ${
              selected === score
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-mute">
        <span>{question.lowLabel}</span>
        <span>{question.highLabel}</span>
      </div>
      {error ? <p className="mt-3 text-xs text-risk-critical">{error}</p> : null}
    </Card>
  );
}
