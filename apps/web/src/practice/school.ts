import { keysText, type KeyBindings } from "../settings/settings";

/** The driving school, in order. Each step is a short thing to do on the track. */
export const schoolSteps = [
  "accelerate",
  "steer",
  "drift",
  "boost",
  "item",
  "recover",
] as const;
export type SchoolStep = (typeof schoolSteps)[number];

export const schoolTitle: Record<SchoolStep, string> = {
  accelerate: "Accelerate",
  steer: "Steer",
  drift: "Drift",
  boost: "Boost",
  item: "Use an item",
  recover: "Back on the track",
};

/** What the school reads from the race each tick. Nothing here is authority. */
export type SchoolSample = {
  speed: number;
  /** The steering this device is sending, -1 to 1. */
  steer: number;
  driftLevel: number;
  boosting: boolean;
  itemHeld: boolean;
  /** The room accepted an item use since the last sample. */
  itemUsed: boolean;
  /** The room accepted a recovery since the last sample. */
  recovered: boolean;
};

export type SchoolProgress = {
  /** Index into `schoolSteps`; equal to its length when the school is done. */
  step: number;
  /** Time spent at speed, for the first step. */
  fastMs: number;
  steeredLeft: boolean;
  steeredRight: boolean;
};

export const schoolStart: SchoolProgress = {
  step: 0,
  fastMs: 0,
  steeredLeft: false,
  steeredRight: false,
};

/**
 * Fast enough to count as accelerating, in metres a second: about two thirds
 * of top speed in the school's 50cc class, which tops out near 9.5.
 */
export const schoolSpeed = 6;
/** Stay at that speed this long. */
export const schoolFastMs = 800;

export const schoolDone = (progress: SchoolProgress) =>
  progress.step >= schoolSteps.length;

const next = (progress: SchoolProgress): SchoolProgress => ({
  ...schoolStart,
  step: progress.step + 1,
});

/** One step forward when the sample shows the current step was done. Pure. */
export function advanceSchool(
  progress: SchoolProgress,
  sample: SchoolSample,
  dtMs: number,
): SchoolProgress {
  const step = schoolSteps[progress.step];
  if (!step) return progress;
  switch (step) {
    case "accelerate": {
      const fastMs =
        sample.speed >= schoolSpeed
          ? progress.fastMs + Math.max(0, dtMs)
          : progress.fastMs;
      return fastMs >= schoolFastMs ? next(progress) : { ...progress, fastMs };
    }
    case "steer": {
      const moving = sample.speed >= 3;
      const steeredLeft = progress.steeredLeft || (moving && sample.steer <= -0.4);
      const steeredRight = progress.steeredRight || (moving && sample.steer >= 0.4);
      return steeredLeft && steeredRight
        ? next(progress)
        : { ...progress, steeredLeft, steeredRight };
    }
    case "drift":
      return sample.driftLevel >= 1 ? next(progress) : progress;
    case "boost":
      return sample.boosting ? next(progress) : progress;
    case "item":
      return sample.itemUsed ? next(progress) : progress;
    case "recover":
      return sample.recovered ? next(progress) : progress;
  }
}

/** Skip the current step, for anyone stuck or who knows it already. */
export const skipSchoolStep = (progress: SchoolProgress) =>
  schoolDone(progress) ? progress : next(progress);

/** What to do now, in words for keyboard and for touch. */
export function schoolInstruction(
  step: SchoolStep,
  keys: KeyBindings,
  touch: boolean,
  itemHeld = false,
): string {
  const k = (action: Parameters<typeof keysText>[1]) => keysText(keys, action);
  switch (step) {
    case "accelerate":
      return touch
        ? "Hold Accelerate, or push the thumb pad up, until you are up to speed."
        : `Hold ${k("gas")} until you are up to speed.`;
    case "steer":
      return touch
        ? "Slide the steering pad left, then right."
        : `Steer left with ${k("left")}, then right with ${k("right")}.`;
    case "drift":
      return touch
        ? "Hold Drift while you turn. Keep holding until the gauge fills its first bar."
        : `Hold ${k("drift")} while you turn. Keep holding until the gauge fills its first bar.`;
    case "boost":
      return touch
        ? "Charge a drift again, then let go of Drift for a boost."
        : `Charge a drift again, then let go of ${k("drift")} for a boost.`;
    case "item":
      if (!itemHeld)
        return "Drive through one of the floating boxes to pick up an item.";
      return touch
        ? "You have an item. Tap its Use button to fire it."
        : `You have an item. Press ${k("item")} to use it.`;
    case "recover":
      return touch
        ? "Lost or stuck? Tap Back to track to be put back on the road."
        : `Lost or stuck? Press ${k("recover")} to be put back on the road.`;
  }
}
