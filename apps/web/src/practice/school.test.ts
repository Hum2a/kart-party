import { describe, expect, it } from "vitest";
import {
  advanceSchool,
  schoolDone,
  schoolFastMs,
  schoolInstruction,
  schoolSpeed,
  schoolStart,
  schoolSteps,
  skipSchoolStep,
  type SchoolSample,
} from "./school";
import { bindKey, defaultKeyBindings } from "../settings/settings";

const idle: SchoolSample = {
  speed: 0,
  steer: 0,
  driftLevel: 0,
  boosting: false,
  itemHeld: false,
  itemUsed: false,
  recovered: false,
};

describe("driving school", () => {
  it("walks through every step from what the race shows", () => {
    let p = schoolStart;
    // Accelerate: stay at speed long enough; a slow moment does not count.
    p = advanceSchool(p, { ...idle, speed: schoolSpeed }, schoolFastMs / 2);
    p = advanceSchool(p, { ...idle, speed: 2 }, 5000);
    expect(p.step).toBe(0);
    p = advanceSchool(p, { ...idle, speed: schoolSpeed + 1 }, schoolFastMs / 2);
    expect(schoolSteps[p.step]).toBe("steer");
    // Steer: left and right while moving. Steering on the spot does not count.
    p = advanceSchool(p, { ...idle, steer: -1 }, 100);
    expect(p.steeredLeft).toBe(false);
    p = advanceSchool(p, { ...idle, speed: 5, steer: -0.6 }, 100);
    expect(p.steeredLeft).toBe(true);
    expect(p.step).toBe(1);
    p = advanceSchool(p, { ...idle, speed: 5, steer: 0.6 }, 100);
    expect(schoolSteps[p.step]).toBe("drift");
    p = advanceSchool(p, { ...idle, driftLevel: 1 }, 100);
    expect(schoolSteps[p.step]).toBe("boost");
    p = advanceSchool(p, { ...idle, boosting: true }, 100);
    expect(schoolSteps[p.step]).toBe("item");
    // Holding an item is not enough; it has to be used.
    p = advanceSchool(p, { ...idle, itemHeld: true }, 100);
    expect(schoolSteps[p.step]).toBe("item");
    p = advanceSchool(p, { ...idle, itemUsed: true }, 100);
    expect(schoolSteps[p.step]).toBe("recover");
    p = advanceSchool(p, { ...idle, recovered: true }, 100);
    expect(schoolDone(p)).toBe(true);
    // Done stays done.
    expect(advanceSchool(p, { ...idle, recovered: true }, 100)).toBe(p);
  });

  it("only counts a step's own action", () => {
    // A boost before the boost step does not skip ahead.
    const p = advanceSchool(
      schoolStart,
      { ...idle, boosting: true, recovered: true },
      10,
    );
    expect(p.step).toBe(0);
  });

  it("lets a racer skip a step", () => {
    let p = schoolStart;
    for (let i = 0; i < schoolSteps.length; i++) p = skipSchoolStep(p);
    expect(schoolDone(p)).toBe(true);
    expect(skipSchoolStep(p)).toBe(p);
  });

  it("names the racer's own keys, or the touch controls on a phone", () => {
    const keys = bindKey(defaultKeyBindings, "gas", "i");
    expect(schoolInstruction("accelerate", keys, false)).toContain("I or ↑");
    expect(schoolInstruction("accelerate", keys, true)).toContain("Accelerate");
    expect(schoolInstruction("item", keys, false)).toContain("floating boxes");
    expect(schoolInstruction("item", keys, false, true)).toContain("Press E");
    expect(schoolInstruction("recover", keys, true)).toContain("Back to track");
  });
});
