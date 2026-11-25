import { createPolylineTrack, roundedCentreline } from "./kart-polyline.ts";
import { cityTrackId } from "./kart-track-ids.ts";

/**
 * Neon Blocks: tight right angles round city blocks, a dog-leg past the
 * market, barriers that slide across the street and a building-site shortcut
 * that only pays off with a boost. Original layout.
 */
export { cityTrackId };
export const cityRoadHalfWidth = 10;
export const cityTrack = createPolylineTrack(
  cityTrackId,
  roundedCentreline(
    [
      [0, 0],
      [0, -100],
      [70, -100],
      [70, -50],
      [130, -50],
      [130, -130],
      [200, -130],
      [200, 20],
      [110, 20],
      [110, 70],
      [0, 70],
    ],
    18,
  ),
  {
    halfWidth: cityRoadHalfWidth,
    itemStations: 7,
    course: [
      { kind: "boost", at: [0, -40], lateral: 3 },
      { kind: "hazard", at: [35, -100], sway: 6, swayMs: 1300, width: 2.5 },
      { kind: "hazard", at: [130, -95], sway: 6, swayMs: 1100, width: 2.5 },
      { kind: "boost", at: [200, -40], lateral: -3 },
      { kind: "hazard", at: [160, 20], sway: 6, swayMs: 1500, width: 2.5 },
      { kind: "ramp", at: [55, 70], lateral: 3 },
    ],
    branches: [
      {
        id: "city-v1-site",
        name: "Building site",
        kind: "shortcut",
        from: [160, -130],
        to: [200, -90],
        halfWidth: 4.5,
      },
    ],
  },
);
