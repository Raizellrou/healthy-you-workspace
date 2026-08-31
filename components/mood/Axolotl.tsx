import type { Mood } from "@/lib/constants";
import { AxolotlPixelArt } from "@/components/mood/axolotlPixelArt";

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
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`${mood.label} axolotl`}
    >
      <g className={`axo-art axo-float${active ? " axo-active" : ""}`}>
        <AxolotlPixelArt value={mood.value} />
      </g>
    </svg>
  );
}
