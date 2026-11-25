import type { DriverStyle, KartPaint } from "./kart-driver.ts";

/**
 * Cosmetic rewards for Grand Prix results. They change how a kart looks and
 * nothing else. Unlocks are kept on the device that earned them: there are no
 * accounts, so the room accepts any paint or driver a phone sends.
 */
export type KartUnlockRule = "finish" | "podium" | "win" | "tour";
export type KartUnlock =
  | { id: string; kind: "paint"; item: KartPaint; rule: KartUnlockRule; how: string }
  | { id: string; kind: "style"; item: DriverStyle; rule: KartUnlockRule; how: string };

export const kartUnlocks = [
  {
    id: "paint-copper",
    kind: "paint",
    item: "copper",
    rule: "finish",
    how: "Finish any Grand Prix",
  },
  {
    id: "paint-racing",
    kind: "paint",
    item: "racing",
    rule: "podium",
    how: "Finish a Grand Prix in the top three",
  },
  {
    id: "style-astronaut",
    kind: "style",
    item: "astronaut",
    rule: "podium",
    how: "Finish a Grand Prix in the top three",
  },
  {
    id: "paint-gold",
    kind: "paint",
    item: "gold",
    rule: "win",
    how: "Win a Grand Prix",
  },
  {
    id: "style-champion",
    kind: "style",
    item: "champion",
    rule: "tour",
    how: "Win the Grand Tour",
  },
] as const satisfies readonly KartUnlock[];
export type KartUnlockId = (typeof kartUnlocks)[number]["id"];

/** The unlock that earns a paint or driver, or undefined when everyone has it. */
export const paintUnlock = (paint: KartPaint) =>
  kartUnlocks.find((u) => u.kind === "paint" && u.item === paint);
export const styleUnlock = (style: DriverStyle) =>
  kartUnlocks.find((u) => u.kind === "style" && u.item === style);

/**
 * What one finished Grand Prix earns. `place` is the racer's final place in the
 * points table, CPU racers included; a racer with no place did not take part.
 */
export function grandPrixUnlocks(result: {
  cupId: string;
  place: number | undefined;
}): KartUnlockId[] {
  const { cupId, place } = result;
  if (place === undefined || !Number.isInteger(place) || place < 1) return [];
  const met: Record<KartUnlockRule, boolean> = {
    finish: true,
    podium: place <= 3,
    win: place === 1,
    tour: place === 1 && cupId === "grand-tour",
  };
  return kartUnlocks.filter((u) => met[u.rule]).map((u) => u.id);
}
