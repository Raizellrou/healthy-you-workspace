// Outline tulip mark: two crossing petal strokes wrap a central negative-space
// figure, matching the PETAL reference board (gradient purple, no fill, no stem) —
// distinct from a filled/solid icon since the negative space is the point.
export function PetalLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="petal-logo-grad-left" x1="24" y1="41" x2="14" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6F49A6" />
          <stop offset="1" stopColor="#9B7BC4" />
        </linearGradient>
        <linearGradient id="petal-logo-grad-right" x1="24" y1="41" x2="34" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C7A2E5" />
          <stop offset="1" stopColor="#FFB5C5" />
        </linearGradient>
      </defs>
      <path
        d="M24,41 C11,35 8,21 16,8 C20,17 23,29 24,41 Z"
        stroke="url(#petal-logo-grad-left)"
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M24,41 C37,35 40,21 32,8 C28,17 25,29 24,41 Z"
        stroke="url(#petal-logo-grad-right)"
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
