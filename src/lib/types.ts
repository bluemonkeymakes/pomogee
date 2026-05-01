export type SessionKind = "work" | "shortBreak" | "longBreak";

/** How a completed work session connects to the prior session of the day.
 * - `continuous`: back-to-back work, or first session of the day
 * - `break`: followed a (timed) short or long break
 * - `gap`: started after an untimed idle stretch
 */
export type SessionMode = "continuous" | "break" | "gap";

export interface Session {
  id: string;
  kind: SessionKind;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  durationSec: number; // intended duration
  completed: boolean; // ran to 0 or interrupted
  streakIndex: number; // 0-based position among today's completed work; -1 otherwise
  mode?: SessionMode; // set on completed work sessions only
}

export type Phase = "idle" | "work" | "shortBreak" | "longBreak";
export type RunState = "idle" | "running" | "paused";

export interface Settings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number; // every N work sessions
}

export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};
