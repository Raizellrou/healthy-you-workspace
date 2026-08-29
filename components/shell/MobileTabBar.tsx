"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { Logo } from "@/components/shell/Logo";
import { sectionFor, sectionsFor } from "@/components/shell/navSections";
import { OPEN_PALETTE_EVENT } from "@/components/ui/CommandPalette";
import { subscribeToConnectionState, type ConnectionState } from "@/lib/realtime";
import type { AppRole } from "@/types/person";

/**
 * Mobile equivalent of NavRail+NavPanel: a slim top strip for the utility
 * items (inbox/settings — there's no rail to hang them below a divider on
 * a phone width) and a bottom tab bar for the five sections, capped at
 * five per the bottom-nav-limit guideline. Both fixed, so main gets
 * matching top/bottom padding in app/(app)/layout.tsx to avoid content
 * sliding underneath.
 */
export function MobileTabBar({
  appRole,
  hasCritical,
  unreadInboxCount,
}: {
  appRole?: AppRole;
  hasCritical: boolean;
  unreadInboxCount: number;
}) {
  const pathname = usePathname();
  const role = appRole ?? "employee";
  const activeKey = sectionFor(pathname);
  const sections = sectionsFor(role);
  const onSettings = activeKey === "settings";
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  useEffect(() => subscribeToConnectionState(setConnectionState), []);

  return (
    <>
      {connectionState !== "connected" ? (
        <div className="sticky top-0 z-20 flex items-center justify-center gap-1.5 bg-surface-2 px-3 py-1 text-[11px] text-ink-mute md:hidden">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              connectionState === "connecting" ? "bg-ink-mute" : "bg-risk-high"
            }`}
            aria-hidden="true"
          />
          {connectionState === "connecting" ? "Connecting…" : "Reconnecting…"}
        </div>
      ) : null}
      <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
        <Link href="/dashboard" aria-label="Home" className="flex items-center">
          <Logo size={22} />
        </Link>
        <span className="text-sm font-bold tracking-wide text-ink">PETAL</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft"
          >
            <Icon name="search" size={18} />
          </button>
          <Link
            href="/inbox"
            aria-label={unreadInboxCount > 0 ? `Inbox, ${unreadInboxCount} unread` : "Inbox"}
            className={`relative flex h-11 w-11 items-center justify-center rounded-lg ${
              pathname.startsWith("/inbox") ? "bg-surface-2 text-ink" : "text-ink-soft"
            }`}
          >
            <Icon name="inbox" size={18} />
            {unreadInboxCount > 0 ? (
              <span
                className="absolute right-1 top-1 h-2 w-2 rounded-full bg-risk-critical ring-2 ring-surface"
                aria-hidden="true"
              />
            ) : null}
          </Link>
          <Link
            href="/settings/schedule"
            aria-label="Account"
            className={`flex h-11 w-11 items-center justify-center rounded-lg ${
              onSettings ? "bg-surface-2 text-ink" : "text-ink-soft"
            }`}
          >
            <Icon name="settings" size={18} />
          </Link>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 grid shrink-0 border-t border-line bg-surface md:hidden"
        style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {sections.map((section) => {
          const active = section.key === activeKey;
          const showDot = section.key === "wellbeing" && hasCritical;
          return (
            <Link
              key={section.key}
              href={section.items[0].href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                active ? "text-brand-ink" : "text-ink-soft"
              }`}
            >
              <Icon name={section.icon} size={20} />
              {section.label}
              {showDot ? (
                <span
                  className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-risk-critical ring-2 ring-surface"
                  aria-label="Needs attention"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
