/**
 * The Server Action return contract, in one place.
 *
 * Per AGENTS.md, actions return `{ ok, error }` and never throw to the client.
 * Every action file was re-declaring `ActionResult` and repeating the same
 * four lines of identity resolution; this centralises both.
 *
 * Note: no `"use server"` here. This module exports plain (non-async) helpers,
 * which a `"use server"` file is not allowed to do. Action files keep their own
 * directive and import from here.
 */

import type { ZodType } from "zod";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** An `ActionResult` that carries a payload when it succeeds. */
export type ActionResultWith<T> = ActionResult & Partial<T>;

export function ok(): ActionResult;
export function ok<T extends object>(data: T): ActionResult & T;
export function ok<T extends object>(data?: T) {
  return data ? { ok: true as const, ...data } : { ok: true as const };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Runs `fn` with the signed-in employee's id, or short-circuits.
 *
 * Identity always comes from `getCurrentEmployeeId()` — never from client
 * input. That rule is in AGENTS.md; this wrapper is how it stays cheap to obey.
 */
export async function withEmployee<T extends ActionResult>(
  fn: (employeeId: string) => Promise<T>
): Promise<T | ActionResult> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return fail("Not signed in.");
  return fn(employeeId);
}

/**
 * Validates `input` and hands the parsed value to `fn`.
 *
 * Server Actions are a public HTTP surface: their TypeScript parameter types
 * are erased at runtime and guarantee nothing about what actually arrives.
 * Combine with `withEmployee` for authenticated writes:
 *
 *     withEmployee((me) => validated(Schema, raw, (input) => ...))
 */
export async function validated<I, T extends ActionResult>(
  schema: ZodType<I>,
  input: unknown,
  fn: (value: I) => Promise<T>
): Promise<T | ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".");
    return fail(path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input."));
  }
  return fn(parsed.data);
}

/**
 * Turns a Postgres error into something a person can read.
 *
 * The codes covered are the ones this schema actually raises: the
 * `mood_checkins` unique constraint, the partial unique indexes added for
 * work sessions and breaks, and the CHECK constraints on task fields.
 *
 * The `default` branch deliberately does not return `error.message` — a raw
 * Postgres message can carry constraint names, column names, and schema
 * shape, and with toasts (Phase 5 of the modal/toast work) that string is
 * now surfaced on the most screenshot-and-shared UI surface in the app.
 * The detail goes to the server log instead, where an actual investigation
 * can use it; the client gets a message with nothing to leak.
 */
export function describeDbError(
  error: { code?: string; message: string },
  overrides: Record<string, string> = {}
): string {
  if (error.code && overrides[error.code]) return overrides[error.code];
  switch (error.code) {
    case "23505":
      return "That already exists.";
    case "23514":
      return "That value isn't allowed.";
    case "23503":
      return "A related record is missing.";
    case "42501":
      return "You don't have access to do that.";
    default:
      console.error("Unhandled db error:", error.code, error.message);
      return "Something went wrong. Please try again.";
  }
}
