import type { ReactNode } from "react";
import type { AppRole } from "@/types/person";
import { getCurrentPerson } from "@/lib/supabase/people";

/**
 * Server-side conditional render by app_role — for gating a button, a
 * section, or a small piece of UI inline in a page that isn't otherwise
 * role-restricted (e.g. an "Edit team" action on a screen everyone can
 * view). For gating an entire route, check the role directly in the page
 * and call `notFound()`/`redirect()` — that avoids a wasted render and
 * gives a real 404 instead of an empty page.
 *
 * This is UI convenience, not the security boundary — RLS enforces the
 * actual read/write restriction regardless of whether this component is
 * used correctly everywhere.
 */
export async function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const person = await getCurrentPerson();
  if (!person || !allow.includes(person.appRole)) return <>{fallback}</>;
  return <>{children}</>;
}
