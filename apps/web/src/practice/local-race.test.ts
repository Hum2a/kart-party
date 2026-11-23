import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLocalRace, practicePlayerId, type PracticeSetup } from "./local-race";

const setup: PracticeSetup = {
  name: "Ada",
  driver: "racer",
  trackId: "parkside-v1",
  laps: 1,
  cpu: 2,
  items: true,
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
