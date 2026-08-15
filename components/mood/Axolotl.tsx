import type { Mood } from "@/lib/constants";
import { BODY_RECTS } from "@/components/mood/axolotlShape";
import { AxolotlFace } from "@/components/mood/AxolotlFace";
import { AxolotlAmbient } from "@/components/mood/AxolotlAmbient";

export function Axolotl({
  mood,
  active = false,
  size = 64,
  className = "",
}: {
  mood: Mood;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 40"
      width={size}
      height={(size * 40) / 32}
      className={className}
      role="img"
      aria-label={`${mood.label} axolotl`}
    >
      <g className={`axolotl-body${active ? " axolotl-active" : ""}`}>
        {BODY_RECTS.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={1}
            fill={r.kind === "frill" ? mood.frill : mood.body}
            stroke={mood.line}
            strokeWidth={0.6}
          />
        ))}
        <rect
          x={11}
          y={19}
          width={10}
          height={9}
          rx={2}
          fill={mood.light}
          opacity={0.55}
        />
        <AxolotlFace value={mood.value} line={mood.line} />
      </g>
      <AxolotlAmbient value={mood.value} light={mood.light} frill={mood.frill} />
    </svg>
  );
}
