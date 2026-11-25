import { createPolylineTrack, roundedCentreline } from "./kart-polyline.ts";
import { beachTrackId } from "./kart-track-ids.ts";

/**
 * Sunset Strand: a long, wide seafront loop with boost lanes on the straights,
 * a headland with a dune jump, and a narrow boardwalk across the bay that is
 * shorter but has a crab on it. Original layout.
 */
export { beachTrackId };
export const beachRoadHalfWidth = 12;
export const beachTrack = createPolylineTrack(
  beachTrackId,
  roundedCentreline(
    [
      [0, 0],
      [0, -150],
      [110, -150, 28],
      [110, -210, 28],
      [240, -210, 28],
      [240, -150, 28],
      [330, -150],
      [330, 90],
      [0, 90],
    ],
    40,
  ),
  {
    halfWidth: beachRoadHalfWidth,
    itemStations: 8,
    course: [
      { kind: "hazard", at: [0, -90], sway: 5, swayMs: 1500 },
      { kind: "boost", at: [175, -210], lateral: -5, width: 4, length: 18 },
      { kind: "boost", at: [330, -50], width: 4, length: 18 },
      { kind: "boost", at: [190, 90], lateral: 4, width: 4, length: 18 },
      { kind: "ramp", at: [95, 90], width: 6, lift: 1.3 },
      {
        kind: "hazard",
        at: 0.5,
        on: "beach-v1-boardwalk",
        sway: 3,
        swayMs: 1100,
        width: 2.5,
        length: 3,
      },
    ],
    branches: [
      {
        id: "beach-v1-boardwalk",
        name: "Boardwalk",
        kind: "alternate",
        from: [70, -150],
        to: [285, -150],
        halfWidth: 5.5,
      },
    ],
  },
);
