"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { createClient } from "@/lib/supabase/client";
import { scopeLabel } from "@/lib/authz";
import type { AppRole } from "@/types/person";

/**
 * The identity block at the bottom of the sidebar, now also the sign-out
 * entry point — there wasn't one anywhere in the app before this.
 *
 * "Switch account" isn't a separate action from "sign out": `proxy.ts`
 * (frozen) redirects any authenticated visit to /login straight to
 * /dashboard, so /login is only reachable once signed out — and /login's
 * quick-pick dropdown already *is* the account switcher. One control,
 * not two doing the same thing under different labels.
 */
export function UserMenu({
  name,
  role,
  avatarColor,
  appRole,
}: {
  name: string;
  role: string;
  avatarColor: string;
  appRole?: AppRole;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // The proxy redirects any signed-out visit to /login on its own, but
    // pushing directly avoids waiting on an extra round trip through a
    // stale-cached page first — same belt-and-suspenders pattern the
    // sign-in flow already uses (LoginClient: push, then refresh).
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 border-t border-line px-1 pt-3">
      <Avatar name={name} color={avatarColor} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{name}</div>
        <div className="truncate text-xs text-ink-mute">{role}</div>
        {appRole && appRole !== "employee" && (
          <div className="truncate text-[10px] font-medium text-brand">
            {scopeLabel(appRole)}
          </div>
        )}
      </div>
      <Menu
        ariaLabel={`Account menu for ${name}`}
        align="right"
        placement="top"
        trigger={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        items={[
          {
            key: "sign-out",
            label: signingOut ? "Signing out…" : "Sign out",
            danger: true,
            disabled: signingOut,
            onSelect: handleSignOut,
          },
        ]}
      />
    </div>
  );
}
