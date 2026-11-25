import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { kartNeutral } from "@kart-party/game";
import { SettingsPage } from "./SettingsPage";
import { getSettings, reloadSettings, updateSettings } from "./settings";
import { useKartControls } from "../kart/useKartControls";
import { installPwa, promptInstall, useInstallState } from "../pwa/install";

beforeEach(() => {
  localStorage.clear();
  reloadSettings();
});

const page = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );

it("saves each choice as it is made", () => {
  page();
  fireEvent.click(screen.getByLabelText(/^Far/));
  fireEvent.click(screen.getByLabelText("Off"));
  fireEvent.click(screen.getByLabelText("Always reduce"));
  fireEvent.click(screen.getByLabelText(/Colour-blind-safe kart paint/));
  fireEvent.click(screen.getByLabelText(/Swap touch sides/));
  fireEvent.click(screen.getByLabelText("Slider"));
  fireEvent.change(screen.getByLabelText("Steering response"), {
    target: { value: "0.7" },
  });
  const saved = getSettings();
  expect(saved.camera).toBe("far");
  expect(saved.shadows).toBe("off");
  expect(saved.motion).toBe("reduce");
  expect(saved.colourSafe).toBe(true);
  expect(saved.steering).toMatchObject({
    swapSides: true,
    layout: "slider",
    sensitivity: 0.7,
  });
  expect(localStorage.getItem("kart-party-settings")).toContain('"camera":"far"');
});

it("remaps a key, says what moved, and lets Escape cancel", async () => {
  page();
  fireEvent.click(screen.getByLabelText("Change the key for Drift / boost"));
  expect(screen.getByText(/Press a key for Drift \/ boost/)).toBeTruthy();
  // Other rows wait while one is listening.
  expect(
    (screen.getByLabelText("Change the key for Accelerate") as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.keyDown(window, { key: "Tab" });
  expect(screen.getByText(/Tab cannot be used/)).toBeTruthy();
  fireEvent.keyDown(window, { key: "e" });
  expect(getSettings().keys.drift).toEqual(["e"]);
  expect(getSettings().keys.item).toEqual([" "]);
  expect(
    screen.getByText("Drift / boost is now E. Use item is now Space."),
  ).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Change the key for Accelerate"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.getByText("No change.")).toBeTruthy();
  expect(getSettings().keys.gas).toEqual(["arrowup", "w"]);
  fireEvent.click(screen.getByText("Reset keys"));
  expect(getSettings().keys.drift).toEqual([" "]);
});

it("asks before resetting everything", async () => {
  updateSettings({ camera: "close" });
  page();
  fireEvent.click(screen.getByText("Reset all settings"));
  expect(getSettings().camera).toBe("close");
  fireEvent.click(await screen.findByText("Keep my settings"));
  expect(getSettings().camera).toBe("close");
  fireEvent.click(await screen.findByText("Reset all settings"));
  fireEvent.click(await screen.findByText("Reset"));
  expect(getSettings().camera).toBe("normal");
});

it("drives with remapped keys straight away", () => {
  const onChange = vi.fn();
  renderHook(() =>
    useKartControls({
      disabled: false,
      preferences: { sensitivity: 1, deadzone: 0.15 },
      onChange,
    }),
  );
  act(() => updateSettings({ keys: { ...getSettings().keys, gas: ["i"] } }));
  onChange.mockClear();
  fireEvent.keyDown(window, { key: "w" });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "i" });
  expect(onChange).toHaveBeenLastCalledWith({ ...kartNeutral, gas: true });
  fireEvent.keyUp(window, { key: "i" });
  expect(onChange).toHaveBeenLastCalledWith({ ...kartNeutral });
});

it("keeps the browser's install prompt for the Install button", async () => {
  installPwa({ register: false });
  const { result } = renderHook(() => useInstallState());
  expect(result.current).toBe("unavailable");
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
  expect(result.current).toBe("ready");
  let accepted = false;
  await act(async () => {
    accepted = await promptInstall();
  });
  expect(prompt).toHaveBeenCalledOnce();
  expect(accepted).toBe(true);
  expect(result.current).toBe("installed");
});
