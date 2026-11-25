import { z } from "zod";
import { kartLimitMs, kartTrackId, type KartTrackId } from "./kart-race-schema.ts";
import { polylineTrackLimitMs } from "./kart-route.ts";
import { ringBounds } from "./kart-driving.ts";
import { ringItemBoxes } from "./kart-powers.ts";
import { ringCourse } from "./kart-course.ts";
import { parkTrackId } from "./kart-park.ts";
import { harbourTrackId } from "./kart-harbour.ts";
import { beachTrackId, cityTrackId, summitTrackId } from "./kart-track-ids.ts";
import { polylineTracks } from "./kart-polyline-tracks.ts";

export const kartTrackIds = [
  kartTrackId,
  parkTrackId,
  harbourTrackId,
  cityTrackId,
  summitTrackId,
  beachTrackId,
] as const;
export const kartTrackIdSchema = z.enum(kartTrackIds);

export const kartTrackDefinitionSchema = z
  .object({
    id: kartTrackIdSchema,
    name: z.string().min(1).max(60),
    blurb: z.string().min(1).max(160),
    difficulty: z.enum(["easy", "medium", "hard"]),
    route: z
      .object({
        kind: z.enum(["polyline", "ring"]),
        metres: z.number().finite().positive(),
        segments: z.number().int().positive(),
      })
      .strict(),
    // The race view carries at most 24 boxes (kartPowerViewSchema).
    itemBoxes: z.number().int().min(0).max(24),
    features: z
      .object({
        boosts: z.number().int().nonnegative(),
        ramps: z.number().int().nonnegative(),
        hazards: z.number().int().nonnegative(),
        shortcuts: z.number().int().nonnegative(),
        alternates: z.number().int().nonnegative(),
        bridges: z.number().int().nonnegative(),
      })
      .strict(),
    lapLimitMs: z.number().int().positive(),
  })
  .strict();
export type KartTrackDefinition = z.infer<typeof kartTrackDefinitionSchema>;

const features = (
  course: readonly { kind: string }[],
  track?: (typeof polylineTracks)[string],
) => ({
  boosts: course.filter((f) => f.kind === "boost").length,
  ramps: course.filter((f) => f.kind === "ramp").length,
  hazards: course.filter((f) => f.kind === "hazard").length,
  shortcuts: track?.branches.filter((b) => b.kind === "shortcut").length ?? 0,
  alternates: track?.branches.filter((b) => b.kind === "alternate").length ?? 0,
  bridges: track?.narrows.filter((n) => n.bridge).length ?? 0,
});

const polyline = (
  id: Exclude<KartTrackId, typeof kartTrackId>,
  name: string,
  blurb: string,
  difficulty: KartTrackDefinition["difficulty"],
): KartTrackDefinition => {
  const track = polylineTracks[id]!;
  return {
    id,
    name,
    blurb,
    difficulty,
    route: {
      kind: "polyline",
      metres: track.route.lapLength,
      segments: track.route.points.length - 1,
    },
    itemBoxes: track.itemBoxes.length,
    features: features(track.course, track),
    lapLimitMs: polylineTrackLimitMs,
  };
};

/** Every installed course, in menu order. All of them are original layouts. */
export const kartTrackCatalogue: readonly KartTrackDefinition[] = z
  .array(kartTrackDefinitionSchema)
  .length(kartTrackIds.length)
  .parse([
    {
      id: kartTrackId,
      name: "Party Ring",
      blurb: "A short banked loop. Learn to drift and chain boosts.",
      difficulty: "easy",
      route: { kind: "ring", metres: Math.PI * 2 * 42, segments: ringBounds.segments },
      itemBoxes: ringItemBoxes.length,
      features: features(ringCourse),
      lapLimitMs: kartLimitMs,
    },
    polyline(
      parkTrackId,
      "Parkside",
      "Wide straights, sweeping bends and a gentle S through the park.",
      "medium",
    ),
    polyline(
      harbourTrackId,
      "Harbour Hairpins",
      "A long dock straight into two tight hairpins, a chicane and a fast sweeper home.",
      "hard",
    ),
    polyline(
      cityTrackId,
      "Neon Blocks",
      "Right angles round city blocks, sliding barriers and a building-site shortcut for boosters.",
      "hard",
    ),
    polyline(
      summitTrackId,
      "Summit Switchback",
      "Hairpins up the mountain, a jump over the top, rolling boulders and a narrow bridge.",
      "hard",
    ),
    polyline(
      beachTrackId,
      "Sunset Strand",
      "A long seafront loop with boost lanes, a dune jump and a boardwalk across the bay.",
      "easy",
    ),
  ]);

export const kartTrackName = (id: KartTrackId | undefined): string =>
  kartTrackCatalogue.find((track) => track.id === (id ?? kartTrackId))?.name ??
  "Party Ring";
