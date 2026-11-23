import { createPolylineTrack } from "./kart-polyline.ts";

/** Parkside: sweeping 40m bends, wide straights and a gentle S section. Original layout. */
export const parkTrackId = "parkside-v1" as const;
export const parkRoadHalfWidth = 12;
function centreline(): readonly (readonly [number, number])[] {
  const points: [number, number][] = [
    [0, 0],
    [0, -60],
  ];
  const arc = (x: number, z: number, start: number) => {
    for (let i = 1; i <= 12; i++) {
      const angle = start + ((i / 12) * Math.PI) / 2;
      points.push([x + 40 * Math.cos(angle), z + 40 * Math.sin(angle)]);
    }
  };
  arc(40, -60, Math.PI);
  points.push([120, -100]);
  arc(120, -60, -Math.PI / 2);
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    points.push([160 + 10 * Math.sin(t * Math.PI * 2), -60 + 120 * t]);
  }
  arc(120, 60, 0);
  points.push([40, 100]);
  arc(40, 60, Math.PI / 2);
  points.push([0, 0]);
  return points;
}
export const parkTrack = createPolylineTrack(parkTrackId, centreline(), {
  halfWidth: parkRoadHalfWidth,
});
export const parkRoute = parkTrack.route;
/** Mitered strip shared verbatim by mesh, map, road classification and wall segments. */
export const parkRibbon = parkTrack.ribbon;
export const parkWalls = parkTrack.walls;
export const nearbyParkWalls = parkTrack.nearbyWalls;
export const parkSurfaceAt = parkTrack.surfaceAt;
export const parkLanePoint = parkTrack.lanePoint;
export const parkItemBoxes = parkTrack.itemBoxes;
export const parkCourse = parkTrack.course;
