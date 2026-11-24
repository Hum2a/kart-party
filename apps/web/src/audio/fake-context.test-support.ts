import { vi } from "vitest";
import type { AudioCtx } from "./mixer";

/** A recording stand-in for AudioContext: enough of the graph API for the game's audio. */
export function fakeAudioContext() {
  const param = (value = 0) => ({
    value,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const oscillators: {
    type: string;
    frequency: ReturnType<typeof param>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const sources: { start: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    currentTime: 1,
    sampleRate: 8_000,
    destination: {},
    state: "suspended" as AudioContextState,
    resume: vi.fn(() => {
      context.state = "running";
      return Promise.resolve();
    }),
    suspend: vi.fn(() => {
      context.state = "suspended";
      return Promise.resolve();
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        ...node(),
        type: "",
        frequency: param(440),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({ ...node(), gain: param(1) })),
    createBiquadFilter: vi.fn(() => ({
      ...node(),
      type: "",
      frequency: param(),
      Q: param(1),
    })),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }),
    createBufferSource: vi.fn(() => {
      const source = { ...node(), buffer: null, start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    }),
  };
  return {
    context: context as unknown as AudioCtx & typeof context,
    oscillators,
    sources,
  };
}

/** In-memory storage for audio preferences. */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}
