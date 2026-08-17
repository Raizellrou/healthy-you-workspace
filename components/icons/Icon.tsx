export type IconName =
  | "grid"
  | "users"
  | "calendar"
  | "activity"
  | "bell"
  | "smile"
  | "shield"
  | "coffee"
  | "timer"
  | "stretch"
  | "droplet"
  | "eye"
  | "posture"
  | "check"
  | "lock"
  | "focus"
  | "x"
  | "list";

export function Icon({
  name,
  className,
  size = 20,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} className={className} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
