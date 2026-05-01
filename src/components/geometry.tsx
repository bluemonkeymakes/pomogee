import { useLayoutEffect, useRef, useState } from "react";
import { shapeFor, MAX_SHAPE_INDEX } from "@/lib/shapes";
import type { SessionMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface GeometryLayer {
  mode: SessionMode;
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
  const activeD = activeIndex >= 0 ? shapeFor(activeIndex, trimmed[activeIndex].mode, RADIUS).d : null;

  // Measure the active path's true geometric length so dashoffset finishes
  // exactly at progress=1, regardless of subpath count.
  const activeRef = useRef<SVGPathElement>(null);
  const [activeLen, setActiveLen] = useState(1000);
  useLayoutEffect(() => {
    if (activeRef.current) {
      const len = activeRef.current.getTotalLength();
      if (len > 0) setActiveLen(len);
    }
  }, [activeIndex, activeD]);

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
        const { d } = shapeFor(i, layer.mode, RADIUS);
        const isActive = i === activeIndex;
        const clamped = Math.max(0, Math.min(1, progress));
        const dashOffset = isActive ? activeLen * (1 - clamped) : 0;
        // Post-break / post-gap drawings use the calmer glyph color and a
        // thinner stroke; continuous drawings use the warm active highlight.
        const activeStroke = calmActive
          ? "stroke-[hsl(var(--glyph))]"
          : "stroke-[hsl(var(--glyph-active))]";
        const activeWidth = calmActive ? 1.2 : 2;
        return (
          <path
            key={i}
            ref={isActive ? activeRef : undefined}
            d={d}
            vectorEffect="non-scaling-stroke"
            className={cn(
              "fill-none",
              isActive
                ? activeStroke
                : broken
                  ? "stroke-[hsl(var(--glyph-broken))]"
                  : "stroke-[hsl(var(--glyph))]",
            )}
            strokeWidth={isActive ? activeWidth : 1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={isActive ? activeLen : broken ? "3 4" : undefined}
            strokeDashoffset={dashOffset}
            strokeOpacity={isActive ? (calmActive ? 0.9 : 1) : broken ? 0.55 : 0.9}
          />
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
        const { d } = shapeFor(i, layer.mode, RADIUS);
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
