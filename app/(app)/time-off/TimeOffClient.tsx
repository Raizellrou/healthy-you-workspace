"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { requestPto, cancelPto, decidePto } from "@/app/(app)/attendance/actions";
import { fmtDate } from "@/lib/date";
import { useActionToast } from "@/lib/toast-context";
import type { PtoRequest } from "@/lib/supabase/attendance";

const KIND_LABEL: Record<PtoRequest["kind"], string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  mental_health: "Mental health",
};

const STATUS_TONE: Record<PtoRequest["status"], ChipTone> = {
  pending: "warning",
  approved: "success",
  denied: "critical",
  cancelled: "neutral",
};

export function TimeOffClient({
  mine,
  pendingForOthers,
}: {
  mine: PtoRequest[];
  pendingForOthers: PtoRequest[];
}) {
  const router = useRouter();
  const [mineRows, setMineRows] = useState(mine);
  const [othersRows, setOthersRows] = useState(pendingForOthers);
  // router.refresh() re-renders this component with fresh server props
  // without remounting it, so local optimistic state needs to resync once
  // the real data lands — same render-time-resync shape FocusClient uses
  // for its session-identity prop.
  const mineSignature = mine.map((r) => `${r.id}:${r.status}`).join(",");
  const [prevMineSignature, setPrevMineSignature] = useState(mineSignature);
  if (mineSignature !== prevMineSignature) {
    setPrevMineSignature(mineSignature);
    setMineRows(mine);
  }
  const othersSignature = pendingForOthers.map((r) => r.id).join(",");
  const [prevOthersSignature, setPrevOthersSignature] = useState(othersSignature);
  if (othersSignature !== prevOthersSignature) {
    setPrevOthersSignature(othersSignature);
    setOthersRows(pendingForOthers);
  }
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState<PtoRequest["kind"]>("vacation");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PtoRequest | null>(null);
  const [denyTarget, setDenyTarget] = useState<PtoRequest | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const run = useActionToast();

  function handleSubmit() {
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await run(() => requestPto({ startDate, endDate, kind, note: note.trim() || undefined }), {
        success: "Time off request submitted.",
      });
      if (!result.ok) return;
      setStartDate("");
      setEndDate("");
      setNote("");
      setComposerOpen(false);
      router.refresh();
    });
  }

  function handleCloseComposer() {
    if (isPending) return;
    setError(null);
    setComposerOpen(false);
  }

  function handleCancel(id: string) {
    setCancelTarget(null);
    setPendingRowId(id);
    startTransition(async () => {
      const result = await run(() => cancelPto(id), { success: "Time off request cancelled." });
      setPendingRowId(null);
      if (result.ok) {
        setMineRows((rows) => rows.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
      }
      router.refresh();
    });
  }

  function handleDecide(id: string, status: "approved" | "denied") {
    setDenyTarget(null);
    setPendingRowId(id);
    startTransition(async () => {
      const result = await run(() => decidePto({ requestId: id, status }), {
        success: status === "approved" ? "Request approved." : "Request denied.",
      });
      setPendingRowId(null);
      if (result.ok) {
        setOthersRows((rows) => rows.filter((r) => r.id !== id));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button type="button" onClick={() => setComposerOpen(true)}>
          Request time off
        </Button>
      </div>

      {othersRows.length > 0 && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-ink">Pending approvals</div>
          <ul className="space-y-2">
            {othersRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <Avatar name={r.employeeName} color={r.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{r.employeeName}</div>
                  <div className="text-xs text-ink-mute">
                    {KIND_LABEL[r.kind]} · {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                    {r.note ? ` · "${r.note}"` : ""}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDecide(r.id, "approved")}
                  disabled={isPending}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => setDenyTarget(r)}
                  disabled={isPending}
                >
                  Deny
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 text-sm font-semibold text-ink">My requests</div>
        {mineRows.length === 0 ? (
          <p className="text-xs text-ink-mute">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {mineRows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">
                    {KIND_LABEL[r.kind]} · {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                  </div>
                  {r.note ? <div className="text-xs text-ink-mute">{r.note}</div> : null}
                </div>
                <Chip tone={STATUS_TONE[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Chip>
                {r.status === "pending" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setCancelTarget(r)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={composerOpen}
        onClose={handleCloseComposer}
        title="Request time off"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={handleCloseComposer} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending && !pendingRowId ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Start date">
              {(p) => (
                <Input {...p} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isPending} />
              )}
            </Field>
            <Field label="End date">
              {(p) => (
                <Input {...p} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isPending} />
              )}
            </Field>
          </div>
          <Field label="Type">
            {(p) => (
              <Select
                {...p}
                value={kind}
                onChange={(e) => setKind(e.target.value as PtoRequest["kind"])}
                options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
                disabled={isPending}
              />
            )}
          </Field>
          <Field label="Note (optional)">
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={isPending} />}
          </Field>
        </div>
      </Modal>

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && handleCancel(cancelTarget.id)}
        title="Cancel time off request"
        message={
          cancelTarget
            ? `Cancel your ${KIND_LABEL[cancelTarget.kind]} request for ${fmtDate(cancelTarget.startDate)} – ${fmtDate(cancelTarget.endDate)}?`
            : ""
        }
        confirmLabel="Cancel request"
        pending={isPending}
      />
      <ConfirmModal
        open={denyTarget !== null}
        onClose={() => setDenyTarget(null)}
        onConfirm={() => denyTarget && handleDecide(denyTarget.id, "denied")}
        title="Deny time off request"
        message={denyTarget ? `Deny ${denyTarget.employeeName}'s ${KIND_LABEL[denyTarget.kind]} request?` : ""}
        confirmLabel="Deny"
        pending={isPending}
      />
    </div>
  );
}
