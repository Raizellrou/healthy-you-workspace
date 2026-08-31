/**
 * Pixel-art axolotl body, ported from a design export (axolotlmooddesign.html
 * / axolotlicons.svg.html) covering all 5 moods. The gills/body/belly shapes
 * are pixel-identical across every mood in the source file — only the fill
 * colors and the face/ambient details change — so they're factored into one
 * shared coordinate list per layer instead of five near-duplicate blocks.
 */

interface AxoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FaceRect extends AxoRect {
  /** Defaults to the mood's outline color when omitted. */
  fill?: string;
}

const OUTLINE_RECTS: AxoRect[] = [
  { x: 3, y: 6, w: 6, h: 5 },
  { x: 1, y: 5, w: 4, h: 5 },
  { x: 2, y: 10, w: 7, h: 5 },
  { x: 0, y: 10, w: 4, h: 5 },
  { x: 3, y: 14, w: 6, h: 5 },
  { x: 1, y: 15, w: 4, h: 5 },
  { x: 23, y: 6, w: 6, h: 5 },
  { x: 27, y: 5, w: 4, h: 5 },
  { x: 23, y: 10, w: 7, h: 5 },
  { x: 28, y: 10, w: 4, h: 5 },
  { x: 23, y: 14, w: 6, h: 5 },
  { x: 27, y: 15, w: 4, h: 5 },
  { x: 6, y: 7, w: 20, h: 15 },
  { x: 10, y: 20, w: 12, h: 9 },
  { x: 7, y: 21, w: 5, h: 6 },
  { x: 20, y: 21, w: 5, h: 6 },
  { x: 13, y: 27, w: 6, h: 9 },
];

const GILL_MID_RECTS: AxoRect[] = [
  { x: 4, y: 7, w: 4, h: 3 },
  { x: 2, y: 6, w: 2, h: 3 },
  { x: 3, y: 11, w: 5, h: 3 },
  { x: 1, y: 11, w: 2, h: 3 },
  { x: 4, y: 15, w: 4, h: 3 },
  { x: 2, y: 16, w: 2, h: 3 },
  { x: 24, y: 7, w: 4, h: 3 },
  { x: 28, y: 6, w: 2, h: 3 },
  { x: 24, y: 11, w: 5, h: 3 },
  { x: 29, y: 11, w: 2, h: 3 },
  { x: 24, y: 15, w: 4, h: 3 },
  { x: 28, y: 16, w: 2, h: 3 },
];

const BODY_MAIN_RECTS: AxoRect[] = [
  { x: 7, y: 8, w: 18, h: 13 },
  { x: 11, y: 21, w: 10, h: 7 },
  { x: 8, y: 22, w: 3, h: 4 },
  { x: 21, y: 22, w: 3, h: 4 },
  { x: 14, y: 28, w: 4, h: 7 },
];

const BELLY_LIGHT_RECT: AxoRect = { x: 9, y: 10, w: 14, h: 9 };

interface AxoPalette {
  outline: string;
  gillMid: string;
  bodyMain: string;
  bellyLight: string;
}

const BLUSH = "rgba(255,110,140,0.55)";

const AXO_PALETTE: Record<1 | 2 | 3 | 4 | 5, AxoPalette> = {
  1: { outline: "#4d150f", gillMid: "#a52f22", bodyMain: "#c0392b", bellyLight: "#d9584a" },
  2: { outline: "#5e3210", gillMid: "#c9752f", bodyMain: "#e08a3c", bellyLight: "#f0a862" },
  3: { outline: "#5e4c13", gillMid: "#cfae42", bodyMain: "#e8c85c", bellyLight: "#f5de8f" },
  4: { outline: "#0f4550", gillMid: "#2e93a4", bodyMain: "#3fb9cb", bellyLight: "#8fdde8" },
  5: { outline: "#6d1d3b", gillMid: "#d4577f", bodyMain: "#ef7099", bellyLight: "#f9adc4" },
};

