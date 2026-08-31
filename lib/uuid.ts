const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres throws `invalid input syntax for type uuid` for any non-UUID
 * string passed to a `uuid` column filter, which several queries.ts
 * lookups (getProject, getTaskDetail) surface as an uncaught Error rather
 * than the null a not-found route param should produce. Route params are
 * arbitrary user-controlled strings, so id-taking pages must check this
 * before calling into those lookups.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
