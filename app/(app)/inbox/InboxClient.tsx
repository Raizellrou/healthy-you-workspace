"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { markNotificationRead, markAllNotificationsRead } from "./actions";
import type { InboxNotification, NotificationStatus } from "@/lib/supabase/notifications";

type TabKey = NotificationStatus | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "unread", label: "Unread" },
  { key: "held", label: "Held for later" },
  { key: "all", label: "All" },
];

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** No realtime subscription here by design — the badge and this list
 *  refresh the same way every other Sidebar badge in this app already
 *  does, on navigation (see 0014's migration header for the tradeoff). */
export function InboxClient({ notifications }: { notifications: InboxNotification[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("unread");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = { unread: 0, held: 0, read: 0 };
    for (const n of notifications) c[n.status]++;
    return c;
  }, [notifications]);

  const visible = tab === "all" ? notifications : notifications.filter((n) => n.status === tab);

  function handleOpen(n: InboxNotification) {
    if (n.status === "read") return;
    startTransition(async () => {
      await markNotificationRead(n.id);
      router.refresh();
    });
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {TABS.map((t) => {
            const count = t.key === "all" ? notifications.length : counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.key ? "bg-ink text-white" : "border border-line text-ink-mute hover:bg-surface-2"
                }`}
              >
                {t.label}
                <span className="ml-1.5 font-mono text-[10px] opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        {counts.unread > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={handleMarkAll} disabled={isPending}>
            Mark all read
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="check"
          message={
            tab === "held" ? "Nothing held right now." : tab === "unread" ? "You're caught up." : "Nothing here yet."
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "/inbox"}
                onClick={() => handleOpen(n)}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-surface-2 ${
                  n.status === "unread" ? "border-brand/30 bg-brand-soft/30" : "border-line bg-surface"
                }`}
              >
                {n.actorName ? (
                  <Avatar name={n.actorName} color={n.actorAvatarColor ?? "#64748b"} size={28} />
                ) : (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-ink-mute"
                    aria-hidden="true"
                  >
                    •
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${n.status === "unread" ? "font-medium text-ink" : "text-ink-soft"}`}>
                    {n.title}
                  </div>
                  {n.body ? <div className="mt-0.5 truncate text-xs text-ink-mute">{n.body}</div> : null}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-mute">
                    <span>{fmtWhen(n.createdAt)}</span>
                    {n.status === "held" ? (
                      <Chip tone="warning">
                        {n.heldReason === "quiet_hours" ? `Held until ${fmtWhen(n.deliverAfter)}` : "Batched"}
                      </Chip>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
