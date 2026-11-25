import { StrictMode } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import {
  earnUnlocks,
  getUnlocked,
  reloadUnlocks,
  useGrandPrixUnlocks,
} from "./unlocks";
import { UnlockList, UnlockNotice } from "./UnlockViews";
import { DriverPicker, PaintPicker, trackTraits } from "../race/pickers";
import { TrackPreview } from "../race/TrackPreview";
import { SettingsPage } from "../settings/SettingsPage";
import { kartTrackCatalogue } from "@kart-party/game";

it("keeps earned unlocks on this device, once each, and ignores rubbish", () => {
  expect(getUnlocked().size).toBe(0);
  expect(earnUnlocks(["paint-copper", "paint-copper"])).toEqual(["paint-copper"]);
  expect(earnUnlocks(["paint-copper", "paint-gold"])).toEqual(["paint-gold"]);
  reloadUnlocks();
  expect([...getUnlocked()].sort()).toEqual(["paint-copper", "paint-gold"]);
  localStorage.setItem(
    "kart-party-unlocks",
    JSON.stringify({ earned: ["paint-gold", "free-money", 7] }),
  );
  reloadUnlocks();
  expect([...getUnlocked()]).toEqual(["paint-gold"]);
  localStorage.setItem("kart-party-unlocks", "{not json");
  reloadUnlocks();
  expect(getUnlocked().size).toBe(0);
});

it("locks earned paints and drivers in the pickers until they are unlocked", () => {
  let paint = "flame";
  const { rerender } = render(
    <PaintPicker value="flame" onChange={(value) => (paint = value)} />,
  );
  const gold = screen.getByLabelText(/^Gold/) as HTMLInputElement;
  expect(gold.disabled).toBe(true);
  expect(screen.getAllByText("Locked. Win a Grand Prix.").length).toBeGreaterThan(0);
  fireEvent.click(gold);
  expect(paint).toBe("flame");
  act(() => {
    earnUnlocks(["paint-gold"]);
  });
  rerender(<PaintPicker value="flame" onChange={(value) => (paint = value)} />);
  expect((screen.getByLabelText(/^Gold/) as HTMLInputElement).disabled).toBe(false);
  fireEvent.click(screen.getByLabelText(/^Gold/));
  expect(paint).toBe("gold");

  render(<DriverPicker value="racer" onChange={() => {}} />);
  expect((screen.getByLabelText(/^Champion/) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText(/^Bandit/) as HTMLInputElement).disabled).toBe(false);
});

it("records a finished Grand Prix once, even when React runs effects twice", () => {
  type Result = { key: string; cupId: string; place: number | undefined } | null;
  const result = { key: "gp-1", cupId: "grand-tour", place: 1 };
  const { result: hook, rerender } = renderHook(
    (props: Result) => useGrandPrixUnlocks(props),
    { initialProps: result as Result, wrapper: StrictMode },
  );
  expect(hook.current).toEqual([
    "paint-copper",
    "paint-racing",
    "style-astronaut",
    "paint-gold",
    "style-champion",
  ]);
  rerender({ ...result });
  expect(hook.current).toHaveLength(5);
  // The next Grand Prix has nothing new left to give.
  rerender({ ...result, key: "gp-2" });
  expect(hook.current).toEqual([]);
  rerender(null);
  expect(hook.current).toEqual([]);
});

it("announces new unlocks and lists every one in settings", async () => {
  render(<UnlockNotice ids={["paint-copper", "style-astronaut"]} />);
  expect(screen.getByRole("status").textContent).toMatch(/Unlocked!/);
  expect(screen.getByText("Copper paint")).toBeTruthy();
  expect(screen.getByText("Astronaut driver")).toBeTruthy();

  earnUnlocks(["paint-copper"]);
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "Unlocks" })).toBeTruthy();
  const { container } = render(<UnlockList />);
  expect(container.querySelectorAll('[data-earned="yes"]')).toHaveLength(1);
  expect(container.querySelectorAll('[data-earned="no"]')).toHaveLength(4);
});

it("draws shortcuts and alternate routes on the track preview, by name", () => {
  const { container } = render(<TrackPreview trackId="city-v1" />);
  const shortcut = container.querySelector('[data-branch="shortcut"]');
  expect(shortcut?.querySelector("title")?.textContent).toBe(
    "Building site (shortcut: needs a boost)",
  );
  const beach = render(<TrackPreview trackId="beach-v1" />);
  expect(beach.container.querySelector('[data-branch="alternate"]')).toBeTruthy();
  // Older tracks have none.
  const park = render(<TrackPreview trackId="parkside-v1" />);
  expect(park.container.querySelector("[data-branch]")).toBeNull();
});

it("sums up each track's features for the picker", () => {
  const byId = Object.fromEntries(kartTrackCatalogue.map((t) => [t.id, t]));
  expect(trackTraits(byId["summit-v1"]!.features)).toEqual([
    "a shortcut",
    "a narrow bridge",
    "2 jumps",
    "2 hazards",
  ]);
  expect(trackTraits(byId["beach-v1"]!.features)).toContain("an alternate route");
});
