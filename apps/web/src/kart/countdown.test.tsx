import { act, render, renderHook, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@kart-party/game";
import { raceCountdown, useRaceCountdown } from "./countdown";
import * as haptics from "../device/haptics";
import { KartCountdown } from "./KartCountdown";
import type { RaceStage } from "./race-stage";

const base = { paused: false, mode: "prompt-tail" as const };
const race = projectKartRace(
  createKartRace("count", [{ playerId: "a", name: "A" }]),
  "a",
  0,
);

it("counts 3-2-1 over the three seconds before GO, then shows GO for a second", () => {
  expect(raceCountdown({ ...base, untilGoMs: 5_000 })).toBeNull();
  expect(raceCountdown({ ...base, untilGoMs: 3_000 })).toBe(3);
  expect(raceCountdown({ ...base, untilGoMs: 2_001 })).toBe(3);
  expect(raceCountdown({ ...base, untilGoMs: 2_000 })).toBe(2);
  expect(raceCountdown({ ...base, untilGoMs: 1 })).toBe(1);
  expect(raceCountdown({ ...base, untilGoMs: 0 })).toBe("GO");
  expect(raceCountdown({ ...base, untilGoMs: -999 })).toBe("GO");
  expect(raceCountdown({ ...base, untilGoMs: -1_000 })).toBeNull();
});

it("shows nothing when paused, switched off or without a start time", () => {
  expect(raceCountdown({ ...base, untilGoMs: 2_000, enabled: false })).toBeNull();
  expect(raceCountdown({ ...base, untilGoMs: 2_000, paused: true })).toBeNull();
  expect(raceCountdown({ ...base, untilGoMs: 2_000, mode: "none" })).toBeNull();
  expect(raceCountdown({ ...base, untilGoMs: null })).toBeNull();
});

const stageAt = (goAt: number, now: () => number): RaceStage => ({
  phase: "grid",
  goAt,
  now,
});

it("buzzes once per beat and does not replay a beat when re-enabled", () => {
  const buzz = vi.spyOn(haptics, "buzz").mockImplementation(() => {});
  try {
    const stage = stageAt(1_500, () => 0);
    const view = render(<KartCountdown stage={stage} race={race} haptics />);
    expect(buzz).toHaveBeenCalledTimes(1);
    view.rerender(<KartCountdown stage={stage} race={race} enabled={false} haptics />);
    expect(
      document.querySelector(
        '.kart-countdown[data-active="false"][aria-hidden="true"]',
      ),
    ).toBeTruthy();
    view.rerender(<KartCountdown stage={stage} race={race} haptics />);
    expect(buzz).toHaveBeenCalledTimes(1);
  } finally {
    buzz.mockRestore();
  }
});

it("moves from 3 to GO and expires GO on its own clock", () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  try {
    const stage = stageAt(102_500, () => Date.now());
    const view = renderHook(() => useRaceCountdown(stage, race));
    expect(view.result.current).toBe(3);
    act(() => vi.advanceTimersByTime(2_600));
    expect(view.result.current).toBe("GO");
    act(() => vi.advanceTimersByTime(1_200));
    expect(view.result.current).toBeNull();
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("renders the beat and respects the countdown setting", () => {
  const stage = stageAt(1_500, () => 0);
  const view = render(<KartCountdown stage={stage} race={race} />);
  expect(screen.getByText("2")).toBeTruthy();
  view.unmount();
  render(
    <KartCountdown stage={stage} race={{ ...race, settings: { countdown: "none" } }} />,
  );
  expect(document.querySelector(".kart-countdown span[data-beat]")).toBeNull();
});
