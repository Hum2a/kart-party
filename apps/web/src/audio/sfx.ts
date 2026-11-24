import { mixer, type Mixer } from "./mixer";

/**
 * Every sound effect in the game, synthesised. A recipe is a handful of
 * enveloped oscillators and noise bursts on the shared effects bus; nothing
 * is loaded from the network.
 */
export type SfxName =
  | "count"
  | "go"
  | "launch-good"
  | "launch-perfect"
  | "lap"
  | "final-lap"
  | "finish"
  | "place-up"
  | "slipstream"
  | "drift-1"
  | "drift-2"
  | "drift-3"
  | "boost-1"
  | "boost-2"
  | "boost-3"
  | "item-box"
  | "item-turbo"
  | "item-shield"
  | "item-oil"
  | "item-tennis"
  | "item-bomb"
  | "item-homing"
  | "item-treat"
  | "hit"
  | "hit-landed"
  | "bump"
  | "land"
  | "podium"
  | "ui-tap"
  | "ui-confirm";

export const sfxNames: readonly SfxName[] = [
  "count",
  "go",
  "launch-good",
  "launch-perfect",
  "lap",
  "final-lap",
  "finish",
  "place-up",
  "slipstream",
  "drift-1",
  "drift-2",
  "drift-3",
  "boost-1",
  "boost-2",
  "boost-3",
  "item-box",
  "item-turbo",
  "item-shield",
  "item-oil",
  "item-tennis",
  "item-bomb",
  "item-homing",
  "item-treat",
  "hit",
  "hit-landed",
  "bump",
  "land",
  "podium",
  "ui-tap",
  "ui-confirm",
];

type Graph = NonNullable<ReturnType<Mixer["graph"]>>;
type ToneOptions = {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** Optional low-pass cut-off in Hz. */
  lowpass?: number;
};

export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export function tone(g: Graph, out: AudioNode, o: ToneOptions) {
  const start = g.ctx.currentTime + (o.at ?? 0);
  const osc = g.ctx.createOscillator();
  const env = g.ctx.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.to)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), start + o.dur);
  const peak = o.gain ?? 0.12;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + (o.attack ?? 0.008));
  env.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const filter = g.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = o.lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(env);
  env.connect(out);
  osc.start(start);
  osc.stop(start + o.dur + 0.05);
}

type NoiseOptions = {
  at?: number;
  dur: number;
  gain?: number;
  /** Band-pass centre, gliding to `to`. */
  freq: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
};

export function noiseBurst(
  g: Graph,
  out: AudioNode,
  buffer: AudioBuffer,
  o: NoiseOptions,
) {
  const start = g.ctx.currentTime + (o.at ?? 0);
  const source = g.ctx.createBufferSource();
  source.buffer = buffer;
  const filter = g.ctx.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, start);
  if (o.to)
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), start + o.dur);
  const env = g.ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, start + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  source.connect(filter);
  filter.connect(env);
  env.connect(out);
  source.start(start);
  source.stop(start + o.dur + 0.05);
}

/** Notes as [midi, start seconds, duration seconds]. */
type Phrase = readonly (readonly [number, number, number])[];
const phrase = (
  g: Graph,
  out: AudioNode,
  notes: Phrase,
  type: OscillatorType,
  gain: number,
) => {
  for (const [midi, at, dur] of notes)
    tone(g, out, { type, freq: midiHz(midi), at, dur, gain });
};

