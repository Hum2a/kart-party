import type { KartLaps, KartTrackId } from "@kart-party/game";

/** A personal best for one course and lap count, kept in this browser only. */
export type BestRecord = { timeMs: number; at: number };
type Key = { trackId: KartTrackId; laps: KartLaps };

const storageKey = "kart-party:bests";
type Store = Record<string, BestRecord>;

const keyOf = ({ trackId, laps }: Key) => `${trackId}:${laps}`;

function load(storage: Storage | undefined): Store {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const store: Store = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const record = value as Partial<BestRecord> | null;
      if (
        record &&
        typeof record.timeMs === "number" &&
        Number.isFinite(record.timeMs) &&
        record.timeMs > 0 &&
        typeof record.at === "number"
      )
        store[key] = { timeMs: record.timeMs, at: record.at };
    }
    return store;
  } catch {
    return {};
  }
}

const browserStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function readBest(key: Key, storage = browserStorage()): BestRecord | undefined {
  return load(storage)[keyOf(key)];
}

/** Saves a finished time when it beats the stored best. */
export function recordBest(
  key: Key,
  timeMs: number,
  at: number,
  storage = browserStorage(),
): { best: BestRecord; improved: boolean } {
  const store = load(storage);
  const previous = store[keyOf(key)];
  if (previous && previous.timeMs <= timeMs) return { best: previous, improved: false };
  const best = { timeMs, at };
  store[keyOf(key)] = best;
  try {
    storage?.setItem(storageKey, JSON.stringify(store));
  } catch {
    // A full or blocked store only means the best is not remembered.
  }
  return { best, improved: true };
}

export function formatRaceTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`
    : `${seconds.toFixed(2)}s`;
}
