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
import { requestPto, cancelPto, decidePto } from "@/app/(app)/attendance/actions";
import { fmtDate } from "@/lib/date";
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState<PtoRequest["kind"]>("vacation");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  function handleSubmit() {
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestPto({ startDate, endDate, kind, note: note.trim() || undefined });
      if (!result.ok) {
        setError(result.error ?? "Failed to submit request.");
        return;
      }
      setStartDate("");
      setEndDate("");
      setNote("");
      router.refresh();
    });
  }

  function handleCancel(id: string) {
    setPendingRowId(id);
    startTransition(async () => {
      await cancelPto(id);
      setPendingRowId(null);
      router.refresh();
    });
  }

  function handleDecide(id: string, status: "approved" | "denied") {
    setPendingRowId(id);
    startTransition(async () => {
      await decidePto({ requestId: id, status });
      setPendingRowId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 text-sm font-semibold text-ink">Request time off</div>
        {error && (
          <div className="mb-3 rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Start date">
            {(p) => <Input {...p} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isPending} />}
          </Field>
          <Field label="End date">
            {(p) => <Input {...p} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isPending} />}
          </Field>
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
          <div className="flex items-end">
            <Button type="button" onClick={handleSubmit} disabled={isPending} className="w-full">
              {isPending && !pendingRowId ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </div>
        <Field label="Note (optional)" className="mt-3">
          {(p) => (
            <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={isPending} />
          )}
        </Field>
      </Card>

      {pendingForOthers.length > 0 && (
        <Card>
          <div className="mb-3 text-sm font-semibold text-ink">Pending approvals</div>
          <ul className="space-y-2">
            {pendingForOthers.map((r) => (
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
                  onClick={() => handleDecide(r.id, "denied")}
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
        {mine.length === 0 ? (
          <p className="text-xs text-ink-mute">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((r) => (
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
                    onClick={() => handleCancel(r.id)}
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
    </div>
  );
}
