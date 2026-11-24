/**
 * The one audio graph for the whole game: master → music and effects buses.
 * Every sound in Kart Party is synthesised here with Web Audio; no audio files
 * ship. Browsers only start audio from a gesture, so the context is created on
 * the first tap or key press and suspended while the tab is hidden.
 */
export type AudioPrefs = { master: number; music: number; sfx: number; muted: boolean };
export const defaultAudioPrefs: AudioPrefs = {
  master: 0.8,
  music: 0.45,
  sfx: 0.8,
  muted: false,
};
const prefsKey = "kart-party:audio";

const clamp01 = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;

export function readAudioPrefs(
  storage: Storage | undefined = safeStorage(),
): AudioPrefs {
  try {
    const raw = JSON.parse(
      storage?.getItem(prefsKey) ?? "null",
    ) as Partial<AudioPrefs> | null;
    if (!raw || typeof raw !== "object") return { ...defaultAudioPrefs };
    return {
      master: clamp01(raw.master, defaultAudioPrefs.master),
      music: clamp01(raw.music, defaultAudioPrefs.music),
      sfx: clamp01(raw.sfx, defaultAudioPrefs.sfx),
      muted: raw.muted === true,
    };
  } catch {
    return { ...defaultAudioPrefs };
  }
}

export function writeAudioPrefs(
  prefs: AudioPrefs,
  storage: Storage | undefined = safeStorage(),
) {
  try {
    storage?.setItem(prefsKey, JSON.stringify(prefs));
  } catch {
    // Unavailable storage only means the next visit uses the defaults.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The parts of AudioContext the game uses, so tests can supply a fake. */
export type AudioCtx = Pick<
  AudioContext,
  | "currentTime"
  | "destination"
  | "state"
  | "sampleRate"
  | "resume"
  | "suspend"
  | "createOscillator"
  | "createGain"
  | "createBiquadFilter"
  | "createBuffer"
  | "createBufferSource"
>;

type Listener = (prefs: AudioPrefs, ready: boolean) => void;

export function createMixer(
  factory: () => AudioCtx | null = () => {
    const Factory = globalThis.AudioContext;
    return Factory ? (new Factory() as unknown as AudioCtx) : null;
  },
  storage?: Storage,
) {
  let prefs = readAudioPrefs(storage ?? safeStorage());
  let ctx: AudioCtx | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfx: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const listeners = new Set<Listener>();

  const apply = () => {
    if (!ctx || !master || !music || !sfx) return;
    const at = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.master, at, 0.03);
    music.gain.setTargetAtTime(prefs.music, at, 0.03);
    sfx.gain.setTargetAtTime(prefs.sfx, at, 0.03);
  };
  const notify = () => {
    for (const listener of listeners) listener(prefs, Boolean(ctx));
  };

  return {
    get prefs() {
      return prefs;
    },
    get ready() {
      return Boolean(ctx);
    },
    /** Starts the audio graph. Call only from a user gesture. False without Web Audio. */
    unlock(): boolean {
      try {
        if (!ctx) {
          ctx = factory();
          if (!ctx) return false;
          master = ctx.createGain();
          music = ctx.createGain();
          sfx = ctx.createGain();
          master.gain.value = 0;
          music.connect(master);
          sfx.connect(master);
          master.connect(ctx.destination);
          apply();
          notify();
        }
        if (ctx.state === "suspended") void ctx.resume().catch(() => {});
        return true;
      } catch {
        ctx = null;
        return false;
      }
    },
    /** The live graph, or null until unlocked. */
    graph() {
      return ctx && music && sfx ? { ctx, music, sfx } : null;
    },
    /** A second of white noise, shared by every percussion and whoosh. */
    noise(): AudioBuffer | null {
      if (!ctx) return null;
      if (!noise) {
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noise.getChannelData(0);
        // A fixed seed keeps every hit sounding the same.
        let seed = 1;
        for (let i = 0; i < data.length; i++) {
          seed = (seed * 16807) % 2147483647;
          data[i] = (seed / 2147483647) * 2 - 1;
        }
      }
      return noise;
    },
    set(next: Partial<AudioPrefs>) {
      prefs = {
        master: clamp01(next.master ?? prefs.master, prefs.master),
        music: clamp01(next.music ?? prefs.music, prefs.music),
        sfx: clamp01(next.sfx ?? prefs.sfx, prefs.sfx),
        muted: next.muted ?? prefs.muted,
      };
      writeAudioPrefs(prefs, storage ?? safeStorage());
      apply();
      notify();
    },
    /** Pauses everything while the page is hidden; resumes when it returns. */
    visibility(hidden: boolean) {
      if (!ctx) return;
      if (hidden && ctx.state === "running") void ctx.suspend().catch(() => {});
      if (!hidden && ctx.state === "suspended") void ctx.resume().catch(() => {});
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type Mixer = ReturnType<typeof createMixer>;

let shared: Mixer | undefined;
/** The page's mixer. Created lazily; it builds no audio graph until unlocked. */
export function mixer(): Mixer {
  shared ??= createMixer();
  return shared;
}

/**
 * Unlocks audio on the first gesture and pauses it while the tab is hidden.
 * Call once at start-up. Returns a cleanup for tests.
 */
export function installAudioLifecycle(target: Mixer = mixer()) {
  const unlock = () => {
    if (target.unlock()) {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  const visibility = () => target.visibility(document.hidden);
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    document.removeEventListener("visibilitychange", visibility);
  };
}
