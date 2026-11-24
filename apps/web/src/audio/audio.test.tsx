import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMixer,
  defaultAudioPrefs,
  readAudioPrefs,
  writeAudioPrefs,
} from "./mixer";
import { playSfx, sfxNames } from "./sfx";
import {
  barEvents,
  barSeconds,
  degreeMidi,
  raceTheme,
  themes,
  type ThemeId,
} from "./music-themes";
import { createMusicPlayer } from "./music";
import { SoundButton, SoundSettings } from "./SoundSettings";
import { fakeAudioContext, memoryStorage } from "./fake-context.test-support";

describe("mixer", () => {
  it("builds no audio graph until unlocked, then routes music and effects through master", () => {
    const { context } = fakeAudioContext();
    const target = createMixer(() => context, memoryStorage());
    expect(target.ready).toBe(false);
    expect(target.graph()).toBeNull();
    expect(target.unlock()).toBe(true);
    expect(target.ready).toBe(true);
    expect(context.resume).toHaveBeenCalled();
    expect(context.createGain).toHaveBeenCalledTimes(3);
    expect(target.graph()).not.toBeNull();
    expect(target.noise()).toBe(target.noise());
  });

  it("remembers clamped volumes and mute, and recovers from damaged storage", () => {
    const storage = memoryStorage();
    const target = createMixer(() => fakeAudioContext().context, storage);
    target.set({ music: 2, sfx: -1, muted: true });
    expect(readAudioPrefs(storage)).toEqual({
      ...defaultAudioPrefs,
      music: 1,
      sfx: 0,
      muted: true,
    });
    storage.setItem("kart-party:audio", "{oops");
    expect(readAudioPrefs(storage)).toEqual(defaultAudioPrefs);
    writeAudioPrefs({ master: 0.5, music: 0.25, sfx: 1, muted: false }, storage);
    expect(createMixer(() => null, storage).prefs.music).toBe(0.25);
  });

  it("notifies listeners and pauses while hidden", () => {
    const { context } = fakeAudioContext();
    const target = createMixer(() => context, memoryStorage());
    const listener = vi.fn();
    target.subscribe(listener);
    target.unlock();
    expect(listener).toHaveBeenLastCalledWith(target.prefs, true);
    target.visibility(true);
    expect(context.suspend).toHaveBeenCalled();
    target.visibility(false);
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it("says so when the browser has no Web Audio", () => {
    expect(createMixer(() => null, memoryStorage()).unlock()).toBe(false);
  });
});

describe("sound effects", () => {
  it("plays every effect once unlocked, and none while locked or muted", () => {
    const { context } = fakeAudioContext();
    const target = createMixer(() => context, memoryStorage());
    expect(playSfx("lap", target)).toBe(false);
    target.unlock();
    let now = 0;
    for (const name of sfxNames)
      expect(playSfx(name, target, (now += 1000)), name).toBe(true);
    target.set({ muted: true });
    expect(playSfx("lap", target, (now += 1000))).toBe(false);
  });

  it("merges rapid repeats of busy effects", () => {
    const target = createMixer(() => fakeAudioContext().context, memoryStorage());
    target.unlock();
    expect(playSfx("bump", target, 10_000)).toBe(true);
    expect(playSfx("bump", target, 10_100)).toBe(false);
    expect(playSfx("bump", target, 10_400)).toBe(true);
  });
});

describe("music themes", () => {
  const ids = Object.keys(themes) as ThemeId[];

  it("keeps every theme's patterns the right length", () => {
    for (const id of ids) {
      const theme = themes[id];
      expect(theme.bass.trim().split(/\s+/), id).toHaveLength(8);
      expect(theme.arp.trim().split(/\s+/), id).toHaveLength(16);
      for (const bar of theme.lead) expect(bar.trim().split(/\s+/), id).toHaveLength(8);
      for (const drum of Object.values(theme.drums)) expect(drum, id).toHaveLength(16);
      expect(theme.lead.length, id).toBe(theme.progression.length);
    }
  });

  it("places every pitched note in the theme's scale and inside the bar", () => {
    for (const id of ids) {
      const theme = themes[id];
      const allowed = new Set(
        Array.from(
          { length: 7 },
          (_, d) => (degreeMidi(theme, theme.root, d) - theme.root) % 12,
        ),
      );
      for (let bar = 0; bar < theme.progression.length; bar++)
        for (const note of barEvents(theme, bar)) {
          expect(note.beat, id).toBeGreaterThanOrEqual(0);
          expect(note.beat + note.beats, id).toBeLessThanOrEqual(4.01);
          if (note.midi !== undefined) {
            expect(
              allowed.has((((note.midi - theme.root) % 12) + 12) % 12),
              `${id} ${note.midi}`,
            ).toBe(true);
            expect(note.midi).toBeGreaterThan(24);
            expect(note.midi).toBeLessThan(108);
          }
        }
    }
  });

  it("holds a lead note across dashes and loops after the last bar", () => {
    const theme = themes["party-ring-v1"];
    const finalBar = barEvents(theme, 7).filter((n) => n.voice === "lead");
    expect(finalBar[0]).toMatchObject({ beat: 0, beats: 1.95 });
    expect(barEvents(theme, 8)).toEqual(barEvents(theme, 0));
    expect(degreeMidi(theme, 60, -1)).toBe(59);
    expect(barSeconds(theme)).toBeCloseTo(1.6);
    expect(raceTheme("harbour-v1")).toBe("harbour-v1");
    expect(raceTheme("unknown")).toBe("party-ring-v1");
  });
});

describe("music player", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for unlock, then schedules a theme ahead and switches cleanly", () => {
    const { context, oscillators } = fakeAudioContext();
    const target = createMixer(() => context, memoryStorage());
    const player = createMusicPlayer(target);
    player.play("menu");
    expect(player.playing).toBeNull();
    target.unlock();
    expect(player.playing).toBe("menu");
    expect(oscillators.length).toBeGreaterThan(0);
    const scheduled = oscillators.length;
    // A bar of the menu theme lasts about 2.2 seconds; move past it.
    context.currentTime += 3;
    act(() => vi.advanceTimersByTime(100));
    expect(oscillators.length).toBeGreaterThan(scheduled);
    player.play("harbour-v1");
    expect(player.playing).toBe("harbour-v1");
    player.setTempo(1.1);
    player.stop();
    expect(player.playing).toBeNull();
    const stopped = oscillators.length;
    context.currentTime += 2;
    act(() => vi.advanceTimersByTime(500));
    expect(oscillators.length).toBe(stopped);
    player.dispose();
  });
});

describe("sound settings", () => {
  it("toggles sound and sets each volume through the mixer", () => {
    const target = createMixer(() => fakeAudioContext().context, memoryStorage());
    render(<SoundSettings target={target} />);
    fireEvent.click(screen.getByLabelText("Sound on"));
    expect(target.prefs.muted).toBe(true);
    expect((screen.getByLabelText(/Music/) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Sound on"));
    expect(target.prefs.muted).toBe(false);
    expect(target.ready).toBe(true);
    fireEvent.change(screen.getByLabelText(/Music/), { target: { value: "20" } });
    expect(target.prefs.music).toBe(0.2);
    fireEvent.change(screen.getByLabelText(/Effects/), { target: { value: "60" } });
    expect(target.prefs.sfx).toBe(0.6);
  });

  it("opens from a sound button that names its state, and closes on Escape", () => {
    const target = createMixer(() => fakeAudioContext().context, memoryStorage());
    render(<SoundButton target={target} />);
    const button = screen.getByRole("button", { name: /Sound on/ });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Sound settings" })).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
