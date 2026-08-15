import { sparkPath, trendFor } from "@/lib/burnout";

export function Sparkline({
  seed,
  end,
  values,
  width = 240,
  height = 56,
  stroke = "var(--brand)",
}: {
  seed?: string;
  end?: number;
  values?: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  const points = values ?? trendFor(seed!, end!);
  const path = sparkPath(points, width, height);
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
