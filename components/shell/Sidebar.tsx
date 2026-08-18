"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_GROUPS } from "@/components/shell/navItems";
import { PetalLogo } from "@/components/shell/PetalLogo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useNudges } from "@/lib/nudge-context";

export function Sidebar({
  hasCritical,
  currentEmployee,
}: {
  hasCritical: boolean;
  currentEmployee: { name: string; role: string; avatarColor: string } | null;
}) {
  const pathname = usePathname();
  const { unseenCount } = useNudges();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-20 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 md:h-screen md:w-[216px] md:flex-col md:items-stretch md:gap-0 md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r md:px-3 md:py-4"
    >
      <div className="hidden shrink-0 items-center gap-2 px-2 pb-5 md:flex">
        <PetalLogo size={26} />
        <span className="text-base font-bold tracking-wide text-ink">PETAL</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 md:flex-none">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="hidden flex-col gap-0.5 md:flex">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-ink-mute">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const showCriticalDot = item.href === "/burnout" && hasCritical;
              const showBadge = item.href === "/nudges" && unseenCount > 0;
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
                  {showBadge ? (
                    <span
                      className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] font-semibold text-white"
                      aria-label={`${unseenCount} unseen nudges`}
                    >
                      {unseenCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Compact single-row nav for mobile/narrow layouts */}
        {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
          const active = pathname === item.href;
          const showCriticalDot = item.href === "/burnout" && hasCritical;
          const showBadge = item.href === "/nudges" && unseenCount > 0;
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
              {showBadge ? (
                <span
                  className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] font-semibold text-white"
                  aria-label={`${unseenCount} unseen nudges`}
                >
                  {unseenCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto hidden flex-col gap-3 pt-4 md:flex">
        <ThemeToggle />
        {currentEmployee ? (
          <div className="flex items-center gap-2.5 border-t border-line px-1 pt-3">
            <Avatar name={currentEmployee.name} color={currentEmployee.avatarColor} size={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{currentEmployee.name}</div>
              <div className="truncate text-xs text-ink-mute">{currentEmployee.role}</div>
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
