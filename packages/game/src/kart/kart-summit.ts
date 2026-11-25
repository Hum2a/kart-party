import { createPolylineTrack, roundedCentreline } from "./kart-polyline.ts";
import { summitTrackId } from "./kart-track-ids.ts";

/**
 * Summit Switchback: two hairpins up the mountain, a jump pad across the top,
 * boulders rolling over the road, a long descent over a narrow bridge and a
 * goat track that cuts the last bend if you carry a boost. Original layout.
 */
export { summitTrackId };
export const summitRoadHalfWidth = 10;
export const summitTrack = createPolylineTrack(
  summitTrackId,
  roundedCentreline(
    [
      [0, 0],
      [0, -130],
      [40, -130],
      [40, -40],
      [80, -40],
      [80, -160],
      [170, -160],
      [170, 70],
      [0, 70],
    ],
    18,
  ),
  {
    halfWidth: summitRoadHalfWidth,
    itemStations: 6,
    course: [
      { kind: "hazard", at: [0, -75], sway: 6, swayMs: 1700, width: 3.5, length: 3.5 },
      { kind: "boost", at: [40, -85], lateral: 3 },
      {
        kind: "hazard",
        at: [80, -100],
        sway: 6,
        swayMs: 1500,
        width: 3.5,
        length: 3.5,
      },
      { kind: "ramp", at: [125, -160], width: 6, lift: 1.6 },
      { kind: "boost", at: [170, -110], lateral: -3 },
      { kind: "ramp", at: [85, 70], width: 6, lift: 1.3 },
    ],
    narrows: [{ from: [170, -75], to: [170, -15], halfWidth: 5, bridge: true }],
    branches: [
      {
        id: "summit-v1-goat",
        name: "Goat track",
        kind: "shortcut",
        from: [170, 25],
        to: [125, 70],
        halfWidth: 4.5,
      },
    ],
  },
);
