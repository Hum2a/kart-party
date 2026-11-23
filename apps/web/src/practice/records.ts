import {
  kartGhostSchema,
  lapDurations,
  type KartGhost,
  type KartLaps,
  type KartSpeedClass,
  type KartTrackId,
} from "@kart-party/game";

/**
 * Personal bests for one course, lap count and engine class, kept in this
 * browser only. The best single lap is tracked separately from the best race,
 * so a fast lap in a slow race still counts.
 */
export type BestRecord = { timeMs: number; at: number; bestLapMs?: number };
export type RecordKey = {
  trackId: KartTrackId;
  laps: KartLaps;
  speedClass?: KartSpeedClass;
};

const storageKey = "kart-party:bests";
type Store = Record<string, BestRecord>;

/** 100cc keeps the original key, so bests saved before classes still count. */
const keyOf = ({ trackId, laps, speedClass }: RecordKey) =>
  speedClass && speedClass !== "100"
    ? `${trackId}:${laps}:${speedClass}`
    : `${trackId}:${laps}`;

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function load(storage: Storage | undefined): Store {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const store: Store = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const record = value as Partial<BestRecord> | null;
      if (record && positive(record.timeMs) && typeof record.at === "number")
        store[key] = {
          timeMs: record.timeMs,
          at: record.at,
          ...(positive(record.bestLapMs) ? { bestLapMs: record.bestLapMs } : {}),
        };
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

function save(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // A full or blocked store only means the record is not remembered.
  }
}

export function readBest(
  key: RecordKey,
  storage = browserStorage(),
): BestRecord | undefined {
  return load(storage)[keyOf(key)];
}

/** Saves a finished time and its fastest lap where they beat the stored bests. */
export function recordBest(
  key: RecordKey,
  timeMs: number,
  at: number,
  storage = browserStorage(),
  lapsMs: readonly number[] = [],
): { best: BestRecord; improved: boolean; lapImproved: boolean } {
  const store = load(storage);
  const previous = store[keyOf(key)];
  const fastestLap = lapsMs.length ? Math.min(...lapDurations(lapsMs)) : undefined;
  const improved = !previous || timeMs < previous.timeMs;
  const lapImproved =
    fastestLap !== undefined &&
    (previous?.bestLapMs === undefined || fastestLap < previous.bestLapMs);
  if (!improved && !lapImproved) return { best: previous!, improved, lapImproved };
  const bestLapMs = lapImproved ? fastestLap : previous?.bestLapMs;
  const best: BestRecord = {
    timeMs: improved ? timeMs : previous!.timeMs,
    at: improved ? at : previous!.at,
    ...(bestLapMs !== undefined ? { bestLapMs } : {}),
  };
  store[keyOf(key)] = best;
  save(storage, storageKey, JSON.stringify(store));
  return { best, improved, lapImproved };
}

const ghostKey = (key: RecordKey) => `kart-party:ghost:${keyOf(key)}`;

/** The ghost of the best run on this course, lap count and class, if one was saved. */
export function readGhost(
  key: RecordKey,
  storage = browserStorage(),
): KartGhost | undefined {
  try {
    const raw = storage?.getItem(ghostKey(key));
    if (!raw) return undefined;
    const parsed = kartGhostSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function saveGhost(ghost: KartGhost, storage = browserStorage()) {
  save(
    storage,
    ghostKey({
      trackId: ghost.trackId,
      laps: ghost.laps as KartLaps,
      speedClass: ghost.speedClass,
    }),
    JSON.stringify(ghost),
  );
}

export function formatRaceTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`
    : `${seconds.toFixed(2)}s`;
}

/** A signed gap such as "+0.42" or "−1.10", for splits against a ghost. */
export function formatGap(ms: number): string {
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "±";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}`;
}
