"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeToNotifications } from "@/lib/realtime";

/**
 * Renders nothing. Its only job is holding the realtime subscription for
 * this employee's notifications and calling router.refresh() when a
 * deliverable change happens, so the server-computed unreadInboxCount that
 * NavRail/NavPanel/MobileTabBar already render gets refetched without a
 * navigation. Mounted once in app/(app)/layout.tsx — the three nav
 * components keep their existing badge markup untouched.
 */
export function LiveInboxBadge({ employeeId }: { employeeId: string }) {
  const router = useRouter();

  useEffect(() => {
    return subscribeToNotifications(employeeId, () => router.refresh());
  }, [employeeId, router]);

  return null;
}
