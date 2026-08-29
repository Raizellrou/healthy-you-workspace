/**
 * Resolves the `returnUrl` proxy.ts attaches when it bounces an
 * unauthenticated visitor to /login, so sign-in lands back where they were
 * headed instead of always /dashboard (M1).
 *
 * Validated rather than trusted outright: a query param is attacker-
 * controlled input, and `router.push` on an unvalidated value is an open
 * redirect. Only a same-origin, absolute path is accepted — no protocol,
 * no host, no scheme-relative "//evil.com" (a leading "/" followed by a
 * second "/" is exactly that), and never back to /login itself.
 */
export function getSafeReturnUrl(search: string): string {
  const raw = new URLSearchParams(search).get("returnUrl");
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login/") || raw.startsWith("/login?")) return "/dashboard";
  return raw;
}
