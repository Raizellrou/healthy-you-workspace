export interface BodyRect {
  kind: "frill" | "body";
  x: number;
  y: number;
  w: number;
  h: number;
}

// 32x40 viewBox, hand-built on a 4-unit pixel grid.
export const BODY_RECTS: BodyRect[] = [
  // left frill cluster
  { kind: "frill", x: 0, y: 6, w: 4, h: 4 },
  { kind: "frill", x: 2, y: 10, w: 4, h: 4 },
  // right frill cluster
  { kind: "frill", x: 28, y: 6, w: 4, h: 4 },
  { kind: "frill", x: 26, y: 10, w: 4, h: 4 },
  // head
  { kind: "body", x: 8, y: 4, w: 16, h: 12 },
  // body
  { kind: "body", x: 4, y: 16, w: 24, h: 14 },
  // front legs
  { kind: "body", x: 4, y: 30, w: 4, h: 4 },
  { kind: "body", x: 24, y: 30, w: 4, h: 4 },
  // back legs
  { kind: "body", x: 8, y: 34, w: 4, h: 4 },
  { kind: "body", x: 20, y: 34, w: 4, h: 4 },
  // tail
  { kind: "body", x: 28, y: 18, w: 4, h: 4 },
  { kind: "body", x: 28, y: 22, w: 4, h: 4 },
  { kind: "body", x: 28, y: 26, w: 4, h: 4 },
];
