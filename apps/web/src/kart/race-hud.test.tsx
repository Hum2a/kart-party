import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { KartRaceView } from "@kart-party/game";
import { KartRaceHud, raceRivals } from "./KartRaceHud";
import { bannerMs, useRaceFeedback } from "./useRaceFeedback";
import type { MusicPlayer } from "../audio/music";
import type { RaceAudio } from "./race-audio";
vi.mock("../device/haptics", () => ({ buzz: vi.fn() }));
import { buzz } from "../device/haptics";

type Row = {
  id: string;
  place: number;
  lap?: number;
  status?: "RACING" | "FINISHED";
  slipstream?: "charging" | "active";
};
function view(rows: Row[], patch: Partial<KartRaceView> = {}): KartRaceView {
  return {
    raceId: "race",
    laps: 3,
    elapsedMs: 10_000,
    ended: false,
    selfPlayerId: "b",
    participantCount: rows.length,
    participants: rows.map((row) => ({
      playerId: row.id,
      name: row.id.toUpperCase(),
      status: row.status ?? "RACING",
      lap: row.lap ?? 1,
      speed: 20,
      ...(row.slipstream ? { slipstream: row.slipstream } : {}),
    })),
    leaderboard: rows.map((row) => ({ playerId: row.id, place: row.place })),
    ...patch,
  } as unknown as KartRaceView;
}
function fakePlayer(): MusicPlayer {
  return {
    playing: null,
    play: vi.fn(),
    setTempo: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}
function fakeAudio(): RaceAudio {
  let enabled = false;
  return {
    get enabled() {
      return enabled;
    },
    enable: vi.fn(() => (enabled = true)),
    disable: vi.fn(() => {
      enabled = false;
    }),
    engine: vi.fn(),
    cue: vi.fn(),
    dispose: vi.fn(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(buzz).mockClear();
  localStorage.clear();
});

it("shows place, lap, the final lap and slipstream in words", () => {
  const race = view([
    { id: "a", place: 1 },
    { id: "b", place: 2, lap: 3, slipstream: "active" },
  ]);
  render(
    <KartRaceHud
      race={race}
      self={race.participants[1]!}
      place={2}
      reduced
      banner={{ id: "x", text: "FINAL LAP", tone: "final" }}
    />,
  );
  expect(screen.getByLabelText("Place 2 of 2").textContent).toContain("2nd");
  expect(screen.getByText("Lap 3/3").dataset.final).toBe("true");
  expect(screen.getByText("Slipstream!")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("FINAL LAP");
});

it("hides the lap counter in a one-lap race and shows a charging draft", () => {
  const race = view([{ id: "b", place: 1, slipstream: "charging" }], {
    laps: undefined,
  });
  render(
    <KartRaceHud race={race} self={race.participants[0]!} place={1} reduced={false} />,
  );
  expect(screen.queryByText(/Lap/)).toBeNull();
  expect(screen.getByText("Drafting…")).toBeTruthy();
});

it("turns race moments into banners and buzzes, with sound only when it is on", () => {
  const audio = fakeAudio();
  const player = fakePlayer();
  const start = view([
    { id: "a", place: 1 },
    { id: "b", place: 2 },
  ]);
  const hook = renderHook(
    ({ race }) => useRaceFeedback(race, { open: true, audio, player }),
    {
      initialProps: { race: start },
    },
  );
  // Sound off: banners still show and the phone still buzzes.
  hook.rerender({
    race: view([
      { id: "a", place: 2 },
      { id: "b", place: 1, lap: 2 },
    ]),
  });
  expect(hook.result.current.banner?.text).toBe("Up to 1st!");
  expect(buzz).toHaveBeenCalledWith(30);
  act(() => hook.result.current.toggleSound());
  expect(hook.result.current.soundOn).toBe(true);
  hook.rerender({
    race: view([
      { id: "a", place: 2 },
      { id: "b", place: 1, lap: 3 },
    ]),
  });
  expect(hook.result.current.banner?.text).toBe("FINAL LAP");
  expect(audio.cue).toHaveBeenCalledWith("final-lap");
  // The final lap speeds the track's music up.
  expect(player.setTempo).toHaveBeenCalledWith(1.1);
  expect(buzz).toHaveBeenCalledWith([60, 50, 60]);
  hook.rerender({
    race: view([
      { id: "a", place: 2 },
      { id: "b", place: 1, lap: 3, status: "FINISHED" },
    ]),
  });
  expect(audio.cue).toHaveBeenCalledWith("finish");
  // The engine note stops once this kart has finished.
  expect(vi.mocked(audio.engine).mock.lastCall).toEqual([20 / 30, false, false]);
  // The track's music stops for the finish fanfare.
  expect(player.stop).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(bannerMs));
  expect(hook.result.current.banner).toBeUndefined();
  act(() => hook.result.current.toggleSound());
  expect(audio.disable).toHaveBeenCalled();
});

it("names the drivers one place ahead and behind", () => {
  const race = view([
    { id: "a", place: 1 },
    { id: "b", place: 2 },
    { id: "c", place: 3 },
  ]);
  const rows = race.leaderboard.map((row) => ({
    ...row,
    name: row.playerId.toUpperCase(),
  }));
  const named = { ...race, leaderboard: rows } as KartRaceView;
  expect(raceRivals(named, 2, "b")).toMatchObject({
    ahead: { name: "A" },
    behind: { name: "C" },
  });
  expect(raceRivals(named, 1, "a").ahead).toBeUndefined();
  expect(raceRivals(named, undefined, "b")).toEqual({
    ahead: undefined,
    behind: undefined,
  });
});
