import { useEffect, useMemo } from "react";
import { Play, Pause, Square, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Geometry, type GeometryLayer } from "@/components/geometry";
import {
  useTimer,
  selectCurrentStreak,
  selectStreakBroken,
  selectActiveMode,
  toYmd,
} from "@/lib/store";
import type { Session } from "@/lib/types";
import { cn, formatTime, formatDuration } from "@/lib/utils";

const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function TimerView() {
  const phase = useTimer((s) => s.phase);
  const runState = useTimer((s) => s.runState);
  const remainingSec = useTimer((s) => s.remainingSec);
  const durationSec = useTimer((s) => s.durationSec);
  const settings = useTimer((s) => s.settings);
  const startWork = useTimer((s) => s.startWork);
  const startBreak = useTimer((s) => s.startBreak);
  const pause = useTimer((s) => s.pause);
  const resume = useTimer((s) => s.resume);
  const stop = useTimer((s) => s.stop);
  const tick = useTimer((s) => s.tick);

  const currentStreak = useTimer(selectCurrentStreak);
  const streakBroken = useTimer(selectStreakBroken);
  const activeMode = useTimer(selectActiveMode);
  const sessions = useTimer((s) => s.sessions);
  const startedAt = useTimer((s) => s.startedAt);

  const completedLayers = useMemo<GeometryLayer[]>(() => {
    const today = toYmd(Date.now());
    const layers: GeometryLayer[] = [];
    for (const s of sessions) {
      if (s.kind === "work" && s.completed && toYmd(s.startedAt) === today) {
        layers.push({ mode: s.mode ?? "continuous", startedAt: s.startedAt });
      }
    }
    return layers;
  }, [sessions]);
  const activeLayer: GeometryLayer | null =
    activeMode && startedAt != null ? { mode: activeMode, startedAt } : null;

  useEffect(() => {
    if (runState !== "running") return;
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [runState, tick]);

  const isWork = phase === "work";
  const drawingActive = isWork && runState !== "idle";
  const progress = durationSec > 0 ? 1 - remainingSec / durationSec : 0;

  const suggestLong =
    currentStreak > 0 && currentStreak % settings.longBreakEvery === 0;

  const display = phase === "idle" ? formatTime(settings.workMinutes * 60) : formatTime(remainingSec);

  const phaseLabel =
    phase === "idle"
      ? "Ready"
      : phase === "work"
        ? runState === "paused" ? "Focus · Paused" : "Focus"
        : phase === "shortBreak"
          ? runState === "paused" ? "Short Break · Paused" : "Short Break"
          : runState === "paused" ? "Long Break · Paused" : "Long Break";

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <Geometry
        completedLayers={completedLayers}
        activeLayer={activeLayer}
        progress={progress}
        broken={streakBroken && !drawingActive}
        size={420}
      />

      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg
          viewBox="-100 -100 200 200"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx={0}
            cy={0}
            r={RING_RADIUS}
            className="fill-none stroke-border"
            strokeWidth={2}
          />
          <circle
            cx={0}
            cy={0}
            r={RING_RADIUS}
            className="fill-none stroke-[hsl(var(--glyph-active))]"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={phase === "idle" ? 0 : RING_CIRCUMFERENCE * progress}
            opacity={phase === "idle" ? 0.25 : 1}
          />
        </svg>
        <div className="flex flex-col items-center">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {phaseLabel}
          </div>
          <div className="mt-1 font-mono text-4xl font-light tabular-nums tracking-tight">
            {display}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "idle" && (
          <>
            <Button size="sm" onClick={startWork} className="min-w-28">
              <Play className="h-3.5 w-3.5" /> Start focus
            </Button>
            {currentStreak > 0 && (
              <Button size="sm" variant="secondary" onClick={() => startBreak(suggestLong ? "longBreak" : "shortBreak")}>
                <Coffee className="h-3.5 w-3.5" /> {suggestLong ? "Long" : "Short"} break · {suggestLong ? settings.longBreakMinutes : settings.shortBreakMinutes}m
              </Button>
            )}
          </>
        )}
        {phase !== "idle" && runState === "running" && (
          <>
            <Button size="sm" variant="secondary" onClick={pause}>
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
            <Button size="sm" variant="ghost" onClick={stop}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          </>
        )}
        {phase !== "idle" && runState === "paused" && (
          <>
            <Button size="sm" onClick={resume}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
            <Button size="sm" variant="ghost" onClick={stop}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          </>
        )}
      </div>

      <DayTimeline sessions={sessions} />
      <TodayTotal sessions={sessions} />
    </div>
  );
}

function TodayTotal({ sessions }: { sessions: Session[] }) {
  const today = toYmd(Date.now());
  let seconds = 0;
  let count = 0;
  for (const s of sessions) {
    if (s.kind === "work" && s.completed && toYmd(s.startedAt) === today) {
      seconds += s.durationSec;
      count += 1;
    }
  }
  if (count === 0) return null;
  const minutes = Math.round(seconds / 60);
  return (
    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {count} · {formatDuration(minutes)} today
    </div>
  );
}

const TIMELINE_MARKERS = [
  { hour: 6,  label: "6am" },
  { hour: 12, label: "12pm" },
  { hour: 18, label: "6pm" },
];

/** Single 24h strip below the timer. Filled dots = completed work, hollow
 * dots = completed breaks. Tick marks at 6am, 12pm, 6pm for orientation. */
function DayTimeline({ sessions }: { sessions: Session[] }) {
  const today = toYmd(Date.now());
  const items = sessions
    .filter((s) => s.completed && toYmd(s.startedAt) === today)
    .map((s) => {
      const d = new Date(s.startedAt);
      const fraction = (d.getHours() * 60 + d.getMinutes()) / (24 * 60);
      return { id: s.id, isWork: s.kind === "work", fraction };
    });

  return (
    <div className="relative w-full max-w-md" aria-label="Today's session timeline">
      {/* track + dots */}
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {TIMELINE_MARKERS.map(({ hour }) => (
          <div
            key={hour}
            className="absolute top-1/2 h-1/2 w-px bg-border"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
        {items.map((it) => (
          <div
            key={it.id}
            className={cn(
              "absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              it.isWork
                ? "bg-muted-foreground"
                : "border border-muted-foreground bg-background",
            )}
            style={{ left: `${it.fraction * 100}%` }}
          />
        ))}
      </div>
      {/* labels */}
      <div className="relative h-3">
        {TIMELINE_MARKERS.map(({ hour, label }) => (
          <span
            key={hour}
            className="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/50"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
