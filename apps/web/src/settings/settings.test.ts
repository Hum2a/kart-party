import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { kartPaints } from "@kart-party/game";
import {
  actionForKey,
  bindKey,
  bindableKey,
  defaultKeyBindings,
  defaultSettings,
  getSettings,
  keyLabel,
  keysText,
  reloadSettings,
  resetSettings,
  sanitiseKeys,
  sanitiseSettings,
  subscribeSettings,
  updateSettings,
} from "./settings";
import { colourSafePaint, paintHex } from "./paint";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

beforeEach(() => {
  localStorage.clear();
  reloadSettings();
});

describe("settings", () => {
  it("turns anything stored into complete, valid settings", () => {
    expect(sanitiseSettings(undefined)).toEqual(defaultSettings);
    expect(sanitiseSettings("nonsense")).toEqual(defaultSettings);
    const odd = sanitiseSettings({
      graphics: "ultra",
      shadows: "on",
      camera: "far",
      motion: "reduce",
      colourSafe: "yes",
      steering: { sensitivity: 9, deadzone: -1, layout: "pad", swapSides: true },
    });
    expect(odd.graphics).toBe("auto");
    expect(odd.shadows).toBe("on");
    expect(odd.camera).toBe("far");
    expect(odd.motion).toBe("reduce");
    expect(odd.colourSafe).toBe(false);
    expect(odd.steering).toEqual({
      sensitivity: 1.5,
      deadzone: 0.05,
      layout: "pad",
      swapSides: true,
      mouse: false,
    });
    expect(odd.keys).toEqual(defaultKeyBindings);
  });

  it("saves on this device and reads it back after a reload", () => {
    updateSettings({ camera: "close", steering: { swapSides: true } });
    expect(getSettings().camera).toBe("close");
    expect(getSettings().steering.sensitivity).toBe(1);
    reloadSettings();
    expect(getSettings().camera).toBe("close");
    expect(getSettings().steering.swapSides).toBe(true);
    // Corrupt storage falls back to the defaults rather than breaking the game.
    localStorage.setItem("kart-party-settings", "{not json");
    reloadSettings();
    expect(getSettings()).toEqual(defaultSettings);
  });

  it("tells every listener, and follows a change made in another tab", () => {
    let calls = 0;
    const stop = subscribeSettings(() => calls++);
    updateSettings({ shadows: "off" });
    expect(calls).toBe(1);
    localStorage.setItem(
      "kart-party-settings",
      JSON.stringify({ ...defaultSettings, camera: "far" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "kart-party-settings" }));
    expect(calls).toBe(2);
    expect(getSettings().camera).toBe("far");
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(calls).toBe(2);
    stop();
  });

  it("resets everything except whether the driving school was done", () => {
    updateSettings({ camera: "far", colourSafe: true, schoolDone: true });
    resetSettings();
    expect(getSettings()).toEqual({ ...defaultSettings, schoolDone: true });
  });
});

describe("key bindings", () => {
  it("finds the action for a key, ignoring case", () => {
    expect(actionForKey("W", defaultKeyBindings)).toBe("gas");
    expect(actionForKey(" ", defaultKeyBindings)).toBe("drift");
    expect(actionForKey("q", defaultKeyBindings)).toBeUndefined();
  });

  it("swaps a key that is already in use, so no action is left without one", () => {
    const swapped = bindKey(defaultKeyBindings, "drift", "e");
    expect(swapped.drift).toEqual(["e"]);
    expect(swapped.item).toEqual([" "]);
    // An action with a second key keeps it and just loses the one that moved.
    const moved = bindKey(defaultKeyBindings, "brake", "w");
    expect(moved.brake).toEqual(["w", "arrowdown"]);
    expect(moved.gas).toEqual(["arrowup"]);
    // A new key pushes the oldest off the end.
    expect(bindKey(defaultKeyBindings, "gas", "i").gas).toEqual(["i", "arrowup"]);
    expect(bindKey(defaultKeyBindings, "gas", "i").brake).toEqual(["arrowdown", "s"]);
  });

  it("refuses keys a racer should not bind", () => {
    for (const key of ["Tab", "Escape", "Shift", "Control", "Meta", "F5", "F12"])
      expect(bindableKey(key)).toBe(false);
    for (const key of ["q", " ", "ArrowLeft", "Enter", "1", ";"])
      expect(bindableKey(key)).toBe(true);
    expect(bindKey(defaultKeyBindings, "gas", "Tab")).toBe(defaultKeyBindings);
  });

  it("cleans stored bindings: no duplicates, no bad keys, at most two each", () => {
    const keys = sanitiseKeys({
      gas: ["w", "W", "i", "o"],
      brake: ["w", "Tab"],
      left: 7,
    });
    expect(keys.gas).toEqual(["w", "i"]);
    expect(keys.brake).toEqual(["arrowdown", "s"]);
    expect(keys.left).toEqual(["arrowleft", "a"]);
  });

  it("writes keys the way they look on a keyboard", () => {
    expect(keyLabel(" ")).toBe("Space");
    expect(keyLabel("arrowup")).toBe("↑");
    expect(keyLabel("q")).toBe("Q");
    expect(keyLabel("enter")).toBe("Enter");
    expect(keysText(defaultKeyBindings, "gas")).toBe("↑ or W");
  });
});

describe("paint and motion", () => {
  it("gives every paint a distinct colour-blind-safe colour, keeping the names", () => {
    const safe = kartPaints.map((paint) => paintHex(paint.id, true));
    expect(new Set(safe).size).toBe(kartPaints.length);
    expect(paintHex("flame", false)).toBe("#ff5a36");
    expect(paintHex("flame", true)).toBe(colourSafePaint.flame);
    expect(paintHex(undefined, true)).toBeUndefined();
  });

  it("reduces motion when settings say so, even if the device does not", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => updateSettings({ motion: "reduce" }));
    expect(result.current).toBe(true);
  });
});
