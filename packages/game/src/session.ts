import {
  createKartRace,
  reduceKart,
  reduceKartTimeline,
  kartItemRefusal,
  projectKartRace,
  kartStandings,
  type KartRace,
  type KartTimedInput,
} from "./kart/kart.ts";
import {
  kartInputGapMs,
  kartInputSchema,
  type KartRaceView,
  type KartTrackId,
  type KartLaps,
} from "./kart/kart-race-schema.ts";
import { kartFinishSchema } from "./kart/kart-rollback-schema.ts";
import { isKartCpuId, type KartCpuLevel } from "./kart/kart-cpu.ts";
import type { KartSpeedClass } from "./kart/kart-driving.ts";
import { kartItemSchema, type KartItem } from "./kart/kart-powers.ts";
import type { KartItemRules } from "./kart/kart-item-rules.ts";
import type { RaceResult } from "./protocol.ts";

/** After the first racer crosses the line, everyone else has this long to finish. */
export const finishGraceMs = 30_000;

export const raceItemModes = ["off", "classic", "all"] as const;
export type RaceItemMode = (typeof raceItemModes)[number];

/** Every item, with boxes favouring catch-up items for racers at the back. */
export const allItemRules: KartItemRules = {
  version: 2,
  allowed: [...kartItemSchema.options] as KartItem[],
  luck: "position",
};
/** Turbo, Bubble shield and Oil slick on a fixed rotation. */
export const classicItemRules: KartItemRules = { version: 1 };

export type RaceSetup = {
  raceId: string;
  players: readonly { playerId: string; name: string }[];
  trackId: KartTrackId;
  laps: KartLaps;
  cpu: number;
  cpuLevel?: KartCpuLevel;
  speedClass?: KartSpeedClass;
  /** Older callers pass a boolean: true is every item, false is none. */
  items: RaceItemMode | boolean;
};

export function raceItemMode(items: RaceSetup["items"]): RaceItemMode {
  return items === true ? "all" : items === false ? "off" : items;
}

type Queue = { at: number; lastSequence: number; pending: KartTimedInput[] };
export type SessionResult = { ok: true } | { ok: false; message: string };

/**
 * One race, driven by injected race time (milliseconds since GO). Both the
 * online room and offline practice run a race through this class, so the two
 * modes share every rule: input pacing, device finishes, items and recovery.
 *
 * The race itself is plain JSON and is the only durable state. Queued controls
 * live in memory and are folded into the race on the next tick; a restart
 * loses at most one tick of steering, never an accepted finish.
 */
export class RaceSession {
  race: KartRace;
  private queues = new Map<string, Queue>();

  constructor(race: KartRace) {
    this.race = race;
  }

  static create(setup: RaceSetup): RaceSession {
    const items = raceItemMode(setup.items);
    let race = createKartRace(setup.raceId, setup.players, {
      seedGrid: true,
      trackId: setup.trackId,
      laps: setup.laps,
      cpu: setup.cpu,
      cpuLevel: setup.cpuLevel ?? "normal",
      speedClass: setup.speedClass ?? "100",
      itemRules: items === "all" ? allItemRules : classicItemRules,
    });
    // The first throttle after GO can earn a start boost.
    race.launchVersion = 1;
    // Each device times its own finish; the session still owns membership and places.
    race.timingMode = "device-v1";
    race.opponentsEnabled = true;
    race.recapVersion = 1;
    // Effects and the daylight look are on; each device still scales them to its graphics tier.
    race.effectsEnabled = true;
    race.look = "daylight";
    if (items === "off")
      race = reduceKart(race, { type: "items-spawning", enabled: false });
    return new RaceSession(race);
  }

  /** A human still racing in this race. CPU karts never take controls. */
  private racing(playerId: string) {
    return this.race.drivers.some(
      (driver) =>
        driver.playerId === playerId && !driver.cpu && driver.status === "RACING",
    );
  }

