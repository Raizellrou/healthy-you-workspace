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
  | "eye-off"
  | "posture"
  | "check"
  | "lock"
  | "focus"
  | "x"
  | "list"
  | "inbox"
  | "settings"
  | "search"
  | "alert-circle"
  | "info";

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
