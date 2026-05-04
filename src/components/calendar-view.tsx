import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Geometry, GlyphSummary, type GeometryLayer } from "@/components/geometry";
import { useTimer, toYmd } from "@/lib/store";
import type { Session } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

interface DayStats {
  works: number;
  workCompleted: number;
  shortBreaks: number;
  longBreaks: number;
  focusMinutes: number;
  layers: GeometryLayer[];
  broken: boolean;
}

function statsForDay(sessions: Session[]): DayStats {
  const stats: DayStats = {
    works: 0,
    workCompleted: 0,
    shortBreaks: 0,
    longBreaks: 0,
    focusMinutes: 0,
    layers: [],
    broken: false,
  };
  let anyInterrupted = false;
  for (const s of sessions) {
    if (s.kind === "work") {
      stats.works += 1;
      if (s.completed) {
        stats.focusMinutes += Math.round(s.durationSec / 60);
        stats.workCompleted += 1;
        stats.layers.push({ mode: s.mode ?? "continuous", startedAt: s.startedAt });
      } else {
        anyInterrupted = true;
      }
    } else if (s.kind === "shortBreak") {
      stats.shortBreaks += 1;
    } else {
      stats.longBreaks += 1;
    }
  }
  stats.broken = anyInterrupted;
  return stats;
}

export function CalendarView() {
  const sessions = useTimer((s) => s.sessions);
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const today = new Date();

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const k = toYmd(s.startedAt);
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [sessions]);

  function goToDay(d: Date) {
    setCursor(d);
    setView("day");
  }

  function nav(delta: 1 | -1) {
    setCursor((c) => {
      if (view === "month") return delta > 0 ? addMonths(c, 1) : subMonths(c, 1);
      if (view === "week") return delta > 0 ? addWeeks(c, 1) : subWeeks(c, 1);
      return delta > 0 ? addDays(c, 1) : subDays(c, 1);
    });
  }

  const title = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      const sameMonth = isSameMonth(ws, we);
      return `${format(ws, "MMM d")} – ${format(we, sameMonth ? "d" : "MMM d")}`;
    }
    return format(cursor, "EEEE, MMMM d");
  }, [cursor, view]);

  const monthSessions = useMemo(
    () => sessions.filter((s) => isSameMonth(new Date(s.startedAt), cursor)),
    [sessions, cursor],
  );
  const monthStats = useMemo(() => statsForDay(monthSessions), [monthSessions]);

  const bestStreak = useMemo(() => {
    let max = 0;
    for (const daySessions of sessionsByDay.values()) {
      if (!isSameMonth(new Date(daySessions[0].startedAt), cursor)) continue;
      const count = daySessions.filter((s) => s.kind === "work" && s.completed).length;
      if (count > max) max = count;
    }
    return max;
  }, [sessionsByDay, cursor]);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-0 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[11rem] text-center font-serif text-base">{title}</span>
            <Button variant="ghost" size="icon" onClick={() => nav(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
            <div className="flex overflow-hidden rounded-md border text-xs">
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 capitalize transition-colors",
                    view === v
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === "month" && (
          <MonthGrid
            cursor={cursor}
            today={today}
            sessionsByDay={sessionsByDay}
            onDayClick={goToDay}
          />
        )}
        {view === "week" && (
          <WeekGrid
            cursor={cursor}
            today={today}
            sessionsByDay={sessionsByDay}
            onDayClick={goToDay}
          />
        )}
        {view === "day" && (
          <DayView
            date={cursor}
            sessions={sessionsByDay.get(toYmd(cursor.getTime())) ?? []}
          />
        )}
        {view === "month" && <MonthSummary stats={monthStats} bestStreak={bestStreak} />}
      </CardContent>
    </Card>
  );
}

// ── Month grid ────────────────────────────────────────────────────────────

