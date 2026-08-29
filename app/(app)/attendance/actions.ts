"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/supabase/people";
import { isHr } from "@/lib/authz";
import { todayInTz, fmtDate } from "@/lib/date";
import { ptoBlockMessage } from "@/lib/guardrails";
import { enqueue } from "@/lib/notify";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

function revalidateAttendance() {
  revalidatePath("/attendance");
  revalidatePath("/time-off");
  revalidatePath("/dashboard");
  revalidatePath("/burnout");
}

const DUPLICATE_SESSION_ERROR: Record<string, string> = {
  "23505": "Already clocked in.",
};
const DUPLICATE_BREAK_ERROR: Record<string, string> = {
  "23505": "Already on a break.",
};

/** `work_date` uses the employee's own timezone (P2), not the server's —
 *  a 00:30 clock-out belongs to the previous calendar day for the person
 *  who worked it, regardless of where the app server runs.
 *
 *  P8 guardrail: refuses outright while the person is on approved leave.
 *  This is the only hard block in the guardrail set — clocking in on
 *  approved PTO means either the leave record or the clock-in is wrong,
 *  and both are worth stopping to check. Everything else in
 *  lib/guardrails.ts is advisory by design. */
export async function clockIn(): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const person = await getCurrentPerson();
    const supabase = await createClient();
    const today = todayInTz(person?.timezone);

    const { data: leave } = await supabase
      .from("pto_requests")
      .select("end_date")
      .eq("employee_id", employeeId)
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .maybeSingle();
    if (leave) {
      return fail(ptoBlockMessage(fmtDate(leave.end_date as string)));
    }

    const { error } = await supabase.from("work_sessions").insert({
      employee_id: employeeId,
      work_date: today,
    });
    if (error) {
      return fail(describeDbError(error, DUPLICATE_SESSION_ERROR));
    }
    revalidateAttendance();
    return ok();
  });
}

export interface ClockOutSummary {
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
}

export async function clockOut(): Promise<ActionResult & { summary?: ClockOutSummary }> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();

    // Close any still-open break first — clocking out while "on break" would
    // otherwise leave an unclosed break row forever (nothing else ever
    // closes it), silently corrupting that day's break_hours math.
    const { data: openSession } = await supabase
      .from("work_sessions")
      .select("id, clock_in")
      .eq("employee_id", employeeId)
      .is("clock_out", null)
      .maybeSingle();
    if (!openSession) return fail("You're not clocked in.");

    await supabase
      .from("session_breaks")
      .update({ break_end: new Date().toISOString() })
      .eq("session_id", openSession.id)
      .is("break_end", null);

    const clockOutAt = new Date();
    const { error } = await supabase
      .from("work_sessions")
      .update({ clock_out: clockOutAt.toISOString() })
      .eq("id", openSession.id);
    if (error) {
      return fail(describeDbError(error));
    }

    // Read back every break in the session (now that all of them are
    // closed above) to total up break time for the post-clock-out summary.
    const { data: breaks } = await supabase
      .from("session_breaks")
      .select("break_start, break_end")
      .eq("session_id", openSession.id);
    const breakMinutes = (breaks ?? []).reduce((sum, b) => {
      if (!b.break_end) return sum;
      return sum + (new Date(b.break_end as string).getTime() - new Date(b.break_start as string).getTime()) / 60_000;
    }, 0);

    revalidateAttendance();
    return ok({
      summary: {
        clockIn: openSession.clock_in as string,
        clockOut: clockOutAt.toISOString(),
        breakMinutes: Math.round(breakMinutes),
      },
    });
  });
}

type BreakKind = "lunch" | "short" | "nudge";

export async function startBreak(kind: BreakKind = "short"): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();
    const { data: openSession } = await supabase
      .from("work_sessions")
      .select("id")
      .eq("employee_id", employeeId)
      .is("clock_out", null)
      .maybeSingle();
    if (!openSession) return fail("Clock in before starting a break.");

    const { error } = await supabase.from("session_breaks").insert({ session_id: openSession.id, kind });
    if (error) {
      return fail(describeDbError(error, DUPLICATE_BREAK_ERROR));
    }
    revalidateAttendance();
    return ok();
  });
}