const recipes: Record<SfxName, (g: Graph, out: AudioNode, noise: AudioBuffer) => void> =
  {
    count: (g, out) => tone(g, out, { freq: midiHz(69), dur: 0.18, gain: 0.14 }),
    go: (g, out) => {
      tone(g, out, { freq: midiHz(81), dur: 0.5, gain: 0.14 });
      tone(g, out, { type: "triangle", freq: midiHz(69), dur: 0.5, gain: 0.12 });
    },
    "launch-good": (g, out, n) => {
      noiseBurst(g, out, n, { freq: 600, to: 2500, dur: 0.35, gain: 0.18 });
      tone(g, out, { freq: midiHz(76), to: midiHz(83), dur: 0.25, gain: 0.08 });
    },
    "launch-perfect": (g, out, n) => {
      noiseBurst(g, out, n, { freq: 500, to: 4000, dur: 0.5, gain: 0.22 });
      phrase(
        g,
        out,
        [
          [76, 0, 0.08],
          [80, 0.07, 0.08],
          [83, 0.14, 0.08],
          [88, 0.21, 0.3],
        ],
        "square",
        0.09,
      );
    },
    lap: (g, out) =>
      phrase(
        g,
        out,
        [
          [76, 0, 0.1],
          [81, 0.09, 0.22],
        ],
        "square",
        0.11,
      ),
    "final-lap": (g, out) =>
      phrase(
        g,
        out,
        [
          [72, 0, 0.1],
          [76, 0.1, 0.1],
          [79, 0.2, 0.1],
          [84, 0.3, 0.12],
          [79, 0.42, 0.1],
          [84, 0.52, 0.4],
        ],
        "square",
        0.11,
      ),
    finish: (g, out) => {
      phrase(
        g,
        out,
        [
          [72, 0, 0.12],
          [76, 0.12, 0.12],
          [79, 0.24, 0.12],
          [84, 0.36, 0.2],
          [83, 0.6, 0.12],
          [84, 0.72, 0.7],
        ],
        "square",
        0.1,
      );
      phrase(
        g,
        out,
        [
          [48, 0, 0.36],
          [55, 0.36, 0.36],
          [48, 0.72, 0.7],
        ],
        "triangle",
        0.14,
      );
    },
    "place-up": (g, out) =>
      tone(g, out, { freq: midiHz(79), to: midiHz(86), dur: 0.16, gain: 0.08 }),
    slipstream: (g, out, n) =>
      noiseBurst(g, out, n, { freq: 300, to: 1800, dur: 0.6, gain: 0.12, q: 2 }),
    "drift-1": (g, out) =>
      tone(g, out, { type: "triangle", freq: midiHz(84), dur: 0.08, gain: 0.08 }),
    "drift-2": (g, out) =>
      phrase(
        g,
        out,
        [
          [84, 0, 0.06],
          [88, 0.05, 0.08],
        ],
        "triangle",
        0.09,
      ),
    "drift-3": (g, out) =>
      phrase(
        g,
        out,
        [
          [84, 0, 0.05],
          [88, 0.04, 0.05],
          [91, 0.08, 0.1],
        ],
        "triangle",
        0.1,
      ),
    "boost-1": (g, out, n) =>
      noiseBurst(g, out, n, { freq: 400, to: 1600, dur: 0.4, gain: 0.16 }),
    "boost-2": (g, out, n) => {
      noiseBurst(g, out, n, { freq: 400, to: 2400, dur: 0.55, gain: 0.2 });
      tone(g, out, {
        type: "sawtooth",
        freq: 110,
        to: 220,
        dur: 0.4,
        gain: 0.05,
        lowpass: 900,
      });
    },
    "boost-3": (g, out, n) => {
      noiseBurst(g, out, n, { freq: 300, to: 3500, dur: 0.8, gain: 0.24 });
      tone(g, out, {
        type: "sawtooth",
        freq: 110,
        to: 330,
        dur: 0.6,
        gain: 0.07,
        lowpass: 1400,
      });
    },
    "item-box": (g, out) =>
      phrase(
        g,
        out,
        [
          [79, 0, 0.05],
          [83, 0.05, 0.05],
          [86, 0.1, 0.05],
          [91, 0.15, 0.12],
        ],
        "square",
        0.08,
      ),
    "item-turbo": (g, out, n) => recipes["boost-2"](g, out, n),
    "item-shield": (g, out) => {
      for (let i = 0; i < 6; i++)
        tone(g, out, {
          type: "sine",
          freq: midiHz(84 + (i % 3) * 4),
          at: i * 0.05,
          dur: 0.25,
          gain: 0.06,
        });
    },
    "item-oil": (g, out, n) => {
      noiseBurst(g, out, n, {
        freq: 250,
        to: 120,
        dur: 0.3,
        gain: 0.25,
        type: "lowpass",
      });
      tone(g, out, { type: "sine", freq: 180, to: 70, dur: 0.25, gain: 0.12 });
    },
    "item-tennis": (g, out) => {
      tone(g, out, { type: "square", freq: 520, to: 260, dur: 0.07, gain: 0.12 });
      tone(g, out, { type: "triangle", freq: 900, at: 0.02, dur: 0.05, gain: 0.06 });
    },
    "item-bomb": (g, out) => {
      tone(g, out, { type: "sine", freq: 300, to: 200, dur: 0.12, gain: 0.1 });
      tone(g, out, {
        type: "sine",
        freq: 300,
        to: 200,
        at: 0.18,
        dur: 0.12,
        gain: 0.1,
      });
    },
    "item-homing": (g, out) =>
      tone(g, out, {
        type: "sawtooth",
        freq: 220,
        to: 1760,
        dur: 0.35,
        gain: 0.07,
        lowpass: 3000,
      }),
    "item-treat": (g, out) =>
      phrase(
        g,
        out,
        [
          [88, 0, 0.06],
          [91, 0.06, 0.06],
          [96, 0.12, 0.14],
        ],
        "triangle",
        0.1,
      ),
    hit: (g, out, n) => {
      noiseBurst(g, out, n, {
        freq: 900,
        to: 150,
        dur: 0.45,
        gain: 0.3,
        type: "lowpass",
      });
      tone(g, out, { type: "square", freq: 330, to: 90, dur: 0.4, gain: 0.08 });
    },
    "hit-landed": (g, out) =>
      phrase(
        g,
        out,
        [
          [79, 0, 0.07],
          [91, 0.07, 0.15],
        ],
        "square",
        0.08,
      ),
    bump: (g, out, n) => {
      noiseBurst(g, out, n, {
        freq: 220,
        to: 80,
        dur: 0.15,
        gain: 0.22,
        type: "lowpass",
      });
      tone(g, out, { type: "sine", freq: 110, to: 55, dur: 0.12, gain: 0.12 });
    },
    land: (g, out, n) =>
      noiseBurst(g, out, n, {
        freq: 180,
        to: 90,
        dur: 0.18,
        gain: 0.18,
        type: "lowpass",
      }),
    podium: (g, out) => {
      phrase(
        g,
        out,
        [
          [67, 0, 0.15],
          [72, 0.15, 0.15],
          [76, 0.3, 0.15],
          [79, 0.45, 0.3],
          [76, 0.75, 0.15],
          [79, 0.9, 0.15],
          [84, 1.05, 0.9],
        ],
        "square",
        0.1,
      );
      phrase(
        g,
        out,
        [
          [48, 0, 0.45],
          [53, 0.45, 0.45],
          [55, 0.9, 0.3],
          [48, 1.2, 0.9],
        ],
        "triangle",
        0.15,
      );
    },
    "ui-tap": (g, out) =>
      tone(g, out, { type: "triangle", freq: midiHz(84), dur: 0.05, gain: 0.05 }),
    "ui-confirm": (g, out) =>
      phrase(
        g,
        out,
        [
          [79, 0, 0.06],
          [86, 0.06, 0.1],
        ],
        "triangle",
        0.07,
      ),
  };

/** Effects closer than this are merged, so a burst of cues never stacks into noise. */
const minGapMs: Partial<Record<SfxName, number>> = {
  bump: 250,
  "drift-1": 120,
  count: 300,
};
/** When each effect last played, per mixer. */
const lastPlayed = new WeakMap<Mixer, Map<SfxName, number>>();

/** Plays one effect if audio is unlocked; silently does nothing otherwise. */
export function playSfx(
  name: SfxName,
  target: Mixer = mixer(),
  now = performance.now(),
) {
  const g = target.graph();
  const noise = target.noise();
  if (!g || !noise || target.prefs.muted) return false;
  const gap = minGapMs[name];
  const played = lastPlayed.get(target) ?? new Map<SfxName, number>();
  lastPlayed.set(target, played);
  if (gap && now - (played.get(name) ?? -Infinity) < gap) return false;
  played.set(name, now);
  try {
    recipes[name](g, g.sfx, noise);
    return true;
  } catch {
    return false;
  }
}
