import { z } from "zod";
import { kartLimitMs, kartTrackId, type KartTrackId } from "./kart-race-schema.ts";
import { polylineTrackLimitMs } from "./kart-route.ts";
import { ringBounds } from "./kart-driving.ts";
import { ringItemBoxes } from "./kart-powers.ts";
import { ringCourse } from "./kart-course.ts";
import { parkTrackId } from "./kart-park.ts";
import { harbourTrackId } from "./kart-harbour.ts";
import { polylineTracks } from "./kart-polyline-tracks.ts";

export const kartTrackIds = [kartTrackId, parkTrackId, harbourTrackId] as const;
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
    itemBoxes: z.number().int().min(0).max(32),
    features: z
      .object({
        boosts: z.number().int().nonnegative(),
        ramps: z.number().int().nonnegative(),
        hazards: z.number().int().nonnegative(),
      })
      .strict(),
    lapLimitMs: z.number().int().positive(),
  })
  .strict();
export type KartTrackDefinition = z.infer<typeof kartTrackDefinitionSchema>;

const features = (course: readonly { kind: string }[]) => ({
  boosts: course.filter((f) => f.kind === "boost").length,
  ramps: course.filter((f) => f.kind === "ramp").length,
  hazards: course.filter((f) => f.kind === "hazard").length,
});

const polyline = (
  id: typeof parkTrackId | typeof harbourTrackId,
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
    features: features(track.course),
    lapLimitMs: polylineTrackLimitMs,
  };
};

/** Every installed course, in menu order. All three are original layouts. */
export const kartTrackCatalogue: readonly KartTrackDefinition[] = z
  .array(kartTrackDefinitionSchema)
  .length(3)
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
  ]);

export const kartTrackName = (id: KartTrackId | undefined): string =>
  kartTrackCatalogue.find((track) => track.id === (id ?? kartTrackId))?.name ??
  "Party Ring";
