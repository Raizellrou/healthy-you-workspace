/**
 * A small count bubble — unread notifications, held messages, overdue tasks.
 *
 * Distinct from `Chip`: `Chip` is a labelled pill for status text, this is a
 * numeric indicator that sits on top of an icon. Renders nothing at zero so
 * callers don't have to guard.
 */
export function Badge({
  count,
  max = 99,
  tone = "brand",
  className = "",
}: {
  count: number;
  max?: number;
  tone?: "brand" | "critical" | "neutral";
  className?: string;
}) {
  if (count <= 0) return null;

  const TONE_CLASSES = {
    brand: "bg-brand text-white",
    critical: "bg-risk-critical text-white",
    neutral: "bg-surface-2 text-ink-soft",
  } as const;

  return (
    <span
      className={`inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.6875rem] font-semibold leading-[1.125rem] tabular-nums ${TONE_CLASSES[tone]} ${className}`}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
