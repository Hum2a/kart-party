import { mixer, type Mixer } from "./mixer";
import { midiHz } from "./sfx";
import {
  barEvents,
  barSeconds,
  themes,
  type MusicNote,
  type ThemeId,
} from "./music-themes";

/** How far ahead notes are scheduled, and how often the scheduler wakes. */
const lookaheadSeconds = 0.3;
const wakeMs = 60;

type Graph = NonNullable<ReturnType<Mixer["graph"]>>;

function playNote(
  g: Graph,
  out: AudioNode,
  noise: AudioBuffer,
  note: MusicNote,
  at: number,
  beat: number,
) {
  const length = Math.max(0.03, note.beats * beat);
  if (note.voice === "kick") {
    const osc = g.ctx.createOscillator(),
      env = g.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    env.gain.setValueAtTime(0.35, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(env);
    env.connect(out);
    osc.start(at);
    osc.stop(at + 0.2);
    return;
  }
  if (note.voice === "snare" || note.voice === "hat") {
    const source = g.ctx.createBufferSource(),
      filter = g.ctx.createBiquadFilter(),
      env = g.ctx.createGain();
    source.buffer = noise;
    filter.type = note.voice === "hat" ? "highpass" : "bandpass";
    filter.frequency.value = note.voice === "hat" ? 7000 : 1800;
    const peak = note.voice === "hat" ? 0.05 : 0.16;
    const decay = note.voice === "hat" ? 0.04 : 0.14;
    env.gain.setValueAtTime(peak, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    source.connect(filter);
    filter.connect(env);
    env.connect(out);
    source.start(at, Math.random() * 0.5);
    source.stop(at + decay + 0.02);
    return;
  }
  const osc = g.ctx.createOscillator(),
    filter = g.ctx.createBiquadFilter(),
    env = g.ctx.createGain();
  const shape = { lead: "square", bass: "triangle", arp: "square" } as const;
  const level = { lead: 0.07, bass: 0.2, arp: 0.025 } as const;
  osc.type = shape[note.voice];
  osc.frequency.setValueAtTime(midiHz(note.midi ?? 60), at);
  filter.type = "lowpass";
  filter.frequency.value =
    note.voice === "bass" ? 900 : note.voice === "arp" ? 2200 : 3200;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level[note.voice], at + 0.01);
  env.gain.setValueAtTime(level[note.voice], at + Math.max(0.01, length - 0.04));
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(filter);
  filter.connect(env);
  env.connect(out);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/**
 * Plays one theme at a time on the music bus, scheduling a little ahead of
 * the audio clock. `play` before audio is unlocked remembers the theme and
 * starts it on the first gesture.
 */
export function createMusicPlayer(target: Mixer = mixer()) {
  let wanted: ThemeId | null = null;
  let tempo = 1;
  let timer: ReturnType<typeof setInterval> | undefined;
  let out: GainNode | null = null;
  let bar = 0;
  let nextBarAt = 0;
  let playing: ThemeId | null = null;

  function schedule() {
    const g = target.graph();
    const noise = target.noise();
    if (!g || !noise || !out || !playing) return;
    const theme = themes[playing];
    // After a long suspension, start again from now instead of catching up.
    if (nextBarAt < g.ctx.currentTime - 0.1) nextBarAt = g.ctx.currentTime + 0.05;
    while (nextBarAt < g.ctx.currentTime + lookaheadSeconds) {
      const beat = barSeconds(theme, tempo) / 4;
      for (const note of barEvents(theme, bar))
        playNote(g, out, noise, note, nextBarAt + note.beat * beat, beat);
      nextBarAt += barSeconds(theme, tempo);
      bar++;
    }
  }

  function start() {
    const g = target.graph();
    if (!g || !wanted || playing === wanted) return;
    stopNow(0.25);
    out = g.ctx.createGain();
    out.gain.setValueAtTime(0.0001, g.ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, g.ctx.currentTime + 0.4);
    out.connect(g.music);
    playing = wanted;
    bar = 0;
    nextBarAt = g.ctx.currentTime + 0.1;
    schedule();
    timer = setInterval(schedule, wakeMs);
  }

  function stopNow(fadeSeconds: number) {
    clearInterval(timer);
    timer = undefined;
    const g = target.graph();
    if (out && g) {
      const old = out;
      old.gain.cancelScheduledValues(g.ctx.currentTime);
      old.gain.setTargetAtTime(0, g.ctx.currentTime, Math.max(0.01, fadeSeconds / 3));
      setTimeout(() => old.disconnect(), fadeSeconds * 1000 + 200);
    }
    out = null;
    playing = null;
  }

  const unsubscribe = target.subscribe((_prefs, ready) => {
    if (ready && wanted && !playing) start();
  });

  return {
    get playing() {
      return playing;
    },
    play(theme: ThemeId) {
      wanted = theme;
      tempo = 1;
      start();
    },
    /** Speeds the current theme up, for the final lap. */
    setTempo(scale: number) {
      tempo = Math.max(0.5, Math.min(1.5, scale));
    },
    stop(fadeSeconds = 0.6) {
      wanted = null;
      stopNow(fadeSeconds);
    },
    dispose() {
      wanted = null;
      stopNow(0.2);
      unsubscribe();
    },
  };
}
export type MusicPlayer = ReturnType<typeof createMusicPlayer>;

let shared: MusicPlayer | undefined;
/** The page's one music player, so moving between screens never doubles the soundtrack. */
export function music(): MusicPlayer {
  shared ??= createMusicPlayer();
  return shared;
}
