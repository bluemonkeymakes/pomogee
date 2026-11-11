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

const SAMPLE_RATE = 44100;

/** 16-bit mono PCM WAV from float samples, scaled by `gain`. */
function encodeWav(samples: Float32Array, gain: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (offset: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(offset + i, t.charCodeAt(i));
  };
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * gain)) * 32767, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/**
 * Bells are rendered once, offline, and played as WAV clips through an
 * <audio> element. They are deliberately NOT played through a live
 * AudioContext: in the desktop webview (WebKitGTK 2.52) a live context goes
 * permanently silent, while still reporting "running", unless sound starts
 * within a few hundredths of a second of the context being created. A bell
 * that rings minutes after the last interaction can never meet that. Offline
 * rendering and media-element playback are both unaffected.
 */
const rendered = new Map<BellTone, Promise<Float32Array>>();

function samplesFor(tone: BellTone): Promise<Float32Array> {
  let samples = rendered.get(tone);
  if (!samples) {
    samples = (async () => {
      const seconds = BELL_TONES[tone].seconds + 0.25;
      const c = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
      scheduleBell(c, tone, 1, 0);
      return (await c.startRendering()).getChannelData(0);
    })();
    // A failed render must not poison the cache.
    samples.catch(() => rendered.delete(tone));
    rendered.set(tone, samples);
  }
  return samples;
}

/**
 * Volume is baked into the clip's samples, never set on the element. On
 * Linux the webview applies `audio.volume` as the system's per-stream volume,
 * which the sound server saves for the whole "Music" stream role and restores
 * on the next stream: setting it would quietly change the user's saved system
 * volume, and a bell at volume 1 would come out at whatever was saved last.
 * One clip is kept per tone, for the volume last used.
 */
const clips = new Map<BellTone, { volume: number; url: string }>();

async function clipFor(tone: BellTone, volume: number): Promise<string> {
  const cached = clips.get(tone);
  if (cached && cached.volume === volume) return cached.url;
  const samples = await samplesFor(tone);
  // Squared so the slider tracks perceived loudness, not amplitude.
  const url = URL.createObjectURL(encodeWav(samples, volume * volume));
  // A bell may still be sounding from the old clip; let it finish first.
  if (cached) window.setTimeout(() => URL.revokeObjectURL(cached.url), 30_000);
  clips.set(tone, { volume, url });
  return url;
}

/** Elements that are still sounding. An <audio> element with no reference
 * left can be garbage-collected mid-playback, which cuts the bell's tail off
 * (seen in WebKitGTK on the 11 second Relax tone). Hold them until they end. */
const sounding = new Set<HTMLAudioElement>();

/** Render every tone ahead of time so the first bell rings without delay.
 * Called on the first click or key press; safe to call repeatedly. */
export function unlockAudio(): void {
  if (typeof window === "undefined" || typeof OfflineAudioContext === "undefined") return;
  for (const tone of BELL_TONE_IDS) void samplesFor(tone).catch(() => {});
}

/** Ring a bell now. Silent no-op when muted or when audio is unavailable. */
export function playBell(tone: BellTone, volume: number): void {
  if (volume <= 0 || typeof window === "undefined" || typeof OfflineAudioContext === "undefined") return;
  clipFor(tone, Math.min(1, volume))
    .then((url) => {
      const audio = new Audio(url);
      const release = () => sounding.delete(audio);
      audio.addEventListener("ended", release);
      audio.addEventListener("error", release);
      sounding.add(audio);
      return audio.play().catch((err) => {
        release();
        throw err;
      });
    })
    // Never let sound interrupt the timer.
    .catch((err) => console.warn("playBell failed", err));
}
