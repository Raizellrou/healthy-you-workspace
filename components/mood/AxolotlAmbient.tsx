function Tear({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  return (
    <path
      className="axolotl-tear"
      style={{ animationDelay: `${delay}s` }}
      d="M0,0 C-1.1,1.5 -1.1,2.8 0,3.4 C1.1,2.8 1.1,1.5 0,0 Z"
      fill={color}
      transform={`translate(${x} ${y})`}
    />
  );
}

function Bubble({
  x,
  y,
  r,
  delay,
  color,
}: {
  x: number;
  y: number;
  r: number;
  delay: number;
  color: string;
}) {
  return (
    <circle
      className="axolotl-bubble"
      style={{ animationDelay: `${delay}s` }}
      cx={x}
      cy={y}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={0.8}
    />
  );
}

function Heart({
  x,
  y,
  scale,
  delay,
  color,
}: {
  x: number;
  y: number;
  scale: number;
  delay: number;
  color: string;
}) {
  return (
    <path
      className="axolotl-heart"
      style={{ animationDelay: `${delay}s` }}
      d="M0,1.1 C0,0 -1.5,0 -1.5,1.1 C-1.5,2.2 0,2.9 0,3.5 C0,2.9 1.5,2.2 1.5,1.1 C1.5,0 0,0 0,1.1 Z"
      fill={color}
      transform={`translate(${x} ${y}) scale(${scale})`}
    />
  );
}

function Sparkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  return (
    <path
      className="axolotl-sparkle"
      style={{ animationDelay: `${delay}s` }}
      d="M0,-2 L0.5,-0.5 L2,0 L0.5,0.5 L0,2 L-0.5,0.5 L-2,0 L-0.5,-0.5 Z"
      fill={color}
      transform={`translate(${x} ${y})`}
    />
  );
}

export function AxolotlAmbient({
  value,
  light,
  frill,
}: {
  value: 1 | 2 | 3 | 4 | 5;
  light: string;
  frill: string;
}) {
  if (value === 1) {
    return (
      <>
        <Tear x={11} y={15.5} delay={0} color={light} />
        <Tear x={21} y={15.5} delay={0.5} color={light} />
      </>
    );
  }
  if (value === 4) {
    return (
      <>
        <Bubble x={7} y={3} r={1.3} delay={0} color={light} />
        <Bubble x={16} y={0} r={1.8} delay={0.6} color={light} />
        <Bubble x={25} y={4} r={1.1} delay={1.2} color={light} />
      </>
    );
  }
  if (value === 5) {
    return (
      <>
        <Heart x={5} y={2} scale={1} delay={0} color={light} />
        <Heart x={27} y={4} scale={0.8} delay={0.5} color={light} />
        <Sparkle x={16} y={-1} delay={0.3} color={frill} />
        <Sparkle x={22} y={2} delay={0.9} color={frill} />
      </>
    );
  }
  return null;
}
