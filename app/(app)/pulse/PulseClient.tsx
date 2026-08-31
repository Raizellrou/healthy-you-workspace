"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { PokeBadge } from "@/components/ui/PokeBadge";
import { Icon } from "@/components/icons/Icon";
import { submitPulse } from "./actions";
import { useActionToast } from "@/lib/toast-context";
import type { PulseQuestion } from "@/lib/supabase/pulse";

const SCORES = [1, 2, 3, 4, 5];

/** Purely decorative — a poke on the recorded checkmark, no data implication. */
const RECORDED_REACTIONS = ["Thanks!", "Noted", "Appreciate it", "Got it"];

export function PulseClient({
  question,
  alreadyAnswered,
}: {
  question: PulseQuestion;
  alreadyAnswered: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(alreadyAnswered);
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();

  function submit(score: number) {
    setSelected(score);
    startTransition(async () => {
      const result = await run(() => submitPulse({ questionId: question.id, score }), {
        onError: () => setSelected(null),
      });
      if (result.ok) setDone(true);
    });
  }

  if (done) {
    return (
      <Card key="done" className="animate-toast-in">
        <div className="flex items-center gap-2.5">
          <PokeBadge reactions={RECORDED_REACTIONS} label="Tap the checkmark">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "#87D38018", color: "#2A7A26" }}
            >
              <Icon name="check" size={16} />
            </span>
          </PokeBadge>
          <p className="text-sm font-medium text-ink">Answer recorded.</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-mute">
          Your score isn&rsquo;t readable by anyone. Not your manager, not HR, not the person who set the
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
    </Card>
  );
}
