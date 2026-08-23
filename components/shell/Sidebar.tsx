"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { navGroupsFor } from "@/components/shell/navItems";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { UserMenu } from "@/components/shell/UserMenu";
import { ClockWidget } from "@/components/shell/ClockWidget";
import { useNudges } from "@/lib/nudge-context";
import type { AppRole } from "@/types/person";
import type { OpenSession } from "@/lib/supabase/attendance";

export function Sidebar({
  hasCritical,
  currentEmployee,
  appRole,
  openSession,
  unreadInboxCount = 0,
}: {
  hasCritical: boolean;
  currentEmployee: { name: string; role: string; avatarColor: string } | null;
  /** Defaults to "employee" so callers mid-migration (or a session with no
   *  matching row) get the least-privileged nav rather than an error. */
  appRole?: AppRole;
  openSession?: OpenSession | null;
  unreadInboxCount?: number;
}) {
  const pathname = usePathname();
  const { unseenCount } = useNudges();
  const role = appRole ?? "employee";
  const navGroups = navGroupsFor(role);

  // Two badge sources: the nudge simulation's own client-side count
  // (lib/nudge-context.tsx, unchanged) and the P6 inbox's unread count,
  // fetched server-side in app/(app)/layout.tsx. Same visual treatment
  // either way — no realtime here, it updates like every other Sidebar
  // badge does: on navigation.
  function badgeFor(href: string): number {
    if (href === "/nudges") return unseenCount;
    if (href === "/inbox") return unreadInboxCount;
    return 0;
  }

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-20 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 md:h-screen md:w-[216px] md:flex-col md:items-stretch md:gap-0 md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r md:px-3 md:py-4"
    >
      <div className="hidden shrink-0 items-center gap-2 px-2 pb-5 md:flex">
        <Logo size={26} />
        <span className="text-base font-bold tracking-wide text-ink">PETAL</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 md:flex-none">
        {navGroups.map((group) => (
          <div key={group.label} className="hidden flex-col gap-0.5 md:flex">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-ink-mute">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const showCriticalDot = item.href === "/burnout" && hasCritical;
              const badgeCount = badgeFor(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:whitespace-normal ${
                    active
                      ? "bg-brand-soft text-brand-ink"
                      : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                  {group.label === "Six Pillars" ? (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full"
                      style={{ background: showCriticalDot ? "var(--risk-critical)" : "#87D380" }}
                      aria-label={showCriticalDot ? "Needs attention" : "Healthy"}
                    />
                  ) : null}
                  {badgeCount > 0 ? (
                    <span
                      className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] font-semibold text-white"
                      aria-label={`${badgeCount} unread`}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Compact single-row nav for mobile/narrow layouts */}
        {navGroups.flatMap((g) => g.items).map((item) => {
          const active = pathname === item.href;
          const showCriticalDot = item.href === "/burnout" && hasCritical;
          const badgeCount = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:hidden ${
                active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className="relative">
                <Icon name={item.icon} size={18} />
                {showCriticalDot ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-risk-critical"
                    aria-label="Critical burnout risk present"
                  />
                ) : null}
              </span>
              {item.label}
              {badgeCount > 0 ? (
                <span
                  className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] font-semibold text-white"
                  aria-label={`${badgeCount} unread`}
                >
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto hidden flex-col gap-3 pt-4 md:flex">
        {currentEmployee ? <ClockWidget openSession={openSession ?? null} /> : null}
        <ThemeToggle />
        {currentEmployee ? (
          <UserMenu
            name={currentEmployee.name}
            role={currentEmployee.role}
            avatarColor={currentEmployee.avatarColor}
            appRole={appRole}
          />
        ) : null}
      </div>
    </nav>
  );
}
