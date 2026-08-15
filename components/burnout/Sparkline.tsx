import { sparkPath, trendFor } from "@/lib/burnout";

export function Sparkline({
  seed,
  end,
  width = 240,
  height = 56,
  stroke = "var(--brand)",
}: {
  seed: string;
  end: number;
  width?: number;
  height?: number;
  stroke?: string;
}) {
  const values = trendFor(seed, end);
  const path = sparkPath(values, width, height);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="14-day trend"
      className="overflow-visible"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
