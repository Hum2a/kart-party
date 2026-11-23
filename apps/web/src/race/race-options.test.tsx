import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RaceOptions, type RaceRules } from "./RaceOptions";
import { PaintPicker } from "./pickers";
import { DriverBadge } from "../kart/DriverBadge";

const rules: RaceRules = {
  laps: 3,
  cpu: 3,
  cpuLevel: "normal",
  items: "all",
  speedClass: "100",
};

it("changes items, CPU difficulty and laps, and explains the item set", () => {
  const change = vi.fn();
  const view = render(<RaceOptions value={rules} onChange={change} />);
  expect(screen.getByText("All seven, catch-up luck")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Classic"));
  expect(change).toHaveBeenLastCalledWith({ ...rules, items: "classic" });
  fireEvent.click(screen.getByLabelText(/150cc/));
  expect(change).toHaveBeenLastCalledWith({ ...rules, speedClass: "150" });
  fireEvent.click(screen.getByLabelText("Hard"));
  expect(change).toHaveBeenLastCalledWith({ ...rules, cpuLevel: "hard" });
  fireEvent.click(
    within(screen.getByRole("group", { name: "Laps" })).getByLabelText("1"),
  );
  expect(change).toHaveBeenLastCalledWith({ ...rules, laps: 1 });
  view.rerender(
    <RaceOptions value={{ ...rules, cpu: 0 }} onChange={change} timeTrialLabel />,
  );
  expect(screen.getByLabelText("Time trial")).toBeTruthy();
  // Difficulty means nothing with no CPU racers.
  expect(screen.getByLabelText("Hard").matches(":disabled")).toBe(true);
});

it("names every paint and reports the chosen one", () => {
  const change = vi.fn();
  render(<PaintPicker value="flame" onChange={change} />);
  expect((screen.getByLabelText("Flame") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText("Grape"));
  expect(change).toHaveBeenCalledWith("grape");
});

it("rings a driver badge in the racer's kart paint", () => {
  render(<DriverBadge driver={{ style: "dj", paint: "lime" }} nickname="Ada" />);
  const badge = document.querySelector(".driver-badge") as HTMLElement;
  expect(badge.style.borderColor).toBe("rgb(125, 220, 60)");
  expect(screen.getByRole("img", { name: "Ada’s driver" })).toBeTruthy();
});
