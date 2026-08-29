"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { applyRebalanceMoves } from "@/app/(app)/tasks/actions";
import { useActionToast } from "@/lib/toast-context";
import type { RebalanceMove } from "@/lib/rebalance";

/** Manager/HR-only card on the Workload page (gated by the caller's
 *  RoleGate). Shows lib/rebalance.ts's suggested moves and lets the viewer
 *  apply one or all of them in a single click — the "so what do I actually
 *  do about this" answer to a red bar. */
export function RebalanceSuggestions({ moves }: { moves: RebalanceMove[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null); // taskId, or "all"
  const [isPending, startTransition] = useTransition();
  const [confirmApplyAllOpen, setConfirmApplyAllOpen] = useState(false);
  const run = useActionToast();

  const visible = moves.filter((m) => !dismissed.has(m.taskId) && !applied.has(m.taskId));

  function skip(taskId: string) {
    setDismissed((prev) => new Set(prev).add(taskId));
  }

  function applyOne(move: RebalanceMove) {
    setPending(move.taskId);
    startTransition(async () => {
      const result = await run(
        () =>
          applyRebalanceMoves({
            moves: [{ taskId: move.taskId, fromEmployeeId: move.fromEmployeeId, toEmployeeId: move.toEmployeeId }],
          }),
        { success: `Moved "${move.taskTitle}" to ${move.toName}.` }
      );
      setPending(null);
      if (!result.ok) return;
      setApplied((prev) => new Set(prev).add(move.taskId));
    });
  }

  function applyAll() {
    setConfirmApplyAllOpen(false);
    setPending("all");
    startTransition(async () => {
      const result = await run(
        () =>
          applyRebalanceMoves({
            moves: visible.map((m) => ({ taskId: m.taskId, fromEmployeeId: m.fromEmployeeId, toEmployeeId: m.toEmployeeId })),
          }),
        { success: `${visible.length} move${visible.length === 1 ? "" : "s"} applied.` }
      );
      setPending(null);
      if (!result.ok) return;
      setApplied((prev) => new Set([...prev, ...visible.map((m) => m.taskId)]));
    });
  }

  if (visible.length === 0) {
    return applied.size > 0 ? (
      <Card>
        <p className="text-sm text-ink-soft">Rebalance applied. {applied.size} task{applied.size === 1 ? "" : "s"} moved.</p>
      </Card>
    ) : null;
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Suggested rebalance</h2>
          <p className="mt-0.5 text-xs text-ink-mute">
            {visible.length} move{visible.length === 1 ? "" : "s"} to bring everyone under 100% capacity.
          </p>
        </div>
        {visible.length > 1 ? (
          <Button variant="primary" size="sm" onClick={() => setConfirmApplyAllOpen(true)} disabled={isPending}>
            {pending === "all" ? "Applying…" : "Apply all"}
          </Button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {visible.map((move) => (
          <li
            key={move.taskId}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs"
          >
            <span className="text-ink-soft">
              Move <span className="font-medium text-ink">&ldquo;{move.taskTitle}&rdquo;</span> ({move.estimateHours}h):{" "}
              <span className="font-medium text-ink">{move.fromName}</span> →{" "}
              <span className="font-medium text-ink">{move.toName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => skip(move.taskId)} disabled={isPending}>
                Skip
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyOne(move)} disabled={isPending}>
                {pending === move.taskId ? "Applying…" : "Apply"}
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={confirmApplyAllOpen}
        onClose={() => setConfirmApplyAllOpen(false)}
        onConfirm={applyAll}
        title="Apply all rebalance moves"
        message={`Apply all ${visible.length} rebalance moves? Tasks will be reassigned.`}
        tone="default"
        confirmLabel="Apply all"
        pending={isPending && pending === "all"}
      />
    </Card>
  );
}
