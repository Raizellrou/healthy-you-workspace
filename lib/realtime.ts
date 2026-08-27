"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime, notifications only (P9). One shared channel per employee,
 * refcounted across every subscriber on the page — the badge lives in three
 * nav components (NavRail/NavPanel/MobileTabBar), and this module lets all
 * three ride one subscription instead of opening three sockets.
 *
 * supabase-js's realtime client reconnects the underlying socket on its
 * own; this module only reacts to the resulting SUBSCRIBED/CLOSED status
 * transitions, it doesn't implement its own backoff.
 *
 * The one rule everything here exists to enforce: a realtime INSERT is not
 * the same thing as "show the badge now". `deliver_after` is what makes
 * Right to Disconnect work (see notifications.ts#getUnreadCount) — a
 * quiet-hours-held row inserted right now must stay invisible until its
 * deliver_after passes, realtime or not. Every INSERT is checked against
 * that before anything fires.
 *
 * A second, easy-to-miss rule: postgres_changes authorization is decided at
 * channel JOIN time, not continuously. lib/supabase/client.ts's
 * createClient() returns a fresh client that hydrates its session from
 * cookies asynchronously — subscribing before that resolves joins the
 * channel as anon, RLS then matches nothing, and a later setAuth() call
 * does NOT retroactively fix an already-joined channel (confirmed against
 * this project's own Supabase project — the subscribe-before-auth ordering
 * silently returns zero events, forever, for that channel's lifetime).
 * So: always await getSession() and setAuth() the token before the first
 * .subscribe() call. Never subscribe first and authenticate after.
 */

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface NotificationChangeRow {
  recipient_id: string;
  deliver_after: string;
}

type DeliverableListener = () => void;
type StateListener = (state: ConnectionState) => void;

let channel: RealtimeChannel | null = null;
// The client instance that created `channel` — reused for teardown, since
// each createClient() call is a distinct SupabaseClient with its own
// RealtimeClient. Calling removeChannel() on a different instance than the
// one that opened the socket doesn't reliably close it.
let channelClient: SupabaseClient | null = null;
let channelEmployeeId: string | null = null;
let connectionState: ConnectionState = "disconnected";
let hasSubscribedOnce = false;
let holdTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped on every ensureChannel call so an in-flight async setup for a
// superseded employeeId (or a superseded teardown/recreate) can detect it
// no longer owns the module state and bail out instead of clobbering it.
let setupGeneration = 0;

// Placeholder holds (see lib/notify.ts's FOCUS_HOLD_PLACEHOLDER_MS) sit ~a
// year out — scheduling a real timer for that is pointless. Cap how far
// ahead a wakeup timer is allowed to run; anything further just waits for
// the next event or the next mount.
const MAX_HOLD_TIMER_MS = 60 * 60 * 1000;

const deliverableListeners = new Set<DeliverableListener>();
const stateListeners = new Set<StateListener>();

function setConnectionState(next: ConnectionState) {
  if (connectionState === next) return;
  connectionState = next;
  stateListeners.forEach((listener) => listener(next));
}

function notifyDeliverable() {
  deliverableListeners.forEach((listener) => listener());
}

function scheduleHoldWakeup(deliverAfter: string) {
  if (holdTimer) clearTimeout(holdTimer);
  const delay = new Date(deliverAfter).getTime() - Date.now();
  if (delay <= 0 || delay > MAX_HOLD_TIMER_MS) return;
  holdTimer = setTimeout(notifyDeliverable, delay);
}

function handleChange(payload: RealtimePostgresChangesPayload<NotificationChangeRow>) {
  const row = payload.new as NotificationChangeRow | undefined;
  if (!row?.deliver_after) return;
  if (new Date(row.deliver_after).getTime() <= Date.now()) {
    notifyDeliverable();
  } else {
    scheduleHoldWakeup(row.deliver_after);
  }
}

function teardownChannel() {
  setupGeneration++;
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (channel && channelClient) {
    channelClient.removeChannel(channel);
  }
  channel = null;
  channelClient = null;
  channelEmployeeId = null;
  hasSubscribedOnce = false;
  setConnectionState("disconnected");
}

async function ensureChannel(employeeId: string) {
  if (channel && channelEmployeeId === employeeId) return;
  if (channel) teardownChannel();

  channelEmployeeId = employeeId;
  setConnectionState("connecting");
  const generation = ++setupGeneration;
  const supabase = createClient();

  // Must resolve — and setAuth must complete — before .subscribe() is ever
  // called. See the module header: authorization is decided at join time.
  const { data } = await supabase.auth.getSession();
  if (generation !== setupGeneration) return; // superseded while awaiting
  const token = data.session?.access_token;
  if (token) await supabase.realtime.setAuth(token);
  if (generation !== setupGeneration) return; // superseded while awaiting

  channelClient = supabase;
  channel = supabase
    .channel(`notifications:${employeeId}`)
    .on<NotificationChangeRow>(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${employeeId}` },
      handleChange
    )
    .on<NotificationChangeRow>(
      // A second tab/device marking notifications read changes what this
      // tab's badge should show too.
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_id=eq.${employeeId}` },
      handleChange
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
        // A resubscribe after a drop may have missed events entirely — the
        // safe move is to reconcile with a real refetch (the caller's
        // onDeliverableChange), not to trust that nothing happened.
        if (hasSubscribedOnce) notifyDeliverable();
        hasSubscribedOnce = true;
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("disconnected");
      }
    });
}

/** Subscribe to this employee's deliverable notification changes. Returns
 *  an unsubscribe function. The underlying channel is torn down once the
 *  last subscriber leaves. */
export function subscribeToNotifications(employeeId: string, onDeliverableChange: DeliverableListener): () => void {
  void ensureChannel(employeeId);
  deliverableListeners.add(onDeliverableChange);
  return () => {
    deliverableListeners.delete(onDeliverableChange);
    if (deliverableListeners.size === 0) teardownChannel();
  };
}

/** Connection-state observer for the nav's connection dot. Registering
 *  before any subscribeToNotifications call is fine — it just reports
 *  "disconnected" until a channel exists. */
export function subscribeToConnectionState(listener: StateListener): () => void {
  stateListeners.add(listener);
  listener(connectionState);
  return () => stateListeners.delete(listener);
}
