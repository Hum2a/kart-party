import { describe, expect, it } from "vitest";
import {
  RaceSession,
  finishGraceMs,
  clientMessageSchema,
  roomCodeSchema,
  nicknameSchema,
  parkTrackId,
  harbourTrackId,
  kartPaints,
  defaultKartPaint,
  kartPaintHex,
  type KartInput,
} from "../src/index.ts";

const setup = {
  raceId: "race-1",
  players: [
    { playerId: "p-aaaaaaaa", name: "Ada" },
    { playerId: "p-bbbbbbbb", name: "Bo" },
  ],
  trackId: parkTrackId,
  laps: 1 as const,
  cpu: 2,
  items: true,
};
const gas = (sequence: number, raceId = "race-1"): KartInput => ({
  raceId,
  sequence,
  steer: 0,
  gas: true,
  brake: false,
  drift: false,
});

describe("RaceSession", () => {
  it("seeds a device-timed grid with humans ahead of CPU racers", () => {
    const session = RaceSession.create(setup);
    expect(session.race.timingMode).toBe("device-v1");
    expect(session.race.launchVersion).toBe(1);
    expect(session.race.drivers.map((d) => Boolean(d.cpu))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("paces controls, refuses stale sequences and foreign races", () => {
    const session = RaceSession.create(setup);
    expect(session.input("p-aaaaaaaa", gas(1), 0)).toBe(true);
    expect(session.input("p-aaaaaaaa", gas(2), 10)).toBe(false);
    expect(session.input("p-aaaaaaaa", gas(1), 100)).toBe(false);
    expect(session.input("p-aaaaaaaa", gas(3, "other"), 200)).toBe(false);
    expect(session.input("cpu-1", gas(4), 300)).toBe(false);
    expect(session.input("p-nobody00", gas(5), 300)).toBe(false);
    expect(session.input("p-aaaaaaaa", { nonsense: true }, 400)).toBe(false);
  });

  it("moves a kart that holds the throttle and leaves an idle kart parked", () => {
    const session = RaceSession.create(setup);
    const start = session.race.drivers.map((d) => ({ x: d.x, z: d.z }));
    for (let t = 0, seq = 1; t <= 3000; t += 100, seq++) {
      session.input("p-aaaaaaaa", gas(seq), t);
      session.tick(t);
    }
    const [ada, bo] = session.race.drivers;
    expect(Math.hypot(ada!.x - start[0]!.x, ada!.z - start[0]!.z)).toBeGreaterThan(10);
    expect(Math.hypot(bo!.x - start[1]!.x, bo!.z - start[1]!.z)).toBeLessThan(0.01);
  });

  it("accepts one device finish per racer and ends the race after the grace period", () => {
    const session = RaceSession.create(setup);
    session.tick(40_000);
    expect(
      session.finish("p-aaaaaaaa", {
        raceId: "race-1",
        elapsedMs: 39_000,
        lapsMs: [39_000],
      }),
    ).toEqual({ ok: true });
    expect(
      session.finish("p-aaaaaaaa", {
        raceId: "race-1",
        elapsedMs: 39_500,
        lapsMs: [39_500],
      }),
    ).toMatchObject({ ok: false });
    expect(
      session.finish("p-bbbbbbbb", { raceId: "race-1", elapsedMs: 1, lapsMs: [1, 2] }),
    ).toMatchObject({ ok: false });
    session.tick(39_000 + finishGraceMs - 100);
    expect(session.race.ended).toBe(false);
    session.tick(39_000 + finishGraceMs);
    expect(session.race.ended).toBe(true);
    const view = session.view("p-aaaaaaaa");
    const ada = view.leaderboard.findIndex((row) => row.playerId === "p-aaaaaaaa");
    const bo = view.leaderboard.findIndex((row) => row.playerId === "p-bbbbbbbb");
    // A finisher always ranks above a racer who never crossed the line.
    expect(ada).toBeGreaterThanOrEqual(0);
    expect(ada).toBeLessThan(bo);
  });

  it("ends as soon as every human has finished", () => {
    const session = RaceSession.create({ ...setup, trackId: harbourTrackId });
    session.tick(50_000);
    session.finish("p-aaaaaaaa", {
      raceId: "race-1",
      elapsedMs: 48_000,
      lapsMs: [48_000],
    });
    session.finish("p-bbbbbbbb", {
      raceId: "race-1",
      elapsedMs: 49_000,
      lapsMs: [49_000],
    });
    expect(session.race.ended).toBe(true);
  });

  it("stops item boxes from spawning when items are off", () => {
    const session = RaceSession.create({ ...setup, items: false });
    expect(session.race.itemsWorld?.spawning).toBe(false);
    expect(session.useItem("p-aaaaaaaa", "race-1", 100)).toMatchObject({ ok: false });
  });

  it("survives a JSON round trip mid-race", () => {
    const session = RaceSession.create(setup);
    for (let t = 0, seq = 1; t <= 1000; t += 100, seq++) {
      session.input("p-aaaaaaaa", gas(seq), t);
      session.tick(t);
    }
    const restored = new RaceSession(JSON.parse(JSON.stringify(session.race)));
    expect(restored.tick(1500)).toEqual(session.tick(1500));
  });
});

describe("protocol", () => {
  it("normalises room codes and refuses ambiguous letters", () => {
    expect(roomCodeSchema.parse(" abcd ")).toBe("ABCD");
    expect(roomCodeSchema.safeParse("ABIO").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABC").success).toBe(false);
  });
  it("trims names and refuses markup and control characters", () => {
    expect(nicknameSchema.parse("  Zed ")).toBe("Zed");
    expect(nicknameSchema.safeParse("<b>").success).toBe(false);
    expect(nicknameSchema.safeParse("a\u0007").success).toBe(false);
    expect(nicknameSchema.safeParse("x".repeat(17)).success).toBe(false);
  });
  it("accepts only known client messages", () => {
    expect(clientMessageSchema.safeParse({ type: "ping", t: 1 }).success).toBe(true);
    expect(
      clientMessageSchema.safeParse({ type: "start", requestId: "r1" }).success,
    ).toBe(true);
    expect(clientMessageSchema.safeParse({ type: "start" }).success).toBe(false);
    expect(
      clientMessageSchema.safeParse({ type: "cheat", requestId: "r1" }).success,
    ).toBe(false);
  });
});

describe("phase 1 race options", () => {
  it("offers no items, the classic three, or every item with catch-up luck", () => {
    const off = RaceSession.create({ ...setup, items: "off" });
    expect(off.race.itemsWorld?.spawning).toBe(false);
    const classic = RaceSession.create({ ...setup, items: "classic" });
    expect(classic.race.itemRules).toEqual({ version: 1 });
    const all = RaceSession.create({ ...setup, items: "all" });
    expect(all.race.itemRules).toMatchObject({ version: 2, luck: "position" });
    expect(
      all.race.itemRules?.version === 2 && all.race.itemRules.allowed,
    ).toHaveLength(7);
    // Older rooms stored a boolean.
    expect(RaceSession.create({ ...setup, items: true }).race.itemRules).toMatchObject({
      version: 2,
    });
  });

  it("switches on effects and the daylight look for every race", () => {
    const view = RaceSession.create(setup).view("p-aaaaaaaa");
    expect(view.effectsEnabled).toBe(true);
    expect(view.look).toBe("daylight");
  });

  it("makes CPU racers slower on easy and quicker on hard, in the same order", () => {
    const skills = (cpuLevel: "easy" | "normal" | "hard") =>
      RaceSession.create({ ...setup, cpu: 7, cpuLevel })
        .race.drivers.filter((d) => d.cpu)
        .map((d) => d.skill!);
    const [easy, normal, hard] = [skills("easy"), skills("normal"), skills("hard")];
    easy.forEach((skill, i) => {
      expect(skill).toBeLessThan(normal[i]!);
      expect(normal[i]!).toBeLessThan(hard[i]!);
    });
  });

  it("hard CPU racers finish a lap sooner than easy ones", () => {
    const lap = (cpuLevel: "easy" | "hard") => {
      const session = RaceSession.create({
        ...setup,
        players: [],
        cpu: 1,
        cpuLevel,
        items: "off",
      });
      for (let t = 0; t <= 120_000 && !session.race.ended; t += 100) session.tick(t);
      return session.race.drivers[0]!.lapTimeMs ?? Infinity;
    };
    expect(lap("hard")).toBeLessThan(lap("easy"));
  });
});

describe("kart paint", () => {
  it("names every paint and gives unchosen racers a varied default", () => {
    expect(kartPaints).toHaveLength(8);
    expect(new Set(kartPaints.map((p) => p.hex)).size).toBe(8);
    expect(defaultKartPaint(0)).not.toBe(defaultKartPaint(1));
    expect(defaultKartPaint(8)).toBe(defaultKartPaint(0));
    expect(kartPaintHex("lagoon")).toBe("#2fd4c4");
    expect(
      clientMessageSchema.safeParse({
        type: "driver",
        requestId: "r",
        style: "dj",
        paint: "grape",
      }).success,
    ).toBe(true);
    expect(
      clientMessageSchema.safeParse({
        type: "driver",
        requestId: "r",
        style: "dj",
        paint: "gold",
      }).success,
    ).toBe(false);
  });
});
