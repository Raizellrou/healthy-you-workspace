"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Renders nothing. Keeps the Dashboard's SessionBar in sync when a
 * clock-in/out or break happens in another tab or device — without this,
 * the session card only updated on the next full navigation (M11).
 *
 * Deliberately its own small channel rather than folded into
 * lib/realtime.ts's shared notifications channel — that module is
 * purpose-built for one table (notifications) with deliver_after-aware
 * logic; work_sessions/session_breaks don't share that shape, and forcing
 * them onto the same channel would blur what that module is for.
 *
 * Same ordering rule as lib/realtime.ts: postgres_changes authorization is
 * decided at channel join time, so the session must be read and the
 * realtime client authenticated before .subscribe() is ever called, or the
 * channel joins as anon and RLS matches nothing for its whole lifetime.
 */
export function LiveSessionRefresh({ employeeId }: { employeeId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function setup() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      const channel = supabase
        .channel(`dashboard-session:${employeeId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "work_sessions", filter: `employee_id=eq.${employeeId}` },
          () => router.refresh()
        )
        .on(
          // session_breaks has no employee_id of its own (only session_id,
          // referencing work_sessions) — no postgres_changes filter can
          // target "my breaks" directly. RLS (0012) already scopes which
          // rows this subscriber receives to can_see_employee(), the same
          // self/team/org boundary the rest of this screen respects, so an
          // unfiltered subscription is still correctly scoped, just not as
          // narrow as the work_sessions one above.
          "postgres_changes",
          { event: "*", schema: "public", table: "session_breaks" },
          () => router.refresh()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = setup();
    return () => {
      cancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [employeeId, router]);

  return null;
}
