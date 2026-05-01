/**
 * Sacred-geometry shape generator. Each shape is returned as a single SVG path
 * string (possibly containing multiple `M` subpaths). All shapes share the same
 * center (0, 0) and are sized to roughly fit a bounding circle of radius R.
 *
 * The combined path is rendered with `pathLength={1000}` so a caller can drive
 * stroke-dashoffset uniformly regardless of geometric length.
 */

import type { SessionMode } from "./types";

const TWO_PI = Math.PI * 2;

export interface ShapeDef {
  /** Path data. */
  d: string;
  /** Human label for tooltips/aria. */
  name: string;
  /** Number of independent subpaths (for staggered drawing if desired). */
  segments: number;
}

function polygonPoints(n: number, R: number, rotation = -Math.PI / 2): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = rotation + (i * TWO_PI) / n;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  return pts;
}

function polygonPath(n: number, R: number, rotation = -Math.PI / 2): string {
  const pts = polygonPoints(n, R, rotation);
  return (
    `M ${pts[0][0].toFixed(3)} ${pts[0][1].toFixed(3)} ` +
    pts.slice(1).map((p) => `L ${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(" ") +
    " Z"
  );
}

/** Star polygon {n/k}: visit every k-th vertex of n equally spaced points. */
function starPath(n: number, k: number, R: number, rotation = -Math.PI / 2): string {
  const pts = polygonPoints(n, R, rotation);
  const visited: Array<[number, number]> = [];
  let i = 0;
  do {
    visited.push(pts[i]);
    i = (i + k) % n;
  } while (i !== 0);
  return (
    `M ${visited[0][0].toFixed(3)} ${visited[0][1].toFixed(3)} ` +
    visited.slice(1).map((p) => `L ${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join(" ") +
    " Z"
  );
}

function circlePath(cx: number, cy: number, r: number): string {
  // Use two arcs to draw a full circle; M start, then 180° arc, then 180° arc, then Z.
  return `M ${(cx - r).toFixed(3)} ${cy.toFixed(3)} A ${r} ${r} 0 1 1 ${(cx + r).toFixed(3)} ${cy.toFixed(3)} A ${r} ${r} 0 1 1 ${(cx - r).toFixed(3)} ${cy.toFixed(3)} Z`;
}

/** Maximum number of layers stacked in a single day's mandala. */
export const MAX_SHAPE_INDEX = 12;

/** Star polygons {n/k} pre-picked to be unicursal (gcd(n, k) = 1) and visually
 * distinct. One entry per layer position 0..MAX_SHAPE_INDEX. */
const GAP_STAR_PRESETS: ReadonlyArray<readonly [number, number]> = [
  [5, 2],
  [7, 2],
  [7, 3],
  [8, 3],
  [9, 2],
  [9, 4],
  [10, 3],
  [11, 3],
  [11, 5],
  [12, 5],
  [13, 2],
  [13, 4],
  [13, 6],
];

/** Pick a shape based on the session's position within the day and the
 * mode that produced it. Each mode has its own visual family so the day's
 * mandala reads at a glance: polygons for flow, rings for rest, stars for
 * re-engagement. Every (position, mode) maps to a distinct path within
 * 0..MAX_SHAPE_INDEX. */
export function shapeFor(position: number, mode: SessionMode, R: number): ShapeDef {
  const p = Math.max(0, Math.min(position, MAX_SHAPE_INDEX));
  if (mode === "break") {
    // One concentric circle per layer, evenly spaced from inner to outer.
    const ringCount = p + 1;
    const parts: string[] = [];
    if (ringCount === 1) {
      parts.push(circlePath(0, 0, R * 0.85));
    } else {
      const minR = R * 0.3;
      const maxR = R * 0.95;
      const step = (maxR - minR) / (ringCount - 1);
      for (let c = 0; c < ringCount; c++) {
        parts.push(circlePath(0, 0, minR + c * step));
      }
    }
    return {
      d: parts.join(" "),
      name: ringCount === 1 ? "Circle" : `${ringCount} Rings`,
      segments: ringCount,
    };
  }
  if (mode === "gap") {
    const [n, k] = GAP_STAR_PRESETS[p];
    return { d: starPath(n, k, R), name: `Star {${n}/${k}}`, segments: 1 };
  }
  // continuous: polygons with 3..(3 + MAX_SHAPE_INDEX) sides.
  const sides = 3 + p;
  return { d: polygonPath(sides, R), name: `${sides}-gon`, segments: 1 };
}
