import { Bell, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TonePicker } from "@/components/settings-dialog";
import { shapeFromFamily, type ShapeFamily } from "@/lib/shapes";
import { useTimer } from "@/lib/store";
import { cn, formatDuration, formatTime } from "@/lib/utils";

const INTERVAL_PRESETS = [5, 10, 15, 30];
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 120;

export function BellView({ compact }: { compact: boolean }) {
  const settings = useTimer((s) => s.settings);
  const update = useTimer((s) => s.updateSettings);
  const running = useTimer((s) => s.bellRunning);
  const rings = useTimer((s) => s.bellRings);
  const remainingSec = useTimer((s) => s.bellRemainingSec);
  const startBell = useTimer((s) => s.startBell);
  const stopBell = useTimer((s) => s.stopBell);

  const interval = settings.bellIntervalMinutes;
  const intervalSec = interval * 60;
  const progress = running && intervalSec > 0 ? 1 - remainingSec / intervalSec : 0;
  const setMinutes = (n: number) =>
    update({ bellIntervalMinutes: Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, Math.round(n))) });

  const label = running
    ? "Next bell"
    : rings > 0
      ? `${rings} ${rings === 1 ? "bell" : "bells"} · ${formatDuration(rings * interval)}`
      : "Ready";

  const readout = (
    <div className="flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-4xl font-light tabular-nums tracking-tight">
        {formatTime(running ? remainingSec : intervalSec)}
      </div>
    </div>
  );

  const controls = (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {INTERVAL_PRESETS.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={interval === m ? "secondary" : "ghost"}
            aria-pressed={interval === m}
            onClick={() => setMinutes(m)}
            className="min-w-11 px-2 font-mono"
          >
            {m}m
          </Button>
        ))}
        <Input
          type="number"
          aria-label="Minutes between bells"
          min={MIN_INTERVAL}
          max={MAX_INTERVAL}
          value={interval}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0) setMinutes(v);
          }}
          className="h-9 w-16 text-center font-mono"
        />
      </div>
      <div className="w-44">
        <TonePicker
          value={settings.intervalBellTone}
          volume={settings.bellVolume}
          onChange={(intervalBellTone) => update({ intervalBellTone })}
        />
      </div>
      {running ? (
        <Button size="sm" variant="ghost" onClick={stopBell} className="min-w-28">
          <Square className="h-3.5 w-3.5" /> Stop
        </Button>
      ) : (
        <Button size="sm" onClick={startBell} className="min-w-28">
          <Bell className="h-3.5 w-3.5" /> Start bell
        </Button>
      )}
    </div>
  );

  // The mandala takes whatever space is left and scales to it, so the view
  // fits any window: stacked in a tall window, side by side in the short bar.
  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 items-center justify-center overflow-hidden",
        compact ? "flex-row gap-5 px-3 py-1.5" : "flex-col gap-6",
      )}
    >
      <div className={cn("relative min-h-0 min-w-0 flex-1 self-stretch", !compact && "max-h-[420px]")}>
        <BellMandala rings={rings} active={running} progress={progress} className="absolute inset-0 h-full w-full" />
      </div>
      <div className={cn("flex shrink-0 items-center", compact ? "flex-row gap-5" : "flex-col gap-6")}>
        {readout}
        {controls}
      </div>
    </div>
  );
}

const VIEW = 400;
const RADIUS = 160;
/** Layers per round. Each round fills the disc from the center outward. */
const SLOTS = 8;
/** One shape family per round, so a long sitting builds a layered mandala. */
const ROUND_FAMILIES: ReadonlyArray<ShapeFamily> = ["circle", "polygon", "star"];
/** Families × variants: past this, new layers would retrace existing ones. */
const MAX_LAYERS = SLOTS * ROUND_FAMILIES.length * 3;
const NORM = 1000;

function layerPath(index: number): string {
  const round = Math.floor(index / SLOTS);
  const slot = index % SLOTS;
  const family = ROUND_FAMILIES[round % ROUND_FAMILIES.length];
  const variant = Math.floor(round / ROUND_FAMILIES.length);
  const r = (RADIUS * (slot + 1)) / SLOTS;
  // Circles use position 0 (a single ring); polygons and stars gain
  // complexity with the slot, so shapes get richer as they move outward.
  return shapeFromFamily(family, family === "circle" ? 0 : slot, r, variant).d;
}

/**
 * The drawing for one bell sitting. Every ring of the bell completes one
 * layer; the layer in progress strokes in over the interval and closes as the
 * bell sounds. Layers ripple outward from the center, eight to a round.
 */
function BellMandala({
  rings,
  active,
  progress,
  className,
}: {
  rings: number;
  active: boolean;
  progress: number;
  className?: string;
}) {
  const done = Math.min(rings, MAX_LAYERS);
  const activeIndex = active ? rings % MAX_LAYERS : -1;
  const currentRound = Math.floor((active ? activeIndex : Math.max(0, done - 1)) / SLOTS);
  const clamped = Math.max(0, Math.min(1, progress));
  const indices = Array.from({ length: done }, (_, i) => i).filter((i) => i !== activeIndex);

  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      className={cn("select-none", className)}
      role="img"
      aria-label={`Bell mandala, ${rings} ${rings === 1 ? "layer" : "layers"}`}
    >
      <circle cx={0} cy={0} r={RADIUS + 12} className="fill-none stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
      {indices.map((i) => (
        <path
          key={i}
          d={layerPath(i)}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-[hsl(var(--glyph))]"
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          // Earlier rounds recede so the round being drawn stays readable.
          strokeOpacity={Math.floor(i / SLOTS) === currentRound ? 0.9 : 0.4}
        />
      ))}
      {activeIndex >= 0 && (
        <path
          d={layerPath(activeIndex)}
          pathLength={NORM}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-[hsl(var(--glyph-active))]"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={NORM}
          strokeDashoffset={NORM * (1 - clamped)}
        />
      )}
    </svg>
  );
}
