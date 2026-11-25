import { useSyncExternalStore } from "react";
import type { GraphicsMode } from "../kart/graphics";

/** Things a racer can press. Item and recovery fire once per press. */
export const kartActions = [
  "gas",
  "brake",
  "left",
  "right",
  "drift",
  "item",
  "recover",
] as const;
export type KartAction = (typeof kartActions)[number];

export const kartActionLabel: Record<KartAction, string> = {
  gas: "Accelerate",
  brake: "Brake / reverse",
  left: "Steer left",
  right: "Steer right",
  drift: "Drift / boost",
  item: "Use item",
  recover: "Back to the track",
};

/** Keys are `KeyboardEvent.key`, lower-cased. Each action holds up to two. */
export type KeyBindings = Record<KartAction, string[]>;
export const maxKeysPerAction = 2;

export const defaultKeyBindings: KeyBindings = {
  gas: ["arrowup", "w"],
  brake: ["arrowdown", "s"],
  left: ["arrowleft", "a"],
  right: ["arrowright", "d"],
  drift: [" "],
  item: ["e"],
  recover: ["r"],
};

export type CameraDistance = "close" | "normal" | "far";
export type ShadowMode = "auto" | "on" | "off";
export type TouchLayout = "auto" | "pad" | "slider";

export type Settings = {
  graphics: GraphicsMode;
  /** Auto draws shadows at high and balanced detail, not at low. */
  shadows: ShadowMode;
  camera: CameraDistance;
  /** "system" follows the device setting; "reduce" always reduces. */
  motion: "system" | "reduce";
  /** Draws kart paint from a palette that stays distinct with colour blindness. */
  colourSafe: boolean;
  steering: {
    sensitivity: number;
    deadzone: number;
    layout: TouchLayout;
    swapSides: boolean;
    mouse: boolean;
  };
  keys: KeyBindings;
  /** The driving school was finished or skipped. */
  schoolDone: boolean;
};

export const defaultSettings: Settings = {
  graphics: "auto",
  shadows: "auto",
  camera: "normal",
  motion: "system",
  colourSafe: false,
  steering: {
    sensitivity: 1,
    deadzone: 0.15,
    layout: "auto",
    swapSides: false,
    mouse: false,
  },
  keys: defaultKeyBindings,
  schoolDone: false,
};

const storageKey = "kart-party-settings";

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback;
const range = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const flag = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** A key a racer may bind: printable or named, never a modifier or Tab/Escape. */
export function bindableKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (["tab", "escape", "shift", "control", "alt", "meta", "dead"].includes(lower))
    return false;
  // Function keys reload, go full screen or open developer tools.
  if (lower === "unidentified" || lower.startsWith("audio") || /^f\d+$/.test(lower))
    return false;
  return key.length === 1 || /^[a-z][a-z0-9]{1,19}$/.test(lower);
}

/** Valid, unique bindings; an action left with none gets its default back. */
export function sanitiseKeys(value: unknown): KeyBindings {
  const raw = record(value);
  const used = new Set<string>();
  const result = {} as KeyBindings;
  for (const action of kartActions) {
    const list = Array.isArray(raw[action]) ? (raw[action] as unknown[]) : [];
    const keys: string[] = [];
    for (const item of list) {
      if (typeof item !== "string" || !bindableKey(item)) continue;
      const key = item.toLowerCase();
      if (used.has(key) || keys.length >= maxKeysPerAction) continue;
      used.add(key);
      keys.push(key);
    }
    result[action] = keys;
  }
  for (const action of kartActions)
    if (!result[action].length) {
      const free = defaultKeyBindings[action].filter((key) => !used.has(key));
      free.forEach((key) => used.add(key));
      result[action] = free;
    }
  return result;
}

