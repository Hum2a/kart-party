import { createKartRoute, type KartRoute } from "./kart-route.ts";
import { indexWalls, type Wall } from "./kart-driving.ts";
import type { CourseFeature } from "./kart-course.ts";
import type { ItemBox } from "./kart-powers.ts";

type Point = readonly [number, number];
export type PolylineRibbonEdge = {
  left: readonly [number, number];
  right: readonly [number, number];
};
/** What is underfoot. Gravel is a shortcut's loose ground: slow unless boosted. */
export type KartSurface = "road" | "dirt" | "gravel";

/** A course feature placed by lap fraction, or along a branch when `on` names one. */
export type CoursePlan = {
  kind: CourseFeature["kind"];
  /** Fraction of the lap (or of the branch when `on` is set), or a point on the route. */
  at: number | Point;
  /** Metres left (negative) or right of the centreline. */
  lateral?: number;
  width?: number;
  length?: number;
  /** Moving hazards: how far each side they travel, and how slowly. */
  sway?: number;
  swayMs?: number;
  /** Jump pads: how much harder than an ordinary ramp they throw a kart. */
  lift?: number;
  on?: string;
};
/** A narrower stretch between two points on the route, such as a bridge. */
export type NarrowPlan = {
  from: Point;
  to: Point;
  halfWidth: number;
  bridge?: boolean;
};
/**
 * A second way between two points on the route. A shortcut is loose gravel
 * that only pays off with a boost; an alternate route is ordinary road.
 */
export type BranchPlan = {
  id: string;
  name: string;
  kind: "shortcut" | "alternate";
  from: Point;
  to: Point;
  /** Corners between the two ends, in order. */
  via?: readonly Point[];
  halfWidth: number;
};
export type PolylineBranch = {
  id: string;
  name: string;
  kind: BranchPlan["kind"];
  surface: Exclude<KartSurface, "dirt">;
  halfWidth: number;
  points: readonly Point[];
  ribbon: readonly PolylineRibbonEdge[];
  /** Where the branch leaves and rejoins the lap, in centreline metres. */
  fromAlong: number;
  toAlong: number;
  length: number;
};
export type PolylineNarrow = { from: number; to: number; bridge: boolean };

/**
 * One closed original course built from a centreline. The mesh, minimap, road
 * classification, walls, item boxes and course features all derive from the
 * same ribbon, so what a racer sees is what the physics uses.
 */
