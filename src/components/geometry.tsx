import { shapeFor, insetPath, insetForTime, MAX_SHAPE_INDEX } from "@/lib/shapes";
import type { SessionMode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Normalized path length for active-layer dash animation. pathLength={NORM}
 * on the path element lets dashoffset drive progress uniformly regardless of
 * geometric length. */
const NORM = 1000;

export interface GeometryLayer {
  mode: SessionMode;
  /** Session start (epoch ms). Drives day-variant + time-of-day inset. */
  startedAt: number;
}

interface GeometryProps {
  /** Completed work-session layers for today, ordered by position. */
  completedLayers: ReadonlyArray<GeometryLayer>;
  /** The layer currently being drawn (work phase running), or null. */
  activeLayer: GeometryLayer | null;
  /** Progress 0..1 of the active shape being drawn. */
  progress: number;
  /** Render the past shapes in "broken" style (dashed/faded). */
  broken: boolean;
  /** Pixel size of the SVG (square). */
  size?: number;
  className?: string;
}

const VIEW = 400; // viewBox extent; shapes are centered at (0,0) inside (-VIEW/2 .. VIEW/2)
const RADIUS = 160;

/**
 * Renders the layered mandala for the day. Each layer's shape is determined
 * by its (position, mode) — see `shapeFor`. The active layer strokes in based
 * on `progress`; past layers are drawn fully (faded + dashed if broken).
 */
export function Geometry({
  completedLayers,
  activeLayer,
  progress,
  broken,
  size = 360,
  className,
}: GeometryProps) {
  const allLayers: GeometryLayer[] = activeLayer
    ? [...completedLayers, activeLayer]
    : [...completedLayers];
  const cap = MAX_SHAPE_INDEX + 1;
  const trimmed = allLayers.slice(0, cap);
  const activeIndex = activeLayer ? Math.min(completedLayers.length, cap - 1) : -1;
  // Only the topmost layer (active if present, otherwise last completed) shows
  // the time-of-day inset — drawing it on every layer creates overlapping noise.
  const insetIndex = trimmed.length - 1;

  const calmActive = activeLayer?.mode === "break" || activeLayer?.mode === "gap";

  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className={cn("select-none", className)}
      role="img"
      aria-label="Sacred geometry session glyph"
    >
      {/* faint guide ring */}
      <circle
        cx={0}
        cy={0}
        r={RADIUS + 12}
        className="fill-none stroke-border"
        strokeWidth={0.5}
        strokeDasharray="2 4"
      />
      {trimmed.map((layer, i) => {
        const { d } = shapeFor(i, layer.mode, RADIUS, layer.startedAt);
        const isActive = i === activeIndex;
        const isTop = i === insetIndex;
        const clamped = Math.max(0, Math.min(1, progress));
        const activeStroke = calmActive
          ? "stroke-[hsl(var(--glyph))]"
          : "stroke-[hsl(var(--glyph-active))]";
        const activeWidth = calmActive ? 1.2 : 2;
        const outlineClass = isActive
          ? activeStroke
          : broken
            ? "stroke-[hsl(var(--glyph-broken))]"
            : "stroke-[hsl(var(--glyph))]";
        const outlineWidth = isActive ? activeWidth : 1.6;
        const outlineOpacity = isActive ? (calmActive ? 0.9 : 1) : broken ? 0.55 : 0.9;
        return (
          <g key={i}>
            <path
              d={d}
              pathLength={isActive ? NORM : undefined}
              vectorEffect="non-scaling-stroke"
              className={cn("fill-none", outlineClass)}
              strokeWidth={outlineWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={isActive ? NORM : broken ? "3 4" : undefined}
              strokeDashoffset={isActive ? NORM * (1 - clamped) : undefined}
              strokeOpacity={outlineOpacity}
            />
            {isTop && (
              <path
                d={insetPath(insetForTime(layer.startedAt), RADIUS)}
                vectorEffect="non-scaling-stroke"
                className={cn(
                  "fill-none",
                  broken ? "stroke-[hsl(var(--glyph-broken))]" : "stroke-[hsl(var(--glyph))]",
                )}
                strokeWidth={1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={isActive ? 0.25 + clamped * 0.6 : broken ? 0.45 : 0.75}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Compact glyph for calendar cells: stacks the day's actual layer sequence
 * so the cell mirrors the mandala the timer drew that day.
 */
export function GlyphSummary({
  layers,
  broken,
  size = 36,
  className,
}: {
  layers: ReadonlyArray<GeometryLayer>;
  broken: boolean;
  size?: number;
  className?: string;
}) {
  if (layers.length === 0) return <div style={{ width: size, height: size }} className={className} />;
  const trimmed = layers.slice(0, MAX_SHAPE_INDEX + 1);
  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className={cn("select-none", className)}
      aria-hidden
    >
      {trimmed.map((layer, i) => {
        const { d } = shapeFor(i, layer.mode, RADIUS, layer.startedAt);
        return (
          <path
            key={i}
            d={d}
            vectorEffect="non-scaling-stroke"
            className={cn(
              "fill-none",
              broken ? "stroke-[hsl(var(--glyph-broken))]" : "stroke-[hsl(var(--glyph))]",
            )}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={broken ? 0.55 : 0.9}
          />
        );
      })}
    </svg>
  );
}
