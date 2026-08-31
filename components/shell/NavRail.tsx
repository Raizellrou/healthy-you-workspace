"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { Logo } from "@/components/shell/Logo";
import { sectionFor, sectionsFor } from "@/components/shell/navSections";
import type { AppRole } from "@/types/person";

/**
 * Tier 1 of the rail+panel shell: an 84px icon-over-label rail, one button
 * per section, filled solid when active. Inbox and Settings sit below a
 * divider — they aren't sections, so NavPanel gives each its own small
 * panel (sectionFor's "inbox"/"settings" branches) instead of one shared
 * bucket, which used to show Schedule/Appearance/Your data on the Inbox
 * page too.
 */
export function NavRail({
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

  return (
    <nav
      aria-label="Primary"
      className="hidden shrink-0 flex-col items-stretch gap-1 overflow-y-auto border-r border-line bg-surface px-2 py-3 md:flex md:w-[84px]"
    >
      <Link href="/dashboard" className="mb-4 flex flex-col items-center gap-1" aria-label="Home">
        <Logo size={28} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink">PETAL</span>
      </Link>

      {sections.map((section) => {
        const active = section.key === activeKey;
        const showDot = section.key === "wellbeing" && hasCritical;
        return (
          <Link
            key={section.key}
            href={section.items[0].href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${
              active ? "bg-brand text-brand-fg" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon name={section.icon} size={18} />
            {section.label}
            {showDot ? (
              <span
                className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-risk-critical ring-2 ring-surface"
                aria-label="Needs attention"
              />
            ) : null}
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col items-stretch gap-1 border-t border-line pt-2">
        <Link
          href="/inbox"
          aria-current={pathname.startsWith("/inbox") ? "page" : undefined}
          className={`relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${
            pathname.startsWith("/inbox") ? "bg-surface-2 text-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon name="inbox" size={18} />
          Inbox
          {unreadInboxCount > 0 ? (
            <span
              className="absolute right-1.5 top-1 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-risk-critical px-1 text-[9px] font-bold text-white"
              aria-label={`${unreadInboxCount} unread`}
            >
              {unreadInboxCount > 9 ? "9+" : unreadInboxCount}
            </span>
          ) : null}
        </Link>
        <Link
          href="/settings/schedule"
          aria-current={
            pathname.startsWith("/settings") || pathname.startsWith("/transparency") ? "page" : undefined
          }
          className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${
            pathname.startsWith("/settings") || pathname.startsWith("/transparency")
              ? "bg-surface-2 text-ink"
              : "text-ink-soft hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon name="settings" size={18} />
          Account
        </Link>
      </div>
    </nav>
  );
}
