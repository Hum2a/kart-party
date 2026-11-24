import { expect, it } from "vitest";
import { createRaceAudio } from "./race-audio";
import { createMixer } from "../audio/mixer";
import { fakeAudioContext, memoryStorage } from "../audio/fake-context.test-support";

it("stays silent until audio is unlocked, then follows speed and boosts", () => {
  const { context, oscillators } = fakeAudioContext();
  const target = createMixer(() => context, memoryStorage());
  const audio = createRaceAudio(target);
  audio.engine(0.5, true);
  audio.cue("lap");
  expect(context.createOscillator).not.toHaveBeenCalled();
  expect(audio.enabled).toBe(false);
  expect(audio.enable()).toBe(true);
  expect(audio.enabled).toBe(true);
  expect(context.resume).toHaveBeenCalled();
  audio.engine(1, true);
  // Two detuned oscillators make the engine note; speed sets their pitch.
  expect(oscillators.slice(0, 2).map((o) => o.type)).toEqual(["sawtooth", "square"]);
  expect(oscillators[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
    190,
    1,
    0.08,
  );
  audio.engine(1, true, true);
  expect(oscillators[0]!.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
    230,
    1,
    0.08,
  );
  const before = context.createOscillator.mock.calls.length;
  audio.cue("lap");
  expect(context.createOscillator.mock.calls.length).toBeGreaterThan(before);
});

it("mutes through the shared mixer and plays nothing while muted", () => {
  const { context } = fakeAudioContext();
  const target = createMixer(() => context, memoryStorage());
  const audio = createRaceAudio(target);
  audio.enable();
  audio.disable();
  expect(target.prefs.muted).toBe(true);
  expect(audio.enabled).toBe(false);
  const before = context.createOscillator.mock.calls.length;
  audio.cue("finish");
  expect(context.createOscillator.mock.calls.length).toBe(before);
  audio.enable();
  expect(target.prefs.muted).toBe(false);
});

it("reports no sound where the browser has no Web Audio", () => {
  const audio = createRaceAudio(createMixer(() => null, memoryStorage()));
  expect(audio.enable()).toBe(false);
  audio.engine(1, true);
  audio.cue("go" as never);
  audio.dispose();
});
