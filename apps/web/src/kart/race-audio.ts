import { mixer, type Mixer } from "../audio/mixer";
import { playSfx, type SfxName } from "../audio/sfx";

/**
 * The racer's own engine note plus race cues, on the shared effects bus. The
 * engine is two detuned oscillators through a low-pass filter whose pitch and
 * brightness follow speed; boosts push it higher. Nothing plays until audio is
 * unlocked by a gesture, and the global mute silences it.
 */
export type RaceSound =
  "launch" | "lap" | "final-lap" | "finish" | "place-up" | "slipstream";

const cueSfx: Record<RaceSound, SfxName> = {
  launch: "launch-good",
  lap: "lap",
  "final-lap": "final-lap",
  finish: "finish",
  "place-up": "place-up",
  slipstream: "slipstream",
};

export function createRaceAudio(target: Mixer = mixer()) {
  let engine: {
    low: OscillatorNode;
    high: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  function ensureEngine() {
    const g = target.graph();
    if (!g || engine) return engine;
    const low = g.ctx.createOscillator(),
      high = g.ctx.createOscillator(),
      filter = g.ctx.createBiquadFilter(),
      gain = g.ctx.createGain();
    low.type = "sawtooth";
    high.type = "square";
    low.frequency.value = 55;
    high.frequency.value = 55.6;
    filter.type = "lowpass";
    filter.frequency.value = 500;
    gain.gain.value = 0;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain);
    gain.connect(g.sfx);
    low.start();
    high.start();
    engine = { low, high, filter, gain };
    return engine;
  }

  return {
    get enabled() {
      return target.ready && !target.prefs.muted;
    },
    /** Unmutes and starts audio. Call from a tap. False when this browser has no Web Audio. */
    enable(): boolean {
      const ok = target.unlock();
      if (ok && target.prefs.muted) target.set({ muted: false });
      return ok;
    },
    disable() {
      target.set({ muted: true });
    },
    /** `ratio` is speed over top speed; `running` is false when the kart can't drive. */
    engine(ratio: number, running: boolean, boosting = false) {
      const e = ensureEngine();
      const g = target.graph();
      if (!e || !g) return;
      const r = Number.isFinite(ratio)
        ? Math.max(0, Math.min(1.4, Math.abs(ratio)))
        : 0;
      const at = g.ctx.currentTime;
      const pitch = 50 + 140 * r + (boosting ? 40 : 0);
      e.low.frequency.setTargetAtTime(pitch, at, 0.08);
      e.high.frequency.setTargetAtTime(pitch * 1.012, at, 0.08);
      e.filter.frequency.setTargetAtTime(
        400 + 1600 * r + (boosting ? 800 : 0),
        at,
        0.1,
      );
      e.gain.gain.setTargetAtTime(running ? 0.05 + 0.05 * r : 0, at, 0.12);
    },
    cue(sound: RaceSound | SfxName) {
      playSfx(
        sound in cueSfx ? cueSfx[sound as RaceSound] : (sound as SfxName),
        target,
      );
    },
    dispose() {
      if (!engine) return;
      const old = engine;
      engine = null;
      const g = target.graph();
      if (g) old.gain.gain.setTargetAtTime(0, g.ctx.currentTime, 0.05);
      setTimeout(() => {
        try {
          old.low.stop();
          old.high.stop();
          old.gain.disconnect();
        } catch {
          // Already stopped.
        }
      }, 300);
    },
  };
}
export type RaceAudio = ReturnType<typeof createRaceAudio>;
