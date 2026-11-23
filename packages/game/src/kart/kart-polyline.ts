import { createKartRoute, type KartRoute } from "./kart-route.ts";
import { indexWalls, type Wall } from "./kart-driving.ts";
import type { CourseFeature } from "./kart-course.ts";
import type { ItemBox } from "./kart-powers.ts";

type Point = readonly [number, number];
export type PolylineRibbonEdge = {
  left: readonly [number, number];
  right: readonly [number, number];
};

/**
 * One closed original course built from a centreline. The mesh, minimap, road
 * classification, walls, item boxes and course features all derive from the
 * same ribbon, so what a racer sees is what the physics uses.
 */
export type PolylineTrack = {
  id: string;
  route: KartRoute;
  halfWidth: number;
  ribbon: readonly PolylineRibbonEdge[];
  walls: readonly Wall[];
  nearbyWalls: ReturnType<typeof indexWalls>;
  surfaceAt: (x: number, z: number) => "road" | "dirt";
  lanePoint: (
    along: number,
    lateral?: number,
  ) => { x: number; z: number; heading: number };
  wrongWay: (x: number, z: number, vx: number, vz: number) => boolean;
  itemBoxes: readonly ItemBox[];
  course: readonly CourseFeature[];
};

function inside(points: readonly Point[], x: number, z: number) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!,
      b = points[j]!;
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}

export function createPolylineTrack(
  id: string,
  centreline: readonly Point[],
  options: {
    halfWidth: number;
    /** Item box stations as fractions of a lap; each station has three lanes. */
    itemStations?: number;
    /** Where the boost pad, ramp and hazard sit, as fractions of a lap. */
    features?: readonly [number, number, number];
  },
): PolylineTrack {
  const route = createKartRoute(centreline);
  const halfWidth = options.halfWidth;
  const ribbon = route.points.slice(0, -1).map((point, i, points) => {
    const previous = points[(i + points.length - 1) % points.length]!,
      next = points[(i + 1) % points.length]!;
    const normal = (a: readonly number[], b: readonly number[]) => {
      const x = b[0]! - a[0]!,
        z = b[1]! - a[1]!,
        length = Math.hypot(x, z);
      return [-z / length, x / length] as const;
    };
    const before = normal(previous, point),
      after = normal(point, next);
    const length = Math.hypot(before[0] + after[0], before[1] + after[1]);
    const nx = (before[0] + after[0]) / length,
      nz = (before[1] + after[1]) / length;
    const width = halfWidth / (nx * after[0] + nz * after[1]);
    return {
      left: [point[0] + nx * width, point[1] + nz * width] as const,
      right: [point[0] - nx * width, point[1] - nz * width] as const,
    };
  });
  const walls: Wall[] = ribbon.flatMap((edge, i) => {
    const next = ribbon[(i + 1) % ribbon.length]!;
    return (["left", "right"] as const).map((side) => ({
      ax: edge[side][0],
      az: edge[side][1],
      bx: next[side][0],
      bz: next[side][1],
    }));
  });
  const left = ribbon.map((p) => p.left),
    right = ribbon.map((p) => p.right);
  const surfaceAt = (x: number, z: number): "road" | "dirt" =>
    inside(left, x, z) !== inside(right, x, z) ? "road" : "dirt";
  const lanePoint = (along: number, lateral = 0) => {
    const pose = route.point(along);
    return {
      x: pose.x - Math.sin(pose.heading) * lateral,
      z: pose.z + Math.cos(pose.heading) * lateral,
      heading: pose.heading,
    };
  };
  const wrongWay = (x: number, z: number, vx: number, vz: number) => {
    const p = route.progress(x, z);
    return (
      Math.hypot(vx, vz) > 0.5 &&
      vx * Math.cos(p.heading) + vz * Math.sin(p.heading) < -0.5
    );
  };
  const stations = options.itemStations ?? 6;
  const itemBoxes: ItemBox[] = Array.from({ length: stations }, (_, station) =>
    [-4, 0, 4].map((lane, i) => {
      const { x, z } = lanePoint(
        50 + (station * (route.lapLength - 70)) / stations,
        lane,
      );
      return { id: `${id}-${station}-${i}`, x, z };
    }),
  ).flat();
  const at = options.features ?? [0.18, 0.4, 0.7];
  const course: CourseFeature[] = (["boost", "ramp", "hazard"] as const).map(
    (kind, i) => ({
      id: `${id}-${kind}`,
      kind,
      ...lanePoint(route.lapLength * at[i]!, i === 1 ? -4 : 4),
      width: 3,
      length: 5,
    }),
  );
  return {
    id,
    route,
    halfWidth,
    ribbon,
    walls,
    nearbyWalls: indexWalls(walls),
    surfaceAt,
    lanePoint,
    wrongWay,
    itemBoxes,
    course,
  };
}
