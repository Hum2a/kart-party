import { beforeEach, expect, it } from "vitest";
import { formatRaceTime, readBest, recordBest } from "./records";

beforeEach(() => localStorage.clear());

const key = { trackId: "harbour-v1", laps: 3 } as const;

it("keeps only the fastest time per course and lap count", () => {
  expect(readBest(key)).toBeUndefined();
  expect(recordBest(key, 90_000, 1)).toMatchObject({
    best: { timeMs: 90_000, at: 1 },
    improved: true,
  });
  expect(recordBest(key, 95_000, 2)).toMatchObject({
    best: { timeMs: 90_000, at: 1 },
    improved: false,
  });
  expect(recordBest(key, 85_000, 3).improved).toBe(true);
  expect(readBest(key)?.timeMs).toBe(85_000);
  expect(readBest({ ...key, laps: 1 })).toBeUndefined();
});

it("ignores damaged storage instead of failing", () => {
  localStorage.setItem("kart-party:bests", "{not json");
  expect(readBest(key)).toBeUndefined();
  localStorage.setItem(
    "kart-party:bests",
    JSON.stringify({ "harbour-v1:3": { timeMs: -5 } }),
  );
  expect(readBest(key)).toBeUndefined();
});

it("formats race times for people", () => {
  expect(formatRaceTime(41_230)).toBe("41.23s");
  expect(formatRaceTime(83_050)).toBe("1:23.05");
});

it("tracks the fastest single lap separately, per engine class", () => {
  const first = recordBest(key, 90_000, 1, localStorage, [31_000, 61_000, 90_000]);
  expect(first).toMatchObject({ improved: true, lapImproved: true });
  expect(first.best.bestLapMs).toBe(29_000);
  // A slower race with a faster lap keeps the race best and takes the lap.
  const second = recordBest(key, 92_000, 2, localStorage, [28_500, 60_000, 92_000]);
  expect(second).toMatchObject({ improved: false, lapImproved: true });
  expect(second.best).toEqual({ timeMs: 90_000, at: 1, bestLapMs: 28_500 });
  expect(readBest({ ...key, speedClass: "150" })).toBeUndefined();
  expect(readBest({ ...key, speedClass: "100" })?.timeMs).toBe(90_000);
});
