import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  grandPrixUnlocks,
  kartUnlocks,
  paintUnlock,
  styleUnlock,
  type DriverStyle,
  type KartPaint,
  type KartUnlockId,
} from "@kart-party/game";

/**
 * Paints and drivers this device has earned from Grand Prix results. Kept in
 * local storage like the settings: there are no accounts, so an unlock lives
 * on the phone or computer that raced for it.
 */
const storageKey = "kart-party-unlocks";
const known = new Set<string>(kartUnlocks.map((u) => u.id));
const empty: ReadonlySet<KartUnlockId> = new Set();
let current: ReadonlySet<KartUnlockId> | undefined;
const listeners = new Set<() => void>();

function read(): ReadonlySet<KartUnlockId> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const list =
      value &&
      typeof value === "object" &&
      Array.isArray((value as { earned?: unknown }).earned)
        ? (value as { earned: unknown[] }).earned
        : [];
    return new Set(
      list.filter((id): id is KartUnlockId => typeof id === "string" && known.has(id)),
    );
  } catch {
    return empty;
  }
}

export function getUnlocked(): ReadonlySet<KartUnlockId> {
  current ??= read();
  return current;
}

/** Adds unlocks and returns the ones that are new to this device. */
export function earnUnlocks(ids: readonly KartUnlockId[]): KartUnlockId[] {
  const before = getUnlocked();
  const fresh = ids.filter((id, i) => !before.has(id) && ids.indexOf(id) === i);
  if (!fresh.length) return [];
  current = new Set([...before, ...fresh]);
  try {
    localStorage.setItem(storageKey, JSON.stringify({ earned: [...current] }));
  } catch {
    /* Still unlocked for this visit without storage. */
  }
  for (const listener of listeners) listener();
  return fresh;
}

/** Forgets the cache, for tests and for another tab's change. */
export function reloadUnlocks() {
  current = undefined;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey) reloadUnlocks();
  };
  window.addEventListener("storage", fromOtherTab);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", fromOtherTab);
  };
}

export function useUnlocked(): ReadonlySet<KartUnlockId> {
  return useSyncExternalStore(subscribe, getUnlocked, () => empty);
}

/** How to earn a paint, or undefined when it is already this device's to use. */
export function paintLock(paint: KartPaint, unlocked: ReadonlySet<KartUnlockId>) {
  const unlock = paintUnlock(paint);
  return unlock && !unlocked.has(unlock.id) ? unlock.how : undefined;
}
export function styleLock(style: DriverStyle, unlocked: ReadonlySet<KartUnlockId>) {
  const unlock = styleUnlock(style);
  return unlock && !unlocked.has(unlock.id) ? unlock.how : undefined;
}

/**
 * Records a finished Grand Prix once and returns what it newly unlocked, for
 * the results screen. `key` identifies the Grand Prix, so a re-render or a
 * second visit to the same results does not count it twice.
 */
export function useGrandPrixUnlocks(
  result: { key: string; cupId: string; place: number | undefined } | null,
): KartUnlockId[] {
  const [fresh, setFresh] = useState<{ key: string; ids: KartUnlockId[] } | null>(null);
  const recorded = useRef<string | null>(null);
  const key = result?.key ?? null;
  const cupId = result?.cupId;
  const place = result?.place;
  useEffect(() => {
    if (key === null || !cupId || recorded.current === key) return;
    recorded.current = key;
    setFresh({ key, ids: earnUnlocks(grandPrixUnlocks({ cupId, place })) });
  }, [key, cupId, place]);
  return fresh && fresh.key === key ? fresh.ids : [];
}
