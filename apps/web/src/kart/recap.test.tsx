import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { kartRaceRecap, projectKartRace } from "@kart-party/game";
import { KartRecapPanel } from "./KartRecapPanel";
import { kartRecapRehearsal } from "./recap-rehearsal";
import { GuestKart, type LobbySnapshot } from "./guest-kart.test-support";
it("shows actual complete split sums and honest older/unknown history", () => {
  const race = kartRecapRehearsal("recovery");
  const recap = kartRaceRecap(race)!;
  const view = render(<KartRecapPanel recap={recap} />);
  expect(screen.getByText(/Back to track 1 time/)).toBeTruthy();
  view.rerender(
    <KartRecapPanel
      recap={{ ...recap, drivers: [{ ...recap.drivers[0]!, sectorsMs: [null] }] }}
    />,
  );
  expect(screen.getByText("Sector 1: not recorded")).toBeTruthy();
  view.rerender(<KartRecapPanel recap={undefined} />);
  expect(screen.getByText(/not recorded for this older race/)).toBeTruthy();
});

it("does not label an older early ending as a timeout or invent a missing finish time", () => {
  const race = kartRecapRehearsal("host-ended");
  delete race.recapVersion;
  delete race.endReason;
  const snapshot = () =>
    ({
      phase: "reveal",
      paused: false,
      held: false,
      play: {
        question: { kind: "kart" },
        kart: projectKartRace(race, "stand-in-a", 100),
      },
    }) as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot()} />);
  expect(screen.getByRole("heading", { name: "Race ended" })).toBeTruthy();
  expect(
    screen.getByText("This race ended before you finished. Thanks for driving."),
  ).toBeTruthy();
  race.drivers[0]!.status = "FINISHED";
  race.drivers[0]!.lapTimeMs = null;
  view.rerender(<GuestKart snapshot={snapshot()} />);
  expect(screen.getByText("Time unavailable")).toBeTruthy();
});

it("labels device timing on accepted results", () => {
  render(
    <KartRecapPanel
      recap={kartRaceRecap(kartRecapRehearsal("host-ended"))}
      timingMode="device-v1"
    />,
  );
  expect(screen.getByText(/Device-recorded finish times/)).toBeTruthy();
});
