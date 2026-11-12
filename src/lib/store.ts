import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playBell } from "./bell";
import {
  DEFAULT_SETTINGS,
  type Phase,
  type RunState,
  type Session,
  type SessionKind,
  type SessionMode,
  type Settings,
} from "./types";
import { bringWindowToFront } from "./window";

/** Idle gap (ms) above which the next work session counts as `gap` mode
 * regardless of what preceded it. Tuned so a quick coffee refill stays
 * "continuous" but a meeting interruption registers as a gap. */
const GAP_MS = 10 * 60 * 1000;

interface TimerState {
  // config
  settings: Settings;
  // runtime
  phase: Phase;
  runState: RunState;
  endsAt: number | null; // epoch ms when current run ends
  remainingSec: number; // last known remaining (also used while paused)
  durationSec: number; // current phase total
  startedAt: number | null; // epoch ms current phase began
  // interval bell (Bell tab). Runs independently of the timer and is never
  // persisted: a sitting is for the moment, not for the record.
  bellRunning: boolean;
  bellStartedAt: number | null; // epoch ms the sitting began
  bellNextAt: number | null; // epoch ms of the next ring
  bellRings: number; // rings completed this sitting (the opening bell is not counted)
  bellRemainingSec: number; // last known time to the next ring
  // history
  sessions: Session[];
  // actions
  startWork: () => void;
  startBreak: (kind: "shortBreak" | "longBreak") => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  startBell: () => void;
  stopBell: () => void;
  tick: () => void;
  finishCurrent: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  reset: () => void;
}

const phaseToKind: Record<Exclude<Phase, "idle">, SessionKind> = {
  work: "work",
  shortBreak: "shortBreak",
  longBreak: "longBreak",
};

function durationFor(phase: Exclude<Phase, "idle">, s: Settings): number {
  if (phase === "work") return s.workMinutes * 60;
  if (phase === "shortBreak") return s.shortBreakMinutes * 60;
  return s.longBreakMinutes * 60;
}

function newId() {
  return Math.random().toString(36).slice(2, 11);
}

/** Most recent session (any kind) on the given local day. */
function lastSessionOnDay(sessions: Session[], ymd: string): Session | undefined {
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (toYmd(sessions[i].startedAt) === ymd) return sessions[i];
  }
  return undefined;
}

export function computeMode(prior: Session | undefined, startedAt: number): SessionMode {
  if (!prior) return "continuous";
  if (startedAt - prior.endedAt > GAP_MS) return "gap";
  if (prior.kind === "shortBreak" || prior.kind === "longBreak") return "break";
  return "continuous";
}

function appendSession(
  state: TimerState,
  opts: { kind: SessionKind; startedAt: number; endedAt: number; durationSec: number; completed: boolean },
): Session[] {
  let streakIndex = -1;
  let mode: SessionMode | undefined;
  if (opts.kind === "work" && opts.completed) {
    const ymd = toYmd(opts.startedAt);
    let prior = 0;
    for (const s of state.sessions) {
      if (s.kind === "work" && s.completed && toYmd(s.startedAt) === ymd) prior += 1;
    }
    streakIndex = prior;
    mode = computeMode(lastSessionOnDay(state.sessions, ymd), opts.startedAt);
  }
  return [
    ...state.sessions,
    {
      id: newId(),
      kind: opts.kind,
      startedAt: opts.startedAt,
      endedAt: opts.endedAt,
      durationSec: opts.durationSec,
      completed: opts.completed,
      streakIndex,
      mode,
    },
  ];
}

