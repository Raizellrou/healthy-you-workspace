"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { UserMenu } from "@/components/shell/UserMenu";
import { NewProjectItem } from "@/components/tasks/NewProjectItem";
import { sectionFor, sectionsFor, INBOX_ITEMS, SETTINGS_ITEMS, type RailItemDef } from "@/components/shell/navSections";
import { useNudges } from "@/lib/nudge-context";
import { subscribeToConnectionState, type ConnectionState } from "@/lib/realtime";
import { canManageProjects } from "@/lib/authz";
import { OPEN_PALETTE_EVENT } from "@/components/ui/CommandPalette";
import type { AppRole } from "@/types/person";
import type { Project } from "@/types/task";

const COLLAPSE_KEY = "petal-nav-panel-collapsed";

/**
 * Tier 2 of the rail+panel shell: the active section's destinations, plus
 * the identity card pinned at the foot. Collapse is a per-device
 * convenience (a laptop vs a 27" monitor genuinely differ), so it lives
 * in localStorage, not the account-level ui_preferences table — see the
 * plan artifact for why that's not a migration-worthy setting.
 *
 * No session strip here — that's the full ClockWidget on the dashboard's
 * Zone A now (app/(app)/dashboard/page.tsx), not a second copy in every
 * page's nav chrome.
 *
 * No scope switcher yet (Team / Project / You-Team-Org) — that needs
 * filtering support in the underlying queries this phase doesn't touch.
 * Deferred, not silently dropped.
 */
export function NavPanel({
  appRole,
  hasCritical,
  currentEmployee,
  unreadInboxCount,
  projects,
  defaultTaskView,
}: {
  appRole?: AppRole;
  hasCritical: boolean;
  currentEmployee: { name: string; role: string; avatarColor: string } | null;
  unreadInboxCount: number;
  /** Projects render as panel destinations under Productivity — this is
   *  what retired the horizontally-scrolling TasksNav tab strip, which
   *  broke down past four or five projects. */
  projects: Project[];
  defaultTaskView: string;
}) {
  const pathname = usePathname();
  const { unseenCount } = useNudges();
  const role = appRole ?? "employee";
  const [collapsed, setCollapsed] = useState(false);
  const [connectionState, setConnectionStateLocal] = useState<ConnectionState>("disconnected");
  const [shortcutHint, setShortcutHint] = useState("Ctrl K");

  useEffect(() => subscribeToConnectionState(setConnectionStateLocal), []);

  useEffect(() => {
    // navigator is browser-only, and the server has no way to know which
    // key this viewer presses — so the hint starts as the more common of
    // the two and corrects on mount, the same deferred read the collapse
    // state below uses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutHint("⌘K");
  }, []);

  useEffect(() => {
    // One-time read of browser-only state on mount — same deferred-effect
    // pattern ThemeToggle/ClockWidget use, so SSR and first client render
    // agree before this can diverge.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  }

  const activeKey = sectionFor(pathname);
  const section = activeKey === "inbox" || activeKey === "settings" ? null : sectionsFor(role).find((s) => s.key === activeKey);
  const heading = activeKey === "inbox" ? "Inbox" : activeKey === "settings" ? "Settings" : (section?.label ?? "Home");
  const items: RailItemDef[] =
    activeKey === "inbox" ? INBOX_ITEMS : activeKey === "settings" ? SETTINGS_ITEMS : (section?.items ?? []);

  function badgeFor(href: string): number {
    if (href === "/nudges") return unseenCount;
    if (href === "/inbox") return unreadInboxCount;
    return 0;
  }

  if (collapsed) {
    return (
      <div className="hidden shrink-0 border-r border-line bg-surface md:flex md:w-6 md:items-start md:justify-center md:py-3">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Expand navigation panel"
          className="flex h-6 w-6 items-center justify-center rounded text-ink-mute hover:bg-surface-2 hover:text-ink"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <nav
      aria-label="Section"
      className="hidden shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-3 py-4 md:flex md:w-[12.5rem]"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <SectionLabel>{heading}</SectionLabel>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Collapse navigation panel"
          className="flex h-6 w-6 items-center justify-center rounded text-ink-mute hover:bg-surface-2 hover:text-ink"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M7 1L3 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Global search had no visible affordance on desktop at all: ⌘K worked,
          MobileTabBar had a search button, and the rail had nothing — so the
          larger viewport was the one where the feature was undiscoverable.
          Styled as a field rather than an icon so it reads as search, and
          carries the shortcut so it teaches the keyboard route too. The
          palette stays the single owner of open/closed; this only fires its
          event, exactly as the mobile button does. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="mb-3 flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-line px-2.5 text-left text-sm text-ink-mute transition-colors hover:border-line-strong hover:text-ink-soft"
      >
        <Icon name="search" size={15} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search</span>
        <kbd className="shrink-0 rounded border border-line px-1 font-mono text-xs font-medium text-ink-mute">
          {shortcutHint}
        </kbd>
      </button>

      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badgeCount = badgeFor(item.href);
          const showCriticalDot = item.href === "/burnout" && hasCritical;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
              {showCriticalDot ? (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-risk-critical" aria-label="Needs attention" />
              ) : null}
              {badgeCount > 0 ? (
                <span
                  className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-risk-critical px-1 text-xs font-semibold text-white"
                  aria-label={`${badgeCount} unread`}
                >
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {activeKey === "productivity" ? (
        <div className="mt-4 flex flex-col gap-0.5">
          <SectionLabel className="px-3 pb-1">Projects</SectionLabel>
          {projects.map((project) => {
            const href = `/tasks/project/${project.id}/${defaultTaskView}`;
            const active = pathname.startsWith(`/tasks/project/${project.id}`);
            return (
              <Link
                key={project.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: project.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{project.name}</span>
              </Link>
            );
          })}
          {canManageProjects(role) ? (
            <NewProjectItem projectCount={projects.length} defaultView={defaultTaskView} />
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        {connectionState !== "connected" ? (
          <div className="flex items-center gap-1.5 px-3 text-[11px] text-ink-mute">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                connectionState === "connecting" ? "bg-ink-mute" : "bg-risk-high"
              }`}
              aria-hidden="true"
            />
            {connectionState === "connecting" ? "Connecting…" : "Reconnecting…"}
          </div>
        ) : null}
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
