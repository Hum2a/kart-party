import * as THREE from "three";
import type { PolylineTrack } from "@kart-party/game";

/** The look of the land round a course. Older courses keep their trees. */
export type TrackScenery = "trees" | "city" | "mountain" | "beach";
const sceneryByTrack: Readonly<Record<string, TrackScenery>> = {
  "city-v1": "city",
  "summit-v1": "mountain",
  "beach-v1": "beach",
};
export const trackScenery = (trackId: string): TrackScenery =>
  sceneryByTrack[trackId] ?? "trees";

type Edge = { left: readonly [number, number]; right: readonly [number, number] };

/** A flat strip of triangles between the left and right edges. */
export function stripGeometry(edges: readonly Edge[], y: number, closed = false) {
  const positions: number[] = [];
  const count = closed ? edges.length : edges.length - 1;
  for (let i = 0; i < count; i++) {
    const a = edges[i]!,
      b = edges[(i + 1) % edges.length]!;
    for (const point of [a.left, b.left, a.right, a.right, b.left, b.right])
      positions.push(point[0], y, point[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A small, stable pseudo-random number in [0, 1) for scenery: same track, same look. */
export const scatter = (i: number, salt = 0) => {
  const value = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Points well clear of every road (main, branch and bridge), on alternating sides. */
export function sceneSpots(
  poly: PolylineTrack,
  count: number,
  offset: number,
  clearance: number,
): [number, number][] {
  const spots: [number, number][] = [];
  const step = poly.route.lapLength / count;
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const along = step * (i + 0.5);
    const spot = poly.lanePoint(along, side * (poly.halfWidthAt(along) + offset));
    if (poly.surfaceAt(spot.x, spot.z) !== "dirt") continue;
    if (poly.narrows.some((n) => along > n.from - 25 && along < n.to + 25)) continue;
    const clear = poly.walls.every((wall) => {
      const dx = wall.bx - wall.ax,
        dz = wall.bz - wall.az,
        t = Math.max(
          0,
          Math.min(
            1,
            ((spot.x - wall.ax) * dx + (spot.z - wall.az) * dz) /
              (dx * dx + dz * dz || 1),
          ),
        );
      return (
        Math.hypot(spot.x - (wall.ax + dx * t), spot.z - (wall.az + dz * t)) > clearance
      );
    });
    if (clear) spots.push([spot.x, spot.z]);
  }
  return spots;
}

export type DressingKit = {
  palette: {
    ground: THREE.Color;
    road: THREE.Color;
    accent: THREE.Color;
    highlight: THREE.Color;
    ink: THREE.Color;
    muted: THREE.Color;
  };
  materials: {
    surface: THREE.Material;
    bright: THREE.Material;
    second: THREE.Material;
    text: THREE.Material;
    dark: THREE.Material;
    quiet: THREE.Material;
  };
  mat: (color: THREE.Color) => THREE.Material;
  geo: <T extends THREE.BufferGeometry>(value: T) => T;
  mesh: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => THREE.Mesh;
  batch: (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
  ) => THREE.InstancedMesh;
  place: (
    value: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    yaw?: number,
    sx?: number,
    sy?: number,
    sz?: number,
  ) => void;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

/**
 * Branch surfaces, bridges and the scenery that gives each course its own
 * character. Everything is a handful of shared meshes or instanced batches,
 * built once, and none of it touches the road a kart drives on.
 */
export function dressTrack(poly: PolylineTrack, kit: DressingKit) {
  const { palette, materials, mat, geo, mesh, batch, place, bounds } = kit;
  const scenery = trackScenery(poly.id);

  // Branches. They sit a hair under the main road so a junction never flickers.
  let gravel: THREE.Material | undefined;
  let boards: THREE.Material | undefined;
  for (const branch of poly.branches) {
    if (branch.surface === "gravel")
      // Rough grey: the road colour lifted towards the ink, so it reads as loose stone.
      gravel ??= mat(palette.road.clone().lerp(palette.ink, 0.32));
    const strip = mesh(
      geo(stripGeometry(branch.ribbon, 0.015)),
      branch.surface === "gravel"
        ? gravel!
        : // An alternate route is road, warmed a touch so it reads as its own way.
          (boards ??= mat(palette.road.clone().lerp(palette.accent, 0.14))),
      0,
      0,
      0,
    );
    strip.name = `kart-branch-${branch.id}`;
    if (branch.surface !== "gravel") continue;
    // Loose stones scattered over the gravel, so it reads as rough ground.
    const stones = batch(
      geo(new THREE.DodecahedronGeometry(0.35, 0)),
      materials.dark,
      48,
    );
    stones.name = `kart-gravel-${branch.id}`;
    const [a, b] = [branch.points[0]!, branch.points.at(-1)!];
    for (let i = 0; i < 48; i++) {
      const t = 0.2 + scatter(i, 1) * 0.6,
        side = (scatter(i, 2) - 0.5) * 2 * (branch.halfWidth - 0.8);
      const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
      place(
        stones,
        i,
        a[0] + (b[0] - a[0]) * t - Math.sin(heading) * side,
        0.08,
        a[1] + (b[1] - a[1]) * t + Math.cos(heading) * side,
        scatter(i, 3) * Math.PI,
        0.6 + scatter(i, 4),
        0.4,
        0.6 + scatter(i, 5),
      );
    }
  }

  // Bridges: a dark gorge under the narrow stretch and a rail post every few metres.
  for (const narrow of poly.narrows.filter((n) => n.bridge)) {
    const edges: Edge[] = [];
    for (let along = narrow.from - 14; along <= narrow.to + 14; along += 3) {
      const width = poly.halfWidthAt(along) + 20;
      // Positive lateral is the ribbon's left, so the strip faces up like the road.
      const left = poly.lanePoint(along, width),
        right = poly.lanePoint(along, -width);
      edges.push({ left: [left.x, left.z], right: [right.x, right.z] });
    }
    const gorge = mesh(geo(stripGeometry(edges, -0.02)), materials.dark, 0, 0, 0);
    gorge.name = "kart-bridge-gorge";
    const posts = Math.ceil((narrow.to - narrow.from) / 4) + 1;
    const rail = batch(
      geo(new THREE.BoxGeometry(0.5, 1.6, 0.5)),
      materials.second,
      posts * 2,
    );
    rail.name = "kart-bridge-rail";
    for (let i = 0; i < posts; i++) {
      const along = narrow.from + i * 4;
      for (const side of [-1, 1]) {
        const p = poly.lanePoint(along, side * (poly.halfWidthAt(along) + 0.6));
        place(rail, i * 2 + (side > 0 ? 1 : 0), p.x, 0.8, p.z);
      }
    }
  }

  if (scenery === "city") {
    // Blocks of flats with a lit band at the top, close to the kerb.
    const spots = sceneSpots(poly, 60, 11, 6);
    const towers = batch(
        geo(new THREE.BoxGeometry(1, 1, 1)),
        materials.quiet,
        spots.length,
      ),
      bands = batch(
        geo(new THREE.BoxGeometry(1, 1, 1)),
        materials.bright,
        spots.length,
      );
    towers.name = "kart-scenery-towers";
    bands.name = "kart-scenery-neon";
    spots.forEach(([x, z], i) => {
      const height = 10 + scatter(i, 7) * 22,
        width = 6 + scatter(i, 8) * 4,
        yaw = poly.route.progress(x, z).heading;
      place(towers, i, x, height / 2, z, -yaw, width, height, width);
      place(bands, i, x, height + 0.3, z, -yaw, width + 0.2, 0.6, width + 0.2);
    });
  } else if (scenery === "mountain") {
    // Pines and boulders by the road, and a ring of snowy peaks on the horizon.
    const spots = sceneSpots(poly, 36, 9, 5);
    const stone = mat(palette.muted.clone().lerp(palette.ink, 0.3));
    const pines = batch(
        geo(new THREE.ConeGeometry(1.8, 7, 6)),
        materials.quiet,
        spots.length,
      ),
      rocks = batch(geo(new THREE.DodecahedronGeometry(1, 0)), stone, spots.length);
    pines.name = "kart-scenery-pines";
    rocks.name = "kart-scenery-rocks";
    spots.forEach(([x, z], i) => {
      const scale = 0.8 + scatter(i, 9) * 0.7;
      place(pines, i, x, 3.5 * scale, z, 0, scale, scale, scale);
      const r = 1.5 + scatter(i, 10) * 2;
      place(rocks, i, x + 4, r * 0.5, z - 3, scatter(i, 11) * 3, r, r * 0.7, r);
    });
    const cx = (bounds.minX + bounds.maxX) / 2,
      cz = (bounds.minZ + bounds.maxZ) / 2,
      reach = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 90;
    const peaks = batch(
        geo(new THREE.ConeGeometry(1, 1, 5)),
        mat(palette.ground.clone().lerp(palette.muted, 0.55)),
        14,
      ),
      caps = batch(geo(new THREE.ConeGeometry(1, 1, 5)), materials.text, 14);
    peaks.name = "kart-scenery-peaks";
    caps.name = "kart-scenery-snow";
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + scatter(i, 12) * 0.3,
        distance = reach + scatter(i, 13) * 60,
        height = 50 + scatter(i, 14) * 50,
        width = 35 + scatter(i, 15) * 25;
      const x = cx + Math.cos(angle) * distance,
        z = cz + Math.sin(angle) * distance;
      place(peaks, i, x, height / 2 - 1, z, angle, width, height, width);
      // The cap is the same cone, scaled to its top quarter.
      place(
        caps,
        i,
        x,
        height * 0.875 - 0.9,
        z,
        angle,
        width / 4 + 0.4,
        height / 4,
        width / 4 + 0.4,
      );
    }
  } else if (scenery === "beach") {
    // Leaning palms along the road and the sea beyond the seafront straight.
    const spots = sceneSpots(poly, 40, 9, 5).filter(([x]) => x < bounds.maxX - 6);
    const trunks = batch(
        geo(new THREE.CylinderGeometry(0.25, 0.4, 7, 5)),
        materials.dark,
        spots.length,
      ),
      fronds = batch(
        geo(new THREE.ConeGeometry(3.2, 1.4, 6)),
        materials.quiet,
        spots.length,
      );
    trunks.name = "kart-scenery-palms";
    fronds.name = "kart-scenery-fronds";
    spots.forEach(([x, z], i) => {
      const lean = (scatter(i, 16) - 0.5) * 0.5;
      place(trunks, i, x, 3.5, z, 0, 1, 1, 1);
      trunks.getMatrixAt(i, scratch);
      scratch.multiply(new THREE.Matrix4().makeRotationZ(lean));
      trunks.setMatrixAt(i, scratch);
      place(fronds, i, x - Math.sin(lean) * 3.5, 7.2, z, scatter(i, 17) * 3, 1, 1, 1);
    });
    const sea = mat(palette.accent.clone().lerp(palette.ground, 0.55));
    const seaWidth = 600;
    const water = mesh(
      geo(new THREE.PlaneGeometry(seaWidth, bounds.maxZ - bounds.minZ + 400)),
      sea,
      bounds.maxX + seaWidth / 2 - 10,
      -0.03,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    water.rotation.x = -Math.PI / 2;
    water.name = "kart-scenery-sea";
  }
  return scenery;
}
const scratch = new THREE.Matrix4();