function MonthGrid({
  cursor,
  today,
  sessionsByDay,
  onDayClick,
}: {
  cursor: Date;
  today: Date;
  sessionsByDay: Map<string, Session[]>;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <>
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wider text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const ymd = toYmd(d.getTime());
          const daySessions = sessionsByDay.get(ymd) ?? [];
          const stats = statsForDay(daySessions);
          const isCurrentMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          return (
            <Popover key={ymd}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "group relative flex aspect-square flex-col items-center justify-center rounded-md border bg-card p-1 text-xs transition-colors hover:bg-accent",
                    !isCurrentMonth && "opacity-40",
                    isToday && "ring-2 ring-ring",
                  )}
                >
                  <span className="absolute left-1 top-1 text-[10px] text-muted-foreground">
                    {format(d, "d")}
                  </span>
                  <GlyphSummary layers={stats.layers} broken={stats.broken} size={36} />
                  {stats.workCompleted > 0 && (
                    <span className="absolute bottom-0.5 right-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {stats.workCompleted}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <DayPopover
                  date={d}
                  sessions={daySessions}
                  stats={stats}
                  onOpenDay={() => onDayClick(d)}
                />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </>
  );
}

// ── Week grid ─────────────────────────────────────────────────────────────

function WeekGrid({
  cursor,
  today,
  sessionsByDay,
  onDayClick,
}: {
  cursor: Date;
  today: Date;
  sessionsByDay: Map<string, Session[]>;
  onDayClick: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    const end = endOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const ymd = toYmd(d.getTime());
        const daySessions = sessionsByDay.get(ymd) ?? [];
        const stats = statsForDay(daySessions);
        const isToday = isSameDay(d, today);
        return (
          <button
            key={ymd}
            onClick={() => onDayClick(d)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-md border bg-card p-2 transition-colors hover:bg-accent",
              isToday && "ring-2 ring-ring",
            )}
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(d, "EEE")}
              </span>
              <span className={cn("font-mono text-sm tabular-nums", isToday && "font-bold")}>
                {format(d, "d")}
              </span>
            </div>
            <GlyphSummary layers={stats.layers} broken={stats.broken} size={48} />
            {stats.workCompleted > 0 ? (
              <span className="text-center font-mono text-[10px] tabular-nums">
                {stats.workCompleted} · {formatDuration(stats.focusMinutes)}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">—</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────────────────

function DayView({ sessions }: { date: Date; sessions: Session[] }) {
  const stats = useMemo(() => statsForDay(sessions), [sessions]);
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => a.startedAt - b.startedAt),
    [sessions],
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <Geometry
        completedLayers={stats.layers}
        activeLayer={null}
        progress={1}
        broken={stats.broken}
        size={220}
      />

      <div className="w-full max-w-sm">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No sessions.</p>
        ) : (
          <ol className="space-y-1.5">
            {sorted.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      s.kind === "work" ? "bg-foreground" : "bg-muted-foreground",
                    )}
                  />
                  <span className="text-muted-foreground tabular-nums">
                    {format(new Date(s.startedAt), "h:mm a")}
                  </span>
                  <span>
                    {s.kind === "work"
                      ? "Work"
                      : s.kind === "shortBreak"
                        ? "Short break"
                        : "Long break"}
                  </span>
                  {s.kind === "work" && s.mode && s.mode !== "continuous" && (
                    <span className="rounded-sm bg-muted px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.mode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="tabular-nums">{formatDuration(Math.round(s.durationSec / 60))}</span>
                  <span className={cn("text-xs", s.completed ? "text-foreground" : "opacity-40")}>
                    {s.completed ? "✓" : "✗"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {stats.works > 0 && (
        <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
          <Stat
            label="Focus"
            value={`${stats.workCompleted}${stats.works > stats.workCompleted ? `/${stats.works}` : ""} · ${formatDuration(stats.focusMinutes)}`}
          />
          <Stat label="Breaks" value={String(stats.shortBreaks + stats.longBreaks)} />
        </div>
      )}
    </div>
  );
}

// ── Month cell popover ────────────────────────────────────────────────────

function DayPopover({
  date,
  sessions,
  stats,
  onOpenDay,
}: {
  date: Date;
  sessions: Session[];
  stats: DayStats;
  onOpenDay: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-serif text-base font-semibold">{format(date, "EEEE, MMM d")}</div>
        <GlyphSummary layers={stats.layers} broken={stats.broken} size={28} />
      </div>
      {sessions.length === 0 ? (
        <div className="text-sm text-muted-foreground">No sessions.</div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Focus</dt>
          <dd className="text-right tabular-nums">
            {stats.workCompleted}{stats.works > stats.workCompleted ? `/${stats.works}` : ""} · {formatDuration(stats.focusMinutes)}
          </dd>
          <dt className="text-muted-foreground">Short breaks</dt>
          <dd className="text-right tabular-nums">{stats.shortBreaks}</dd>
          <dt className="text-muted-foreground">Long breaks</dt>
          <dd className="text-right tabular-nums">{stats.longBreaks}</dd>
        </dl>
      )}
      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onOpenDay}>
        View full day →
      </Button>
    </div>
  );
}

// ── Month footer summary ──────────────────────────────────────────────────

function MonthSummary({ stats, bestStreak }: { stats: DayStats; bestStreak: number }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <Stat label="Focus" value={`${stats.workCompleted} · ${formatDuration(stats.focusMinutes)}`} />
      <Stat label="Short brk" value={String(stats.shortBreaks)} />
      <Stat label="Long brk" value={String(stats.longBreaks)} />
      <Stat label="Best day" value={String(bestStreak)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}