/** Anything stored, from any version, becomes a complete and valid settings object. */
export function sanitiseSettings(value: unknown): Settings {
  const raw = record(value);
  const steering = record(raw.steering);
  const d = defaultSettings;
  return {
    graphics: pick(raw.graphics, ["auto", "high", "low"], d.graphics),
    shadows: pick(raw.shadows, ["auto", "on", "off"], d.shadows),
    camera: pick(raw.camera, ["close", "normal", "far"], d.camera),
    motion: pick(raw.motion, ["system", "reduce"], d.motion),
    colourSafe: flag(raw.colourSafe, d.colourSafe),
    steering: {
      sensitivity: range(steering.sensitivity, 0.5, 1.5, d.steering.sensitivity),
      deadzone: range(steering.deadzone, 0.05, 0.4, d.steering.deadzone),
      layout: pick(steering.layout, ["auto", "pad", "slider"], d.steering.layout),
      swapSides: flag(steering.swapSides, d.steering.swapSides),
      mouse: flag(steering.mouse, d.steering.mouse),
    },
    keys: raw.keys === undefined ? d.keys : sanitiseKeys(raw.keys),
    schoolDone: flag(raw.schoolDone, d.schoolDone),
  };
}

function read(): Settings {
  try {
    const text = localStorage.getItem(storageKey);
    return text ? sanitiseSettings(JSON.parse(text)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

let current: Settings | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function getSettings(): Settings {
  current ??= read();
  return current;
}

type Patch = Partial<Omit<Settings, "steering">> & {
  steering?: Partial<Settings["steering"]>;
};

/** Saves on this device. Every open tab and canvas picks the change up. */
export function updateSettings(patch: Patch | ((value: Settings) => Settings)) {
  const base = getSettings();
  const next =
    typeof patch === "function"
      ? patch(base)
      : { ...base, ...patch, steering: { ...base.steering, ...patch.steering } };
  current = sanitiseSettings(next);
  try {
    localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    /* Settings still apply for this visit without storage. */
  }
  notify();
}

/** Back to defaults, keeping whether the driving school was done. */
export function resetSettings() {
  updateSettings({ ...defaultSettings, schoolDone: getSettings().schoolDone });
}

export function subscribeSettings(listener: () => void) {
  if (!listeners.size && typeof window !== "undefined")
    window.addEventListener("storage", fromOtherTab);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && typeof window !== "undefined")
      window.removeEventListener("storage", fromOtherTab);
  };
}

function fromOtherTab(event: StorageEvent) {
  if (event.key !== null && event.key !== storageKey) return;
  current = read();
  notify();
}

/** Forget the cached copy, for tests. */
export function reloadSettings() {
  current = undefined;
  notify();
}

/** The whole settings object. Re-renders on any change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

/** One value from settings. Return a primitive so unrelated changes skip a render. */
export function useSetting<T>(select: (value: Settings) => T): T {
  return useSyncExternalStore(
    subscribeSettings,
    () => select(getSettings()),
    () => select(getSettings()),
  );
}

/** Which action a key drives, if any. */
export function actionForKey(key: string, keys: KeyBindings): KartAction | undefined {
  const lower = key.toLowerCase();
  return kartActions.find((action) => keys[action].includes(lower));
}

/**
 * Bind `key` to `action` as its first key. A key already used by another
 * action moves here; if that leaves the other action with no key, the two
 * swap, so it takes this action's old key. No action is ever left without one.
 */
export function bindKey(
  keys: KeyBindings,
  action: KartAction,
  key: string,
): KeyBindings {
  const lower = key.toLowerCase();
  if (!bindableKey(lower)) return keys;
  const owner = kartActions.find(
    (name) => name !== action && keys[name].includes(lower),
  );
  const next = Object.fromEntries(
    kartActions.map((name) => [name, keys[name].filter((k) => k !== lower)]),
  ) as KeyBindings;
  const previous = next[action];
  next[action] = [lower, ...previous].slice(0, maxKeysPerAction);
  const give = previous[0];
  if (owner && !next[owner].length && give) {
    next[action] = next[action].filter((k) => k !== give);
    next[owner] = [give];
  }
  return sanitiseKeys(next);
}

const keyNames: Record<string, string> = {
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "Enter",
  backspace: "Backspace",
};

/** How a key is written on screen. */
export function keyLabel(key: string): string {
  const lower = key.toLowerCase();
  if (keyNames[lower]) return keyNames[lower];
  if (lower.length === 1) return lower.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "W or ↑" for help text. */
export function keysText(keys: KeyBindings, action: KartAction): string {
  return keys[action].map(keyLabel).join(" or ") || "no key";
}
