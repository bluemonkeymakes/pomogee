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
  /** Path data — always a single SVG subpath. */
  d: string;
  /** Human label for tooltips/aria. */
  name: string;
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
export const MAX_SHAPE_INDEX = 19;

/** Shape complexity caps at this position index. Sessions beyond it reuse the
 * same max-complexity shape — decagon for polygons, {11/3} for stars. Time-of-day
 * R-scaling still differentiates layers visually; only the line count plateaus. */
export const COMPLEXITY_CAP = 7;

/** Star polygons {n/k} — unicursal (gcd(n,k)=1) and visually distinct.
 * Pairs alternate between sparser (lower k) and denser (higher k) stars at
 * the same n to create variety. Indexed by layer position 0..MAX_SHAPE_INDEX. */
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
  [14, 3],
  [14, 5],
  [15, 4],
  [15, 7],
  [16, 3],
  [16, 5],
  [17, 2],
];

/** Day-of-year derived index in [0, modulo). Stepping by 7 (coprime with
 * common moduli) keeps consecutive days from looking near-identical while
 * still being deterministic. All sessions on the same local day share the
 * same value. */
export function dayVariantIndex(ts: number, modulo = 3): number {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return ((dayOfYear * 7) % modulo + modulo) % modulo;
}

/** Time-of-day bucket → which inscribed motif to draw inside the layer. */
export type InsetKind = "dot" | "triangle" | "star" | "ring";
export function insetForTime(ts: number): InsetKind {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 12) return "dot";
  if (h >= 12 && h < 17) return "triangle";
  if (h >= 17 && h < 22) return "star";
  return "ring";
}

/** Time-of-day → shape radius scale. Night sessions are drawn at full size;
 * shapes shrink toward morning so each session has a distinct visual footprint. */
export function scaleForTime(ts: number): number {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 12) return 0.55;  // morning
  if (h >= 12 && h < 17) return 0.72; // midday
  if (h >= 17 && h < 22) return 0.88; // evening
  return 1.0;                          // night
}

/** Path for the small inscribed motif at the center of a layer. Used as a
 * decorative inset to mark when (clock-time) the session ran. */
export function insetPath(kind: InsetKind, R: number): string {
  const r = R * 0.12;
  switch (kind) {
    case "dot":
      return circlePath(0, 0, r * 0.45);
    case "triangle":
      return polygonPath(3, r);
    case "star":
      return starPath(5, 2, r);
    case "ring":
      return circlePath(0, 0, r);
  }
}

/** Pick a shape based on the session's position within the day and the
 * mode that produced it. Each session always produces exactly one SVG path.
 * Mode families: polygons (work/continuous), circles (break), star polygons (gap).
 * If `startedAt` is provided, a day-variant (0–2) is derived from the day-of-year
 * and applied uniformly — same family, slight rotation or scale difference. */
export function shapeFor(
  position: number,
  mode: SessionMode,
  R: number,
  startedAt?: number,
): ShapeDef {
  const variant = startedAt != null ? dayVariantIndex(startedAt, 3) : 0;
  const scaledR = startedAt != null ? R * scaleForTime(startedAt) : R;
  return shapeForVariant(position, mode, scaledR, variant);
}

/** Directly pick a shape by explicit family, bypassing mode routing.
 * Useful for experiments and previews that want to override the normal mapping. */
export type ShapeFamily = "polygon" | "circle" | "star";

export function shapeFromFamily(
  family: ShapeFamily,
  position: number,
  R: number,
  variant: number,
): ShapeDef {
  const p = Math.max(0, Math.min(position, COMPLEXITY_CAP));
  const v = ((variant % 3) + 3) % 3;
  if (family === "circle") return breakShape(p, v, R);
  if (family === "star")   return gapShape(p, v, R);
  return continuousShape(p, v, R);
}

/** Same as `shapeFor` but takes a variant index directly. Useful for
 * previews and the showcase view. */
export function shapeForVariant(
  position: number,
  mode: SessionMode,
  R: number,
  variant: number,
): ShapeDef {
  const p = Math.max(0, Math.min(position, COMPLEXITY_CAP));
  const v = ((variant % 3) + 3) % 3;
  // Sessions beyond the cap get a rotation offset so they remain visually distinct
  // even when complexity (polygon sides / star type) has stopped increasing.
  const overflow = Math.max(0, position - COMPLEXITY_CAP);
  if (mode === "break") return breakShape(p, v, R, overflow);
  if (mode === "gap") return gapShape(p, v, R, overflow);
  return continuousShape(p, v, R, overflow);
}

// Golden ratio — irrational relative to any polygon's symmetry period, so
// overflow rotations never land on a previously-seen orientation within
// any practically reachable overflow count.
const PHI = (Math.sqrt(5) - 1) / 2; // ≈ 0.618

function continuousShape(p: number, variant: number, R: number, overflow = 0): ShapeDef {
  const sides = 3 + p;
  // Variants shift rotation or scale slightly for day-to-day variety.
  const rotation = variant === 1 ? -Math.PI / 2 + Math.PI / sides : -Math.PI / 2;
  const scale = variant === 2 ? 0.88 : 1;
  const overflowRot = overflow * (TWO_PI / sides) * PHI;
  return { d: polygonPath(sides, R * scale, rotation + overflowRot), name: `${sides}-gon` };
}

function breakShape(p: number, variant: number, R: number, overflow = 0): ShapeDef {
  const outerR = R * (0.85 - p * 0.05 - overflow * 0.025);
  const radiusScale = variant === 1 ? 0.93 : variant === 2 ? 0.86 : 1;
  const r0 = Math.max(outerR, R * 0.1) * radiusScale;
  // Position p → p rings: each position in the 1–7 cap range has a unique ring
  // count, so no two break sessions within a day share the same structure.
  const rings = Math.max(1, p);
  const step = 1 / (rings + 1);
  const paths: string[] = [];
  for (let i = 0; i < rings; i++) {
    paths.push(circlePath(0, 0, r0 * (1 - i * step)));
  }
  return { d: paths.join(" "), name: rings === 1 ? "Circle" : `Ring ×${rings}` };
}

function gapShape(p: number, variant: number, R: number, overflow = 0): ShapeDef {
  const [n, k] = GAP_STAR_PRESETS[p];
  const rotation = variant === 1 ? -Math.PI / 2 + Math.PI / n : -Math.PI / 2;
  const scale = variant === 2 ? 0.88 : 1;
  const overflowRot = overflow * (TWO_PI / n) * PHI;
  return { d: starPath(n, k, R * scale, rotation + overflowRot), name: `Star {${n}/${k}}` };
}