export type PolylineTrack = {
  id: string;
  route: KartRoute;
  /** The usual half width; narrow sections and branches have their own. */
  halfWidth: number;
  halfWidthAt: (along: number) => number;
  ribbon: readonly PolylineRibbonEdge[];
  walls: readonly Wall[];
  nearbyWalls: ReturnType<typeof indexWalls>;
  surfaceAt: (x: number, z: number) => KartSurface;
  lanePoint: (
    along: number,
    lateral?: number,
  ) => { x: number; z: number; heading: number };
  wrongWay: (x: number, z: number, vx: number, vz: number) => boolean;
  itemBoxes: readonly ItemBox[];
  course: readonly CourseFeature[];
  branches: readonly PolylineBranch[];
  narrows: readonly PolylineNarrow[];
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

/** Unit left normal of the segment a → b. */
function normal(a: Point, b: Point) {
  const x = b[0] - a[0],
    z = b[1] - a[1],
    length = Math.hypot(x, z);
  return [-z / length, x / length] as const;
}

/** Mitred edges for a centreline; `closed` joins the last point back to the first. */
function edges(
  points: readonly Point[],
  closed: boolean,
  widthAt: (i: number) => number,
): PolylineRibbonEdge[] {
  const last = points.length - 1;
  return points.map((point, i) => {
    const previous = closed
      ? points[(i + points.length - 1) % points.length]!
      : points[Math.max(0, i - 1)]!;
    const next = closed
      ? points[(i + 1) % points.length]!
      : points[Math.min(last, i + 1)]!;
    const before = i === 0 && !closed ? normal(point, next) : normal(previous, point),
      after = i === last && !closed ? before : normal(point, next);
    const length = Math.hypot(before[0] + after[0], before[1] + after[1]);
    const nx = (before[0] + after[0]) / length,
      nz = (before[1] + after[1]) / length;
    const width = widthAt(i) / (nx * after[0] + nz * after[1]);
    return {
      left: [point[0] + nx * width, point[1] + nz * width] as const,
      right: [point[0] - nx * width, point[1] - nz * width] as const,
    };
  });
}

/** Splits a wall into pieces no longer than `size`, so a junction can open a clean gap. */
function pieces(wall: Wall, size: number): Wall[] {
  const length = Math.hypot(wall.bx - wall.ax, wall.bz - wall.az);
  const count = Math.max(1, Math.ceil(length / size));
  return Array.from({ length: count }, (_, i) => ({
    ax: wall.ax + ((wall.bx - wall.ax) * i) / count,
    az: wall.az + ((wall.bz - wall.az) * i) / count,
    bx: wall.ax + ((wall.bx - wall.ax) * (i + 1)) / count,
    bz: wall.az + ((wall.bz - wall.az) * (i + 1)) / count,
  }));
}

/** Adds points so no segment is longer than `size`; the shape is unchanged. */
function densify(points: readonly Point[], size: number): Point[] {
  const result: Point[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!;
    const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / size));
    for (let k = 1; k <= count; k++)
      result.push(
        k === count
          ? b
          : [a[0] + ((b[0] - a[0]) * k) / count, a[1] + ((b[1] - a[1]) * k) / count],
      );
  }
  return result;
}

/** Nearest point on an open polyline: distance, metres along it and heading there. */
function project(points: readonly Point[], x: number, z: number) {
  let best = { distance: Infinity, along: 0, heading: 0, x: 0, z: 0 };
  let offset = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!,
      b = points[i + 1]!,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length ** 2),
    );
    const px = a[0] + dx * t,
      pz = a[1] + dz * t,
      distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance)
      best = {
        distance,
        along: offset + length * t,
        heading: Math.atan2(dz, dx),
        x: px,
        z: pz,
      };
    offset += length;
  }
  return best;
}

/**
 * A closed centreline from corner points. The first point must sit on a
 * straight (it is the start line); every other corner becomes an arc of its
 * own radius (the third number) or the default, sampled every few metres.
 */
