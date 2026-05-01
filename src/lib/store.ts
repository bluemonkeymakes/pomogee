import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, type Phase, type RunState, type Session, type SessionKind, type SessionMode, type Settings } from "./types";

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
  // history
  sessions: Session[];
  // actions
  startWork: () => void;
  startBreak: (kind: "shortBreak" | "longBreak") => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
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

      tick: () => {
        const { runState, endsAt } = get();
        if (runState !== "running" || endsAt == null) return;
        const remaining = Math.max(0, (endsAt - Date.now()) / 1000);
        set({ remainingSec: remaining });
        if (remaining <= 0) get().finishCurrent();
      },

      finishCurrent: () => {
        const { phase, startedAt, durationSec, settings } = get();
        if (phase === "idle" || startedAt == null) return;
        const now = Date.now();
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
        void settings;
      },

      updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

      reset: () =>
        set({
          settings: DEFAULT_SETTINGS,
          phase: "idle",
          runState: "idle",
          endsAt: null,
          remainingSec: 0,
          durationSec: 0,
          startedAt: null,
          sessions: [],
        }),
    }),
    {
      name: "pomoge:timer",
      partialize: (s) => ({ settings: s.settings, sessions: s.sessions }),
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