export const useTimer = create<TimerState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      phase: "idle",
      runState: "idle",
      endsAt: null,
      remainingSec: 0,
      durationSec: 0,
      startedAt: null,
      bellRunning: false,
      bellStartedAt: null,
      bellNextAt: null,
      bellRings: 0,
      bellRemainingSec: 0,
      sessions: [],

      startWork: () => {
        const s = get().settings;
        const dur = durationFor("work", s);
        const now = Date.now();
        set({
          phase: "work",
          runState: "running",
          durationSec: dur,
          remainingSec: dur,
          startedAt: now,
          endsAt: now + dur * 1000,
        });
      },

      startBreak: (kind) => {
        const s = get().settings;
        const dur = durationFor(kind, s);
        const now = Date.now();
        set({
          phase: kind,
          runState: "running",
          durationSec: dur,
          remainingSec: dur,
          startedAt: now,
          endsAt: now + dur * 1000,
        });
      },

      pause: () => {
        const { runState, endsAt } = get();
        if (runState !== "running" || endsAt == null) return;
        const remainingSec = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        set({ runState: "paused", remainingSec, endsAt: null });
      },

      resume: () => {
        const { runState, remainingSec } = get();
        if (runState !== "paused") return;
        const now = Date.now();
        set({ runState: "running", endsAt: now + remainingSec * 1000 });
      },

      stop: () => {
        const { phase, startedAt, durationSec, runState, endsAt, remainingSec } = get();
        if (phase === "idle" || startedAt == null) {
          set({ phase: "idle", runState: "idle", endsAt: null, remainingSec: 0, durationSec: 0, startedAt: null });
          return;
        }
        const now = Date.now();
        // record an interrupted session if any time elapsed
        const elapsed =
          runState === "running" && endsAt != null
            ? Math.max(0, durationSec - Math.round((endsAt - now) / 1000))
            : durationSec - remainingSec;
        if (elapsed > 5) {
          set((state) => ({
            sessions: appendSession(state, {
              kind: phaseToKind[phase as Exclude<Phase, "idle">],
              startedAt,
              endedAt: now,
              durationSec,
              completed: false,
            }),
          }));
        }
        set({ phase: "idle", runState: "idle", endsAt: null, remainingSec: 0, durationSec: 0, startedAt: null });
      },

      startBell: () => {
        const { settings } = get();
        const now = Date.now();
        const intervalSec = settings.bellIntervalMinutes * 60;
        set({
          bellRunning: true,
          bellStartedAt: now,
          bellNextAt: now + intervalSec * 1000,
          bellRings: 0,
          bellRemainingSec: intervalSec,
        });
        // Opening bell: marks the start and confirms tone and volume.
        playBell(settings.intervalBellTone, settings.bellVolume);
      },

      // Keeps `bellRings` so the finished drawing stays up until the next start.
      stopBell: () => set({ bellRunning: false, bellNextAt: null, bellRemainingSec: 0 }),

      tick: () => {
        const now = Date.now();
        const { runState, endsAt, bellRunning, bellNextAt } = get();
        if (runState === "running" && endsAt != null) {
          const remaining = Math.max(0, (endsAt - now) / 1000);
          set({ remainingSec: remaining });
          if (remaining <= 0) get().finishCurrent();
        }
        if (bellRunning && bellNextAt != null) {
          if (now < bellNextAt) {
            set({ bellRemainingSec: (bellNextAt - now) / 1000 });
          } else {
            const { settings, bellRings } = get();
            const intervalMs = settings.bellIntervalMinutes * 60 * 1000;
            // After a long stall (sleep, throttling) several rings may be due.
            // Count them all so the drawing stays truthful, but ring only once.
            const due = Math.floor((now - bellNextAt) / intervalMs) + 1;
            const next = bellNextAt + due * intervalMs;
            set({ bellRings: bellRings + due, bellNextAt: next, bellRemainingSec: (next - now) / 1000 });
            playBell(settings.intervalBellTone, settings.bellVolume);
          }
        }
      },

      finishCurrent: () => {
        const { phase, startedAt, durationSec, endsAt, settings } = get();
        if (phase === "idle" || startedAt == null) return;
        // Stamp the scheduled end, not the moment we noticed: a throttled or
        // sleeping webview can run this tick well after the deadline passed.
        const now = endsAt != null ? Math.min(endsAt, Date.now()) : Date.now();
        const kind = phaseToKind[phase as Exclude<Phase, "idle">];
        set((state) => ({
          sessions: appendSession(state, {
            kind,
            startedAt,
            endedAt: now,
            durationSec,
            completed: true,
          }),
          phase: "idle",
          runState: "idle",
          endsAt: null,
          remainingSec: 0,
          durationSec: 0,
          startedAt: null,
        }));
        // auto-suggest next phase by setting remainingSec/phase to idle; UI prompts
        // (don't auto-start next phase — user agency)
        if (settings.bellOnComplete) playBell(settings.bellTone, settings.bellVolume);
        if (settings.focusOnComplete) void bringWindowToFront();
      },

      updateSettings: (s) =>
        set((state) => {
          const settings = { ...state.settings, ...s };
          // Changing the interval mid-sitting restarts the current wait at the new length.
          if (state.bellRunning && settings.bellIntervalMinutes !== state.settings.bellIntervalMinutes) {
            const intervalSec = settings.bellIntervalMinutes * 60;
            return { settings, bellNextAt: Date.now() + intervalSec * 1000, bellRemainingSec: intervalSec };
          }
          return { settings };
        }),

      reset: () =>
        set({
          settings: DEFAULT_SETTINGS,
          phase: "idle",
          runState: "idle",
          endsAt: null,
          remainingSec: 0,
          durationSec: 0,
          startedAt: null,
          bellRunning: false,
          bellStartedAt: null,
          bellNextAt: null,
          bellRings: 0,
          bellRemainingSec: 0,
          sessions: [],
        }),
    }),
    {
      name: "pomoge:timer",
      partialize: (s) => ({ settings: s.settings, sessions: s.sessions }),
      // Backfill any settings field added after a user first persisted, so new
      // options (e.g. focusOnComplete) don't read back as undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TimerState>;
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);

/** Selector: completed work sessions so far today. The drawing accumulates
 * over the calendar day and only resets at the day boundary. */
export function selectCurrentStreak(state: TimerState): number {
  const today = toYmd(Date.now());
  let count = 0;
  for (const s of state.sessions) {
    if (s.kind === "work" && s.completed && toYmd(s.startedAt) === today) {
      count += 1;
    }
  }
  return count;
}

/** True when today contains any interrupted work session. */
export function selectStreakBroken(state: TimerState): boolean {
  const today = toYmd(Date.now());
  for (const s of state.sessions) {
    if (s.kind === "work" && !s.completed && toYmd(s.startedAt) === today) return true;
  }
  return false;
}

/** Mode of the work session currently in flight, or null when not running. */
export function selectActiveMode(state: TimerState): SessionMode | null {
  if (state.phase !== "work" || state.runState === "idle" || state.startedAt == null) return null;
  const ymd = toYmd(state.startedAt);
  return computeMode(lastSessionOnDay(state.sessions, ymd), state.startedAt);
}

/** Sessions for a given local YYYY-MM-DD date string. */
export function sessionsOnDate(sessions: Session[], ymd: string): Session[] {
  return sessions.filter((s) => toYmd(s.startedAt) === ymd);
}

export function toYmd(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