export function roundedCentreline(
  corners: readonly (readonly [number, number, number?])[],
  radius: number,
): [number, number][] {
  const points: [number, number][] = [[corners[0]![0], corners[0]![1]]];
  const n = corners.length;
  for (let i = 1; i < n; i++) {
    const p = corners[i - 1]!,
      v = corners[i]!,
      q = corners[(i + 1) % n]!;
    const r = v[2] ?? radius;
    const ax = v[0] - p[0],
      az = v[1] - p[1],
      bx = q[0] - v[0],
      bz = q[1] - v[1];
    const la = Math.hypot(ax, az),
      lb = Math.hypot(bx, bz);
    const d1 = [ax / la, az / la] as const,
      d2 = [bx / lb, bz / lb] as const;
    const turn = Math.atan2(
      d1[0] * d2[1] - d1[1] * d2[0],
      d1[0] * d2[0] + d1[1] * d2[1],
    );
    if (Math.abs(turn) < 1e-6) {
      points.push([v[0], v[1]]);
      continue;
    }
    const tangent = r * Math.tan(Math.abs(turn) / 2);
    if (tangent > la / 2 + 1e-6 || tangent > lb / 2 + 1e-6)
      throw new RangeError(`Corner ${i} is too tight for its radius`);
    const side = Math.sign(turn);
    const start = [v[0] - d1[0] * tangent, v[1] - d1[1] * tangent] as const;
    // The arc centre is one radius to the inside of the incoming direction.
    const cx = start[0] - d1[1] * r * side,
      cz = start[1] + d1[0] * r * side;
    const from = Math.atan2(start[1] - cz, start[0] - cx);
    const steps = Math.max(3, Math.ceil((Math.abs(turn) * r) / 3));
    points.push([start[0], start[1]]);
    for (let s = 1; s <= steps; s++) {
      const angle = from + (turn * s) / steps;
      points.push([cx + r * Math.cos(angle), cz + r * Math.sin(angle)]);
    }
  }
  points.push([corners[0]![0], corners[0]![1]]);
  // Drop points that landed on top of each other (a straight exactly two tangents long).
  return points.filter(
    (p, i) =>
      i === 0 || Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1]) > 1e-6,
  );
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
    /** A full feature list; replaces `features` when given. */
    course?: readonly CoursePlan[];
    narrows?: readonly NarrowPlan[];
    branches?: readonly BranchPlan[];
  },
): PolylineTrack {
  // A narrow section needs ribbon points along its straights to change width.
  const base = createKartRoute(
    options.narrows?.length ? densify(centreline, 4) : centreline,
  );
  const halfWidth = options.halfWidth;
  const offsets = [0];
  for (let i = 1; i < base.points.length; i++)
    offsets.push(
      offsets[i - 1]! +
        Math.hypot(
          base.points[i]![0] - base.points[i - 1]![0],
          base.points[i]![1] - base.points[i - 1]![1],
        ),
    );
  const narrows = (options.narrows ?? []).map((plan) => {
    const from = base.progress(plan.from[0], plan.from[1]).along,
      to = base.progress(plan.to[0], plan.to[1]).along;
    if (!(to > from)) throw new RangeError("A narrow section must run forwards");
    return { from, to, halfWidth: plan.halfWidth, bridge: plan.bridge ?? false };
  });
  /** Narrow sections ease in and out over a few metres rather than stepping. */
  const ease = 12;
  const halfWidthAt = (along: number) => {
    let width = halfWidth;
    for (const narrow of narrows) {
      const outside = Math.max(narrow.from - along, along - narrow.to, 0);
      if (outside >= ease) continue;
      const k = 1 - outside / ease;
      width = Math.min(width, halfWidth + (narrow.halfWidth - halfWidth) * k);
    }
    return width;
  };
  const ribbon = edges(base.points.slice(0, -1), true, (i) => halfWidthAt(offsets[i]!));
  const left = ribbon.map((p) => p.left),
    right = ribbon.map((p) => p.right);
  const onMain = (x: number, z: number) => inside(left, x, z) !== inside(right, x, z);

  const branches = (options.branches ?? []).map((plan) => {
    const start = base.progress(plan.from[0], plan.from[1]),
      end = base.progress(plan.to[0], plan.to[1]);
    const points: Point[] = [[start.x, start.z], ...(plan.via ?? []), [end.x, end.z]];
    const branchRibbon = edges(points, false, () => plan.halfWidth);
    const polygon = [
      ...branchRibbon.map((edge) => edge.left),
      ...branchRibbon.map((edge) => edge.right).reverse(),
    ];
    const xs = polygon.map((p) => p[0]),
      zs = polygon.map((p) => p[1]);
    let length = 0;
    for (let i = 1; i < points.length; i++)
      length += Math.hypot(
        points[i]![0] - points[i - 1]![0],
        points[i]![1] - points[i - 1]![1],
      );
    let toAlong = end.along;
    if (toAlong <= start.along) toAlong += base.lapLength;
    const value: PolylineBranch = {
      id: plan.id,
      name: plan.name,
      kind: plan.kind,
      surface: plan.kind === "shortcut" ? "gravel" : "road",
      halfWidth: plan.halfWidth,
      points,
      ribbon: branchRibbon,
      fromAlong: start.along,
      toAlong,
      length,
    };
    return {
      value,
      polygon,
      box: {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
      },
    };
  });
  type Box = (typeof branches)[number]["box"];
  const inBox = (box: Box, x: number, z: number, pad = 0) =>
    x >= box.minX - pad &&
    x <= box.maxX + pad &&
    z >= box.minZ - pad &&
    z <= box.maxZ + pad;
  const branchAt = (x: number, z: number) =>
    branches.find((branch) => inBox(branch.box, x, z) && inside(branch.polygon, x, z));

  const mainWalls: Wall[] = ribbon.flatMap((edge, i) => {
    const next = ribbon[(i + 1) % ribbon.length]!;
    return (["left", "right"] as const).map((side) => ({
      ax: edge[side][0],
      az: edge[side][1],
      bx: next[side][0],
      bz: next[side][1],
    }));
  });
  // Junctions: open the main barrier where a branch leaves, and keep each
  // branch's own barrier off the main road and off other branches.
  const branchWalls = branches.flatMap((branch) =>
    (["left", "right"] as const).flatMap((side) =>
      branch.value.ribbon.slice(0, -1).flatMap((edge, i) =>
        pieces(
          {
            ax: edge[side][0],
            az: edge[side][1],
            bx: branch.value.ribbon[i + 1]![side][0],
            bz: branch.value.ribbon[i + 1]![side][1],
          },
          1,
        ).filter((piece) => {
          const mx = (piece.ax + piece.bx) / 2,
            mz = (piece.az + piece.bz) / 2;
          return (
            !onMain(mx, mz) &&
            !branches.some(
              (other) =>
                other !== branch &&
                inBox(other.box, mx, mz) &&
                inside(other.polygon, mx, mz),
            )
          );
        }),
      ),
    ),
  );
  const walls: Wall[] = branches.length
    ? [
        ...mainWalls.flatMap((wall) => {
          const near = branches.some(
            (b) =>
              inBox(b.box, wall.ax, wall.az, 2) ||
              inBox(b.box, wall.bx, wall.bz, 2) ||
              inBox(b.box, (wall.ax + wall.bx) / 2, (wall.az + wall.bz) / 2, 2),
          );
          if (!near) return [wall];
          return pieces(wall, 1).filter(
            (piece) => !branchAt((piece.ax + piece.bx) / 2, (piece.az + piece.bz) / 2),
          );
        }),
        ...branchWalls,
      ]
    : mainWalls;

  const surfaceAt = (x: number, z: number): KartSurface => {
    if (onMain(x, z)) return "road";
    return branchAt(x, z)?.value.surface ?? "dirt";
  };
  /**
   * Lap progress. A branch maps its own length onto the stretch of lap it
   * replaces. Leaving the main road, progress eases from the main road's
   * reading to the branch's over a few metres, so it never jumps: the lap
   * gates accept a branch exactly as they accept the road.
   */
  const blend = 8;
  const progress = (x: number, z: number) => {
    const main = base.progress(x, z);
    if (!branches.some((b) => inBox(b.box, x, z, 30)) || onMain(x, z)) return main;
    let chosen: (typeof branches)[number] | undefined;
    let p: ReturnType<typeof project> | undefined;
    for (const branch of branches) {
      if (!inBox(branch.box, x, z, 30)) continue;
      const q = project(branch.value.points, x, z);
      if (inside(branch.polygon, x, z)) {
        chosen = branch;
        p = q;
        break;
      }
      if (q.distance < main.distance && (!p || q.distance < p.distance)) {
        chosen = branch;
        p = q;
      }
    }
    if (!chosen || !p) return main;
    const lap = base.lapLength;
    const { fromAlong, toAlong, length } = chosen.value;
    const branchAlong = fromAlong + ((toAlong - fromAlong) * p.along) / length;
    let mainAlong = main.along;
    while (mainAlong - branchAlong > lap / 2) mainAlong -= lap;
    while (branchAlong - mainAlong > lap / 2) mainAlong += lap;
    const t = Math.max(
      0,
      Math.min(1, (main.distance - halfWidthAt(main.along)) / blend),
    );
    const weight = t * t * (3 - 2 * t);
    const along =
      (((mainAlong + (branchAlong - mainAlong) * weight) % lap) + lap) % lap;
    return weight > 0.5
      ? {
          distance: Math.min(p.distance, main.distance),
          along,
          heading: p.heading,
          x: p.x,
          z: p.z,
        }
      : { ...main, distance: Math.min(p.distance, main.distance), along };
  };
  const route: KartRoute = { ...base, progress };

  const lanePoint = (along: number, lateral = 0) => {
    const pose = route.point(along);
    return {
      x: pose.x - Math.sin(pose.heading) * lateral,
      z: pose.z + Math.cos(pose.heading) * lateral,
      heading: pose.heading,
    };
  };
  const branchPoint = (branchId: string, fraction: number, lateral = 0) => {
    const branch = branches.find((b) => b.value.id === branchId);
    if (!branch) throw new RangeError(`No branch ${branchId}`);
    const { points, length } = branch.value;
    let remaining = Math.max(0, Math.min(1, fraction)) * length;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!,
        b = points[i + 1]!,
        segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (remaining <= segment || i === points.length - 2) {
        const t = Math.min(1, remaining / segment),
          heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
        return {
          x: a[0] + (b[0] - a[0]) * t - Math.sin(heading) * lateral,
          z: a[1] + (b[1] - a[1]) * t + Math.cos(heading) * lateral,
          heading,
        };
      }
      remaining -= segment;
    }
    throw new RangeError("A branch needs two points");
  };
  const wrongWay = (x: number, z: number, vx: number, vz: number) => {
    const p = route.progress(x, z);
    return (
      Math.hypot(vx, vz) > 0.5 &&
      vx * Math.cos(p.heading) + vz * Math.sin(p.heading) < -0.5
    );
  };
  const stations = options.itemStations ?? 6;
  const itemBoxes: ItemBox[] = Array.from({ length: stations }, (_, station) => {
    const along = 50 + (station * (route.lapLength - 70)) / stations;
    // Boxes sit inside the road, so a narrow stretch gets a tighter row.
    const lane = Math.min(4, halfWidthAt(along) - 2.5);
    return [-lane, 0, lane].map((offset, i) => {
      const { x, z } = lanePoint(along, offset);
      return { id: `${id}-${station}-${i}`, x, z };
    });
  }).flat();
  const at = options.features ?? [0.18, 0.4, 0.7];
  const course: CourseFeature[] = options.course
    ? options.course.map((plan, i) => {
        const pose =
          typeof plan.at !== "number"
            ? lanePoint(base.progress(plan.at[0], plan.at[1]).along, plan.lateral ?? 0)
            : plan.on
              ? branchPoint(plan.on, plan.at, plan.lateral)
              : lanePoint(route.lapLength * plan.at, plan.lateral ?? 0);
        return {
          id: `${id}-${plan.kind}-${i}`,
          kind: plan.kind,
          ...pose,
          width: plan.width ?? 3,
          length: plan.length ?? 5,
          ...(plan.sway !== undefined ? { sway: plan.sway } : {}),
          ...(plan.swayMs !== undefined ? { swayMs: plan.swayMs } : {}),
          ...(plan.lift !== undefined ? { lift: plan.lift } : {}),
        };
      })
    : (["boost", "ramp", "hazard"] as const).map((kind, i) => ({
        id: `${id}-${kind}`,
        kind,
        ...lanePoint(route.lapLength * at[i]!, i === 1 ? -4 : 4),
        width: 3,
        length: 5,
      }));
  return {
    id,
    route,
    halfWidth,
    halfWidthAt,
    ribbon,
    walls,
    nearbyWalls: indexWalls(walls),
    surfaceAt,
    lanePoint,
    wrongWay,
    itemBoxes,
    course,
    branches: branches.map((branch) => branch.value),
    narrows: narrows.map(({ from, to, bridge }) => ({ from, to, bridge })),
  };
}
