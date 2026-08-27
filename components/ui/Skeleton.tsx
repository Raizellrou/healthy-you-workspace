/**
 * Loading placeholder. Used by the route-level `loading.tsx` files — until
 * those existed every navigation showed a blank screen while the server
 * component finished fetching.
 *
 * The pulse is a plain opacity animation so the reduced-motion rule in
 * `globals.css` neutralises it without any extra handling here.
 */
// Written out rather than interpolated — Tailwind extracts class names
// statically, so `rounded-${rounded}` would never make it into the stylesheet.
const ROUNDED_CLASSES = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

export function Skeleton({
  className = "",
  rounded = "md",
}: {
  className?: string;
  rounded?: keyof typeof ROUNDED_CLASSES;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-surface-2 ${ROUNDED_CLASSES[rounded]} ${className}`}
    />
  );
}

/** A block of stacked text lines, for card and list placeholders. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}