const FACE_RECTS: Record<1 | 2 | 3 | 4 | 5, FaceRect[]> = {
  1: [
    { x: 11, y: 13, w: 2, h: 1 },
    { x: 13, y: 14, w: 1, h: 1 },
    { x: 19, y: 13, w: 2, h: 1 },
    { x: 18, y: 14, w: 1, h: 1 },
    { x: 14, y: 17, w: 1, h: 1 },
    { x: 15, y: 16, w: 3, h: 1 },
    { x: 18, y: 17, w: 1, h: 1 },
  ],
  2: [
    { x: 12, y: 14, w: 2, h: 1 },
    { x: 18, y: 14, w: 2, h: 1 },
    { x: 14, y: 17, w: 1, h: 1 },
    { x: 15, y: 16, w: 3, h: 1 },
    { x: 18, y: 17, w: 1, h: 1 },
  ],
  3: [
    { x: 12, y: 13, w: 2, h: 2 },
    { x: 18, y: 13, w: 2, h: 2 },
    { x: 14, y: 17, w: 4, h: 1 },
  ],
  4: [
    { x: 12, y: 13, w: 2, h: 2 },
    { x: 18, y: 13, w: 2, h: 2 },
    { x: 14, y: 16, w: 1, h: 1 },
    { x: 15, y: 17, w: 2, h: 1 },
    { x: 17, y: 16, w: 1, h: 1 },
    { x: 10, y: 15, w: 2, h: 1, fill: BLUSH },
    { x: 20, y: 15, w: 2, h: 1, fill: BLUSH },
  ],
  5: [
    { x: 11, y: 14, w: 1, h: 1 },
    { x: 12, y: 13, w: 2, h: 1 },
    { x: 14, y: 14, w: 1, h: 1 },
    { x: 17, y: 14, w: 1, h: 1 },
    { x: 18, y: 13, w: 2, h: 1 },
    { x: 20, y: 14, w: 1, h: 1 },
    { x: 14, y: 16, w: 4, h: 2 },
    { x: 15, y: 17, w: 2, h: 1, fill: "#f9adc4" },
    { x: 10, y: 15, w: 2, h: 1, fill: BLUSH },
    { x: 20, y: 15, w: 2, h: 1, fill: BLUSH },
  ],
};

function Rects({ list, fill }: { list: AxoRect[]; fill: string }) {
  return (
    <>
      {list.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} />
      ))}
    </>
  );
}

/** Tears (Awful), rising bubbles (Good), hearts + sparkle bursts (Great) —
 *  revealed via .axo-amb, animated via the axo-tear/axo-rise classes
 *  defined in app/globals.css. Low and Okay have no ambient effect. */
function AxoAmbient({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  switch (value) {
    case 1:
      return (
        <g className="axo-amb">
          <g className="axo-tear-1">
            <rect x={12} y={15} width={1} height={2} fill="#9fdcf5" />
          </g>
          <g className="axo-tear-2">
            <rect x={19} y={15} width={1} height={2} fill="#9fdcf5" />
          </g>
        </g>
      );
    case 4:
      return (
        <g className="axo-amb">
          <circle className="axo-rise-1" cx={26} cy={12} r={1.6} fill="none" stroke="#bfeaf2" strokeWidth={0.8} />
          <circle className="axo-rise-2" cx={29} cy={17} r={1.1} fill="none" stroke="#bfeaf2" strokeWidth={0.8} />
          <circle className="axo-rise-3" cx={24} cy={21} r={1.3} fill="none" stroke="#bfeaf2" strokeWidth={0.8} />
        </g>
      );
    case 5:
      return (
        <g className="axo-amb">
          <g className="axo-rise-1">
            <rect x={26} y={9} width={1} height={1} fill="#ff5d8f" />
            <rect x={28} y={9} width={1} height={1} fill="#ff5d8f" />
            <rect x={26} y={10} width={3} height={1} fill="#ff5d8f" />
            <rect x={27} y={11} width={1} height={1} fill="#ff5d8f" />
          </g>
          <g className="axo-rise-1">
            <rect x={3} y={12} width={1} height={1} fill="#ff5d8f" />
            <rect x={5} y={12} width={1} height={1} fill="#ff5d8f" />
            <rect x={3} y={13} width={3} height={1} fill="#ff5d8f" />
            <rect x={4} y={14} width={1} height={1} fill="#ff5d8f" />
          </g>
          <g className="axo-rise-2">
            <rect x={29} y={20} width={1} height={3} fill="#ffffff" />
            <rect x={28} y={21} width={3} height={1} fill="#ffffff" />
          </g>
          <g className="axo-rise-3">
            <rect x={3} y={22} width={1} height={3} fill="#ffffff" />
            <rect x={2} y={23} width={3} height={1} fill="#ffffff" />
          </g>
        </g>
      );
    default:
      return null;
  }
}

export function AxolotlPixelArt({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  const palette = AXO_PALETTE[value];
  return (
    <>
      <Rects list={OUTLINE_RECTS} fill={palette.outline} />
      <Rects list={GILL_MID_RECTS} fill={palette.gillMid} />
      <Rects list={BODY_MAIN_RECTS} fill={palette.bodyMain} />
      <rect x={BELLY_LIGHT_RECT.x} y={BELLY_LIGHT_RECT.y} width={BELLY_LIGHT_RECT.w} height={BELLY_LIGHT_RECT.h} fill={palette.bellyLight} />
      {FACE_RECTS[value].map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill ?? palette.outline} />
      ))}
      <AxoAmbient value={value} />
    </>
  );
}
