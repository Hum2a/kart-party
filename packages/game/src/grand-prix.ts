import { z } from "zod";
import { kartTrackId, type KartTrackId } from "./kart/kart-race-schema.ts";
import { parkTrackId } from "./kart/kart-park.ts";
import { harbourTrackId } from "./kart/kart-harbour.ts";
import { beachTrackId, cityTrackId, summitTrackId } from "./kart/kart-track-ids.ts";
import type { RaceResult } from "./protocol.ts";

/** Points for first to eighth. Ninth and below, and racers who do not finish, score nothing. */
export const grandPrixPoints = [15, 12, 10, 8, 6, 4, 2, 1] as const;

export type KartCup = {
  id: string;
  name: string;
  tracks: readonly KartTrackId[];
};
/** Cups in menu order. More arrive with more tracks. */
export const kartCups = [
  {
    id: "starter-cup",
    name: "Starter Cup",
    tracks: [kartTrackId, parkTrackId, harbourTrackId],
  },
  {
    id: "reverse-cup",
    name: "Hairpin Cup",
    tracks: [harbourTrackId, kartTrackId, parkTrackId],
  },
  {
    id: "coast-cup",
    name: "Coast Cup",
    tracks: [beachTrackId, parkTrackId, summitTrackId],
  },
  {
    id: "neon-cup",
    name: "Neon Cup",
    tracks: [cityTrackId, summitTrackId, harbourTrackId],
  },
  {
    id: "grand-tour",
    name: "Grand Tour",
    tracks: [
      kartTrackId,
      parkTrackId,
      beachTrackId,
      harbourTrackId,
      cityTrackId,
      summitTrackId,
    ],
  },
] as const satisfies readonly KartCup[];
export type KartCupId = (typeof kartCups)[number]["id"];
export const kartCupIdSchema = z.enum(
  kartCups.map((cup) => cup.id) as [KartCupId, ...KartCupId[]],
);
export const kartCup = (id: KartCupId): KartCup =>
  kartCups.find((cup) => cup.id === id) ?? kartCups[0];

/** Points one finishing position earns. */
export function pointsFor(result: Pick<RaceResult, "place" | "timeMs">): number {
  if (result.timeMs === null) return 0;
  return grandPrixPoints[result.place - 1] ?? 0;
}

export const grandPrixRowSchema = z
  .object({
    playerId: z.string().min(1).max(40),
    name: z.string().min(1).max(40),
    cpu: z.boolean(),
    points: z.number().int().nonnegative(),
    /** Points from each race so far, in race order; null if they missed that race. */
    races: z.array(z.number().int().nonnegative().nullable()).max(8),
    place: z.number().int().positive(),
  })
  .strict();
export type GrandPrixRow = z.infer<typeof grandPrixRowSchema>;

/**
 * The running Grand Prix table. Ties are split by most wins, then most second
 * places, and so on; a tie that survives every place stays tied.
 */
export function grandPrixTable(
  races: readonly (readonly RaceResult[])[],
): GrandPrixRow[] {
  const rows = new Map<
    string,
    {
      playerId: string;
      name: string;
      cpu: boolean;
      races: (number | null)[];
      places: number[];
    }
  >();
  races.forEach((results, raceIndex) => {
    for (const result of results) {
      const row = rows.get(result.playerId) ?? {
        playerId: result.playerId,
        name: result.name,
        cpu: result.cpu,
        races: Array.from({ length: races.length }, () => null),
        places: [],
      };
      row.name = result.name;
      row.races[raceIndex] = pointsFor(result);
      if (result.timeMs !== null) row.places.push(result.place);
      rows.set(result.playerId, row);
    }
  });
  const scored = [...rows.values()].map((row) => ({
    ...row,
    points: row.races.reduce<number>((sum, points) => sum + (points ?? 0), 0),
  }));
  const countback = (places: number[], place: number) =>
    places.filter((p) => p === place).length;
  const compare = (a: (typeof scored)[number], b: (typeof scored)[number]) => {
    if (b.points !== a.points) return b.points - a.points;
    for (let place = 1; place <= grandPrixPoints.length; place++) {
      const diff = countback(b.places, place) - countback(a.places, place);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  scored.sort(compare);
  let place = 1;
  return scored.map((row, i) => {
    if (i > 0 && compare(scored[i - 1]!, row) !== 0) place = i + 1;
    return {
      playerId: row.playerId,
      name: row.name,
      cpu: row.cpu,
      points: row.points,
      races: row.races,
      place,
    };
  });
}

export type GrandPrixState = { cupId: KartCupId; races: RaceResult[][] };

export const grandPrixRound = (state: GrandPrixState) => state.races.length;
export const grandPrixDone = (state: GrandPrixState) =>
  state.races.length >= kartCup(state.cupId).tracks.length;
/** The next track to race, or undefined once the cup is complete. */
export const grandPrixNextTrack = (state: GrandPrixState): KartTrackId | undefined =>
  kartCup(state.cupId).tracks[state.races.length];