  /** Queue one control message, stamped with the race time it arrived. */
  input(playerId: string, raw: unknown, elapsedMs: number): boolean {
    const parsed = kartInputSchema.safeParse(raw);
    if (
      !parsed.success ||
      this.race.ended ||
      isKartCpuId(playerId) ||
      parsed.data.raceId !== this.race.raceId ||
      !this.racing(playerId) ||
      !Number.isFinite(elapsedMs)
    )
      return false;
    const previous = this.queues.get(playerId);
    if (
      previous &&
      (elapsedMs - previous.at < kartInputGapMs ||
        parsed.data.sequence <= previous.lastSequence)
    )
      return false;
    const at = Math.max(this.race.elapsedMs, Math.floor(elapsedMs));
    this.queues.set(playerId, {
      at: elapsedMs,
      lastSequence: parsed.data.sequence,
      pending: [
        ...(previous?.pending ?? []),
        { playerId, elapsed: at, input: parsed.data },
      ].slice(-4),
    });
    return true;
  }

  /** Fold queued controls into the race and step it to `elapsedMs`. */
  tick(elapsedMs: number): KartRace {
    const pending = [...this.queues.values()].flatMap((queue) => queue.pending);
    for (const queue of this.queues.values()) queue.pending = [];
    let next = reduceKartTimeline(this.race, pending, elapsedMs);
    const first = next.drivers
      .filter((driver) => !driver.cpu && driver.status === "FINISHED")
      .map((driver) => driver.lapTimeMs ?? Infinity)
      .reduce((a, b) => Math.min(a, b), Infinity);
    if (
      !next.ended &&
      Number.isFinite(first) &&
      next.elapsedMs >= first + finishGraceMs
    )
      next = reduceKart(next, { type: "end" });
    this.race = next;
    return next;
  }

  /** A device-timed finish. The session checks identity, race and lap count. */
  finish(playerId: string, raw: unknown): SessionResult {
    const report = kartFinishSchema.safeParse(raw);
    if (!report.success)
      return { ok: false, message: "Invalid finish time or lap splits." };
    if (this.race.ended || report.data.raceId !== this.race.raceId)
      return { ok: false, message: "That race has already ended." };
    const next = reduceKart(this.race, {
      type: "device-finish",
      playerId,
      ...report.data,
    });
    if (next === this.race)
      return { ok: false, message: "That finish cannot be accepted in this race." };
    this.race = next;
    this.queues.delete(playerId);
    return { ok: true };
  }

  useItem(playerId: string, raceId: string, elapsedMs: number): SessionResult {
    if (raceId !== this.race.raceId || !this.racing(playerId))
      return { ok: false, message: "Items work only while you are racing." };
    this.tick(elapsedMs);
    const refusal = kartItemRefusal(this.race, playerId);
    if (refusal) return { ok: false, message: refusal };
    const next = reduceKart(this.race, { type: "use-power", playerId });
    if (next === this.race)
      return { ok: false, message: "Drive through an item box first." };
    this.race = next;
    return { ok: true };
  }

  recover(playerId: string, raceId: string, elapsedMs: number): SessionResult {
    if (raceId !== this.race.raceId || !this.racing(playerId))
      return { ok: false, message: "Recovery works only while you are racing." };
    this.tick(elapsedMs);
    const next = reduceKart(this.race, { type: "recover", playerId });
    if (next === this.race)
      return { ok: false, message: "Wait two seconds before recovering again." };
    this.race = next;
    const queue = this.queues.get(playerId);
    if (queue) queue.pending = [];
    return { ok: true };
  }

  /** Freeze every kart, for example when the race is abandoned. */
  end(): KartRace {
    this.race = reduceKart(this.race, { type: "end" });
    this.queues.clear();
    return this.race;
  }

  forget(playerId: string): void {
    this.queues.delete(playerId);
  }

  view(selfPlayerId: string | null): KartRaceView {
    return projectKartRace(this.race, selfPlayerId, 0);
  }
}

/** Final places for the results screen: humans and CPU racers, in finishing order. */
export function raceResults(race: KartRace): RaceResult[] {
  return kartStandings(race, 0).map((row) => ({
    playerId: row.playerId,
    name: row.name,
    place: row.place,
    timeMs:
      row.finished && typeof row.timeMs === "number" ? Math.round(row.timeMs) : null,
    cpu: Boolean(row.cpu),
  }));
}
