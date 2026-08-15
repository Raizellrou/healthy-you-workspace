"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { NAV_ITEMS } from "@/components/shell/navItems";
import { EMPLOYEES } from "@/lib/employees";
import { computeBurnout } from "@/lib/burnout";
import { useNudges } from "@/lib/nudge-context";

const HAS_CRITICAL = EMPLOYEES.some((e) => computeBurnout(e).band === "critical");

export function Sidebar() {
  const pathname = usePathname();
  const { unseenCount } = useNudges();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-20 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 md:h-screen md:w-[216px] md:flex-col md:items-stretch md:gap-1 md:overflow-y-auto md:overflow-x-visible md:border-b-0 md:border-r md:px-3 md:py-4"
    >
      <div className="hidden shrink-0 items-center gap-2 px-2 pb-4 md:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
          <Icon name="shield" size={16} />
        </span>
        <span className="text-base font-semibold text-ink">AxionHR</span>
      </div>

      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const showCriticalDot = item.href === "/burnout" && HAS_CRITICAL;
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
    </nav>
  );
}
