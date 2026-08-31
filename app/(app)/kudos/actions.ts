"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { findCoffeeSlot } from "@/lib/supabase/meetings";
import { enqueue } from "@/lib/notify";
import { fmtDate } from "@/lib/date";
import { fmtClock } from "@/lib/time";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

export interface SubmitKudosResult {
  ok: boolean;
  error?: string;
}

export async function submitKudos(
  toEmployeeId: string,
  tag: string,
  note: string,
  flagged: boolean
): Promise<SubmitKudosResult> {
  const fromEmployeeId = await getCurrentEmployeeId();
  if (!fromEmployeeId) {
    return { ok: false, error: "Not signed in." };
  }
  if (fromEmployeeId === toEmployeeId) {
    return { ok: false, error: "Pick someone else to thank." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kudos").insert({
    from_employee_id: fromEmployeeId,
    to_employee_id: toEmployeeId,
    kudos_type: tag,
    message: note.trim() || null,
    flagged,
  });

  if (error) {
    return { ok: false, error: describeDbError(error) };
  }

  revalidatePath("/kudos");
  return { ok: true };
}

/** HR-only — enforced by rotate_buddies()'s own is_hr() check, not just
 *  this action. A non-HR caller gets the RPC's raised exception back as a
 *  Postgres error, described the same way every other DB error is. */
export async function rotateBuddies(): Promise<ActionResult> {
  return withEmployee(async () => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("rotate_buddies");
    if (error) {
      return fail(describeDbError(error));
    }
    revalidatePath("/kudos");
    return ok();
  });
}

const RaiseConcernSchema = z.object({
  aboutEmployeeId: z.uuid(),
  category: z.enum(["workload", "conduct", "wellbeing", "other"]),
  note: z.string().trim().min(1).max(2000),
  anonymous: z.boolean(),
});

export async function raiseConcern(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(RaiseConcernSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase.from("concern_flags").insert({
        about_employee_id: data.aboutEmployeeId,
        raised_by_id: data.anonymous ? null : employeeId,
        category: data.category,
        note: data.note,
      });
      if (error) {
        return fail(describeDbError(error));
      }
      return ok();
    })
  );
}

const DecideConcernSchema = z.object({
  id: z.uuid(),
  status: z.enum(["acknowledged", "resolved"]),
});

/** HR-only, enforced by RLS (concern_flags UPDATE is is_hr()-scoped) — a
 *  non-HR caller's update simply matches zero rows, not an error, since
 *  RLS filters rather than throws on UPDATE. */
export async function decideConcern(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(DecideConcernSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase
        .from("concern_flags")
        .update({ status: data.status, acknowledged_by: employeeId, acknowledged_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) {
        return fail(describeDbError(error));
      }
      revalidatePath("/kudos");
      return ok();
    })
  );
}

/**
 * Proposes a virtual coffee at the first slot both people are actually
 * free, using the calendar 0022 introduced.
 *
 * `coffee_chats` has existed since 0016 with no reader — that migration
 * skipped scheduling explicitly, noting there was no calendar to find a
 * mutual gap in. lib/meetings.ts#findMutualGap is that missing piece:
 * merging both calendars and taking the gaps yields shared availability
 * directly, inside the overlap of both people's working hours so a coffee
 * never lands outside somebody's day.
 */
export async function proposeCoffee(inviteeId: string): Promise<ActionResult> {
  return withEmployee(async () => {
    const me = await getCurrentPerson();
    if (!me) return fail("Not signed in.");
    if (inviteeId === me.id) return fail("You can't schedule a coffee with yourself.");

    const slot = await findCoffeeSlot(me, inviteeId);
    if (!slot) {
      return fail("No 30-minute window you're both free in over the next week.");
    }

    const supabase = await createClient();
    const { error } = await supabase.from("coffee_chats").insert({
      proposer_id: me.id,
      invitee_id: inviteeId,
      scheduled_at: slot.startsAt,
      status: "proposed",
    });
    if (error) {
      return fail(describeDbError(error));
    }

    await enqueue({
      recipientId: inviteeId,
      actorId: me.id,
      kind: "coffee_proposed",
      title: `${me.name} suggested a coffee on ${fmtDate(slot.date)} at ${fmtClock(slot.startMin)}`,
      body: "Picked because it's the first 30 minutes you're both free.",
      link: "/kudos",
      entityType: "coffee_chat",
    });

    revalidatePath("/kudos");
    return ok({ scheduledAt: slot.startsAt, date: slot.date, startMin: slot.startMin });
  });
}
