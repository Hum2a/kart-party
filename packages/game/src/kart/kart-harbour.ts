import { createPolylineTrack } from "./kart-polyline.ts";

/**
 * Harbour Hairpins: a long opening straight, a right-then-left pair of tight
 * hairpins, a quick chicane and a fast sweeper home. Original layout.
 */
export const harbourTrackId = "harbour-v1" as const;
export const harbourRoadHalfWidth = 11;
function centreline(): readonly (readonly [number, number])[] {
  const points: [number, number][] = [[0, 0]];
  const line = (x: number, z: number) => points.push([x, z]);
  /** Arc from `start` to `end` radians around (cx, cz); the first point is already placed. */
  const arc = (cx: number, cz: number, r: number, start: number, end: number) => {
    const steps = Math.max(6, Math.round((Math.abs(end - start) * r) / 4));
    for (let i = 1; i <= steps; i++) {
      const a = start + ((end - start) * i) / steps;
      points.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
  };
  line(0, -100);
  arc(30, -100, 30, Math.PI, (3 * Math.PI) / 2);
  line(110, -130);
  arc(110, -105, 25, -Math.PI / 2, Math.PI / 2);
  line(70, -80);
  arc(70, -55, 25, -Math.PI / 2, (-3 * Math.PI) / 2);
  line(150, -30);
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    line(150 + 50 * t, -30 + 7 * Math.sin(t * Math.PI * 2));
  }
  arc(200, 15, 45, -Math.PI / 2, Math.PI / 2);
  line(40, 60);
  arc(40, 20, 40, Math.PI / 2, Math.PI);
  line(0, 0);
  return points;
}
export const harbourTrack = createPolylineTrack(harbourTrackId, centreline(), {
  halfWidth: harbourRoadHalfWidth,
  itemStations: 7,
  features: [0.06, 0.55, 0.8],
});
