import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocalRace, practicePlayerId, type PracticeSetup } from "./local-race";
import { readGhost } from "./records";

const setup: PracticeSetup = {
  name: "Ada",
  driver: "racer",
  trackId: "parkside-v1",
  laps: 1,
  cpu: 2,
  cpuLevel: "normal",
  items: "all",
  speedClass: "100",
  paint: "lagoon",
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

it("counts down on the grid, then runs the shared race on this device", () => {
  const { result } = renderHook(() => useLocalRace(setup, 1));
  expect(result.current.stage.phase).toBe("grid");
  expect(result.current.race.selfPlayerId).toBe(practicePlayerId);
  expect(result.current.race.timingMode).toBe("device-v1");
  act(() => vi.advanceTimersByTime(3_000));
  expect(result.current.stage.phase).toBe("racing");
  const raceId = result.current.race.raceId;
  act(() => {
    result.current.onInput({
      raceId,
      sequence: 1,
      steer: 0,
      gas: true,
      brake: false,
      drift: false,
    });
    vi.advanceTimersByTime(2_000);
  });
  expect(result.current.race.elapsedMs).toBeGreaterThanOrEqual(1_800);
  const self = result.current.race.participants.find(
    (d) => d.playerId === practicePlayerId,
  )!;
  expect(self.speed).toBeGreaterThan(0);
});

it("stops the race clock while paused", () => {
  const { result } = renderHook(() => useLocalRace(setup, 2));
  act(() => vi.advanceTimersByTime(3_000));
  act(() => vi.advanceTimersByTime(1_000));
  const before = result.current.race.elapsedMs;
  expect(before).toBeGreaterThanOrEqual(900);
  act(() => result.current.pause(true));
  act(() => vi.advanceTimersByTime(10_000));
  expect(result.current.race.elapsedMs).toBe(before);
  act(() => result.current.pause(false));
  act(() => vi.advanceTimersByTime(1_000));
  expect(result.current.race.elapsedMs).toBeLessThan(before + 1_500);
  expect(result.current.race.elapsedMs).toBeGreaterThan(before);
});

it("settles results and records a personal best when the racer finishes", () => {
  const { result } = renderHook(() => useLocalRace({ ...setup, cpu: 0 }, 3));
  act(() => vi.advanceTimersByTime(3_000));
  act(() => vi.advanceTimersByTime(40_000));
  const raceId = result.current.race.raceId;
  act(() => {
    result.current.onFinish({ raceId, elapsedMs: 39_000, lapsMs: [39_000] });
  });
  expect(result.current.stage.phase).toBe("done");
  expect(result.current.outcome?.results[0]).toMatchObject({
    playerId: practicePlayerId,
    timeMs: 39_000,
    place: 1,
  });
  expect(result.current.outcome?.improved).toBe(true);
});

it("saves a ghost from an improved time trial and races against it next time", () => {
  const trial = { ...setup, cpu: 0, items: "off" as const };
  const first = renderHook(() => useLocalRace(trial, 4));
  act(() => vi.advanceTimersByTime(3_000));
  const raceId = first.result.current.race.raceId;
  for (let i = 0; i < 20; i++)
    act(() => {
      first.result.current.onInput({
        raceId,
        sequence: i + 1,
        steer: 0,
        gas: true,
        brake: false,
        drift: false,
      });
      vi.advanceTimersByTime(100);
    });
  act(() => {
    first.result.current.onFinish({ raceId, elapsedMs: 40_000, lapsMs: [40_000] });
  });
  expect(first.result.current.outcome).toMatchObject({
    improved: true,
    ghostSaved: true,
  });
  const ghost = readGhost({ trackId: "parkside-v1", laps: 1, speedClass: "100" })!;
  expect(ghost.timeMs).toBe(40_000);
  expect(ghost.poses.length).toBeGreaterThan(30);
  first.unmount();

  const second = renderHook(() => useLocalRace(trial, 5));
  expect(second.result.current.ghost?.timeMs).toBe(40_000);
  act(() => vi.advanceTimersByTime(3_000));
  act(() => vi.advanceTimersByTime(1_000));
  const nearby = second.result.current.race.nearby ?? [];
  expect(nearby.map((d) => d.playerId)).toContain("ghost-best");
  // A slower finish keeps the old ghost and best.
  const raceId2 = second.result.current.race.raceId;
  act(() => {
    second.result.current.onFinish({
      raceId: raceId2,
      elapsedMs: 45_000,
      lapsMs: [45_000],
    });
  });
  expect(second.result.current.outcome).toMatchObject({
    improved: false,
    ghostSaved: false,
  });
  expect(second.result.current.split).toEqual({ lap: 1, gapMs: 5_000 });
  expect(
    readGhost({ trackId: "parkside-v1", laps: 1, speedClass: "100" })!.timeMs,
  ).toBe(40_000);
});

it("never shows a ghost when CPU racers are on the grid", () => {
  const { result } = renderHook(() => useLocalRace(setup, 6));
  expect(result.current.ghost).toBeUndefined();
});
