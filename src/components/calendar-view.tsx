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
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlyphSummary, type GeometryLayer } from "@/components/geometry";
import { useTimer, toYmd } from "@/lib/store";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DayStats {
  works: number;
  workCompleted: number;
  shortBreaks: number;
  longBreaks: number;
  focusMinutes: number;
  layers: GeometryLayer[]; // ordered shape layers drawn that day
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
      const elapsedSec = (s.endedAt - s.startedAt) / 1000;
      stats.focusMinutes += Math.round(elapsedSec / 60);
      if (s.completed) {
        stats.workCompleted += 1;
        stats.layers.push({ mode: s.mode ?? "continuous" });
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
  const [cursor, setCursor] = useState<Date>(new Date());
  const today = new Date();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const k = toYmd(s.startedAt);
      const list = map.get(k);
      if (list) list.push(s);
      else map.set(k, [s]);
    }
    return map;
  }, [sessions]);

  const monthSessions = useMemo(
    () => sessions.filter((s) => isSameMonth(new Date(s.startedAt), cursor)),
    [sessions, cursor],
  );
  const monthStats = useMemo(() => statsForDay(monthSessions), [monthSessions]);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{format(cursor, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
                  <DayDetail date={d} sessions={daySessions} stats={stats} />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>

        <MonthSummary stats={monthStats} />
      </CardContent>
    </Card>
  );
}

function DayDetail({ date, sessions, stats }: { date: Date; sessions: Session[]; stats: DayStats }) {
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
          <dt className="text-muted-foreground">Focus sessions</dt>
          <dd className="text-right tabular-nums">
            {stats.workCompleted}
            {stats.works > stats.workCompleted ? ` / ${stats.works}` : ""}
          </dd>
          <dt className="text-muted-foreground">Focus time</dt>
          <dd className="text-right tabular-nums">{stats.focusMinutes}m</dd>
          <dt className="text-muted-foreground">Short breaks</dt>
          <dd className="text-right tabular-nums">{stats.shortBreaks}</dd>
          <dt className="text-muted-foreground">Long breaks</dt>
          <dd className="text-right tabular-nums">{stats.longBreaks}</dd>
          <dt className="text-muted-foreground">Streak reached</dt>
          <dd className="text-right tabular-nums">{stats.workCompleted}</dd>
        </dl>
      )}
    </div>
  );
}

function MonthSummary({ stats }: { stats: DayStats }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
      <Stat label="Sessions" value={stats.workCompleted} />
      <Stat label="Focus min" value={stats.focusMinutes} />
      <Stat label="Short brk" value={stats.shortBreaks} />
      <Stat label="Long brk" value={stats.longBreaks} />
      <Stat label="Best streak" value={stats.workCompleted} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}
