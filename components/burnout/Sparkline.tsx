import { sparkPath, trendFor } from "@/lib/burnout";

export function Sparkline({
  seed,
  end,
  values,
  width = 240,
  height = 56,
  stroke = "var(--brand)",
  filled = false,
}: {
  seed?: string;
  end?: number;
  values?: number[];
  width?: number;
  height?: number;
  stroke?: string;
  filled?: boolean;
}) {
  const points = values ?? trendFor(seed!, end!);
  const path = sparkPath(points, width, height);
  const areaPath = filled && points.length > 0 ? `${path} L${width} ${height} L0 ${height} Z` : null;
  const gradientId = `spark-fill-${stroke.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="14-day trend"
      className="overflow-visible"
    >
      {areaPath ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        </>
      ) : null}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
