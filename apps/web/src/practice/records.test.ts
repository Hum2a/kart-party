import { beforeEach, expect, it } from "vitest";
import { formatRaceTime, readBest, recordBest } from "./records";

beforeEach(() => localStorage.clear());

const key = { trackId: "harbour-v1", laps: 3 } as const;

it("keeps only the fastest time per course and lap count", () => {
  expect(readBest(key)).toBeUndefined();
  expect(recordBest(key, 90_000, 1)).toEqual({
    best: { timeMs: 90_000, at: 1 },
    improved: true,
  });
  expect(recordBest(key, 95_000, 2)).toEqual({
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
