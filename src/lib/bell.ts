/**
 * Synthesized mindfulness bells. No audio assets: each tone is a set of sine
 * partials with their own decay, summed through one master gain (additive
 * synthesis). Adding a tone means adding one entry to `BELL_TONES`.
 */

export type BellTone = "focus" | "relax";

interface BellPartial {
  /** Frequency as a multiple of the tone's base frequency. */
  ratio: number;
  /** Constant offset in Hz. A few Hz against a neighbour gives a slow beat. */
  detuneHz?: number;
  /** Relative loudness. */
  gain: number;
  /** Ring time as a fraction of the tone's `seconds`. Upper partials die first. */
  decay: number;
}

interface ToneDef {
  label: string;
  /** Base frequency in Hz. */
  freq: number;
  /** Ring time of the longest partial. */
  seconds: number;
  /** Strike softness: time to reach peak. */
  attack: number;
  partials: ReadonlyArray<BellPartial>;
}

export const BELL_TONES: Record<BellTone, ToneDef> = {
  // Bright struck bell (Risset's additive bell recipe). Clear and short, so it
  // marks a moment without lingering over the next thought.
  focus: {
    label: "Focus",
    freq: 440,
    seconds: 5,
    attack: 0.004,
    partials: [
      { ratio: 0.56, gain: 1.0, decay: 1.0 },
      { ratio: 0.56, detuneHz: 1, gain: 0.67, decay: 0.9 },
      { ratio: 0.92, gain: 1.0, decay: 0.65 },
      { ratio: 0.92, detuneHz: 1.7, gain: 1.8, decay: 0.55 },
      { ratio: 1.19, gain: 2.67, decay: 0.325 },
      { ratio: 1.7, gain: 1.67, decay: 0.35 },
      { ratio: 2.0, gain: 1.46, decay: 0.25 },
      { ratio: 2.74, gain: 1.33, decay: 0.2 },
      { ratio: 3.0, gain: 1.33, decay: 0.15 },
      { ratio: 3.76, gain: 1.0, decay: 0.1 },
      { ratio: 4.07, gain: 1.33, decay: 0.075 },
    ],
  },
  // Low singing bowl: few partials, a soft strike and a long tail with a slow
  // beat between detuned pairs.
  relax: {
    label: "Relax",
    freq: 196,
    seconds: 11,
    attack: 0.03,
    partials: [
      { ratio: 1.0, gain: 1.0, decay: 1.0 },
      { ratio: 1.0, detuneHz: 0.7, gain: 0.8, decay: 1.0 },
      { ratio: 2.71, gain: 0.5, decay: 0.6 },
      { ratio: 2.71, detuneHz: 1.3, gain: 0.35, decay: 0.55 },
      { ratio: 5.04, gain: 0.18, decay: 0.3 },
      { ratio: 7.9, gain: 0.06, decay: 0.15 },
    ],
  },
};

export const BELL_TONE_IDS = Object.keys(BELL_TONES) as BellTone[];

/** Peak level of the summed partials at full volume, leaving headroom. */
const HEADROOM = 0.6;
const SILENCE = 0.0001;

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Browsers keep audio suspended until the user interacts with the page. Call
 * this from any click or key press so a later bell (one that rings on a timer,
 * with no gesture behind it) is allowed to sound. */
export function unlockAudio(): void {
  try {
    const c = getContext();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
  } catch {
    // Sound is never essential.
  }
}

/** Schedule one bell on the given context. Returns the time it finishes. */
export function scheduleBell(c: BaseAudioContext, tone: BellTone, volume: number, at: number): number {
  const def = BELL_TONES[tone];
  const v = Math.max(0, Math.min(1, volume));
  const total = def.partials.reduce((sum, p) => sum + p.gain, 0);
  const master = c.createGain();
  // Squared so the slider tracks perceived loudness, not amplitude.
  master.gain.value = (v * v * HEADROOM) / total;
  master.connect(c.destination);

  const end = at + def.seconds;
  let last: OscillatorNode | null = null;
  for (const p of def.partials) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = def.freq * p.ratio + (p.detuneHz ?? 0);
    const env = c.createGain();
    const stop = at + def.seconds * p.decay;
    env.gain.setValueAtTime(SILENCE, at);
    env.gain.exponentialRampToValueAtTime(p.gain, at + def.attack);
    env.gain.exponentialRampToValueAtTime(SILENCE, stop);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(stop + 0.05);
    if (p.decay >= 1) last = osc;
  }
  if (last) last.onended = () => master.disconnect();
  return end;
}

/** Ring a bell now. Silent no-op when muted or when audio is unavailable. */
export function playBell(tone: BellTone, volume: number): void {
  if (volume <= 0) return;
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    scheduleBell(c, tone, volume, c.currentTime + 0.02);
  } catch (err) {
    // Never let sound interrupt the timer.
    console.warn("playBell failed", err);
  }
}