export async function endBreak(): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();
    const { data: openSession } = await supabase
      .from("work_sessions")
      .select("id")
      .eq("employee_id", employeeId)
      .is("clock_out", null)
      .maybeSingle();
    if (!openSession) return fail("You're not clocked in.");

    const { data: openBreak } = await supabase
      .from("session_breaks")
      .select("id")
      .eq("session_id", openSession.id)
      .is("break_end", null)
      .maybeSingle();
    if (!openBreak) return fail("You're not on a break.");

    const { error } = await supabase
      .from("session_breaks")
      .update({ break_end: new Date().toISOString() })
      .eq("id", openBreak.id);
    if (error) {
      return fail(describeDbError(error));
    }
    revalidateAttendance();
    return ok();
  });
}

const EditSessionSchema = z.object({
  sessionId: z.uuid(),
  clockIn: z.iso.datetime({ offset: true }).optional(),
  clockOut: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

/** Corrects a forgotten clock-in/out. RLS lets self, the person's manager,
 *  or HR reach this row (0012); `edited_by`/`edit_reason` record who changed
 *  it and why regardless of which of those three it was. */
export async function editSession(input: unknown): Promise<ActionResult> {
  return withEmployee((editorId) =>
    validated(EditSessionSchema, input, async (data) => {
      const supabase = await createClient();
      const updates: Record<string, unknown> = {
        source: "edited",
        edited_by: editorId,
        edit_reason: data.reason,
      };
      if (data.clockIn !== undefined) updates.clock_in = data.clockIn;
      if (data.clockOut !== undefined) updates.clock_out = data.clockOut;

      const { error } = await supabase.from("work_sessions").update(updates).eq("id", data.sessionId);
      if (error) {
        return fail(describeDbError(error));
      }
      revalidateAttendance();
      return ok();
    })
  );
}

const RequestPtoSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  kind: z.enum(["vacation", "sick", "personal", "mental_health"]),
  note: z.string().trim().max(500).optional(),
});

export async function requestPto(input: unknown): Promise<ActionResult & { id?: string }> {
  return withEmployee((employeeId) =>
    validated(RequestPtoSchema, input, async (data) => {
      if (data.endDate < data.startDate) {
        return fail("End date can't be before the start date.");
      }
      const supabase = await createClient();
      const { data: request, error } = await supabase
        .from("pto_requests")
        .insert({
          employee_id: employeeId,
          start_date: data.startDate,
          end_date: data.endDate,
          kind: data.kind,
          note: data.note || null,
        })
        .select("id")
        .single();
      if (error) {
        return fail(describeDbError(error));
      }
      revalidateAttendance();
      return ok({ id: request.id as string });
    })
  );
}

export async function cancelPto(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pto_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) {
    return fail(describeDbError(error));
  }
  revalidateAttendance();
  return ok();
}

const DecidePtoSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["approved", "denied"]),
});

/** Manager/HR decision on someone else's request. RLS (0012) scopes WHO can
 *  reach the row (self, manager, or HR) but deliberately also allows the
 *  request's own owner through, since the same policy backs self-cancel —
 *  so this action, not the policy, is what stops a plain employee from
 *  approving their own PTO: the caller must be HR, or must manage the
 *  request's employee, and may never decide on their own request. */
export async function decidePto(input: unknown): Promise<ActionResult> {
  return withEmployee((approverId) =>
    validated(DecidePtoSchema, input, async (data) => {
      const supabase = await createClient();

      const { data: request } = await supabase
        .from("pto_requests")
        .select("employee_id")
        .eq("id", data.requestId)
        .maybeSingle();
      if (!request) {
        return fail("That request no longer exists.");
      }
      if (request.employee_id === approverId) {
        return fail("You can't decide on your own request.");
      }
      const person = await getCurrentPerson();
      const { data: canManage } = await supabase.rpc("manages", { target: request.employee_id });
      if (!person || !(isHr(person.appRole) || canManage)) {
        return fail("Only your manager or HR can decide on this request.");
      }

      const { data: updated, error } = await supabase
        .from("pto_requests")
        .update({ status: data.status, approver_id: approverId, decided_at: new Date().toISOString() })
        .eq("id", data.requestId)
        .eq("status", "pending")
        .select("employee_id, kind, start_date, end_date")
        .maybeSingle();
      if (error) {
        return fail(describeDbError(error));
      }
      if (updated) {
        await enqueue({
          recipientId: updated.employee_id,
          actorId: approverId,
          kind: "pto_decided",
          title: `Your ${updated.kind} request (${updated.start_date} to ${updated.end_date}) was ${data.status}`,
          link: "/time-off",
          entityType: "pto_request",
          entityId: data.requestId,
        });
      }
      revalidateAttendance();
      return ok();
    })
  );
}
