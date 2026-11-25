import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import { polylineTrack } from "@kart-party/game";
import { createCircuit } from "./circuit";
import { sceneSpots, trackScenery } from "./track-dressing";

afterEach(() => vi.restoreAllMocks());

const palette = Object.fromEntries(
  ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
    role,
    new THREE.Color(),
  ]),
) as Parameters<typeof createCircuit>[0];

const named = (scene: THREE.Scene, name: string) => scene.getObjectByName(name);

it("gives each new course its own scenery and keeps trees for the older ones", () => {
  expect(trackScenery("city-v1")).toBe("city");
  expect(trackScenery("summit-v1")).toBe("mountain");
  expect(trackScenery("beach-v1")).toBe("beach");
  expect(trackScenery("parkside-v1")).toBe("trees");
});

it.each([
  [
    "city-v1",
    ["kart-branch-city-v1-site", "kart-gravel-city-v1-site", "kart-scenery-towers"],
  ],
  [
    "summit-v1",
    [
      "kart-branch-summit-v1-goat",
      "kart-bridge-gorge",
      "kart-bridge-rail",
      "kart-scenery-pines",
      "kart-scenery-peaks",
    ],
  ],
  [
    "beach-v1",
    ["kart-branch-beach-v1-boardwalk", "kart-scenery-palms", "kart-scenery-sea"],
  ],
] as const)(
  "%s: draws its branches, bridge and scenery, then frees them",
  (trackId, names) => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const circuit = createCircuit(palette, false, undefined, trackId);
    for (const name of names) expect(named(circuit.scene, name), name).toBeTruthy();
    // The boardwalk is road, not gravel, so it has no loose stones.
    if (trackId === "beach-v1")
      expect(named(circuit.scene, "kart-gravel-beach-v1-boardwalk")).toBeUndefined();
    const geometries = new Set<THREE.BufferGeometry>();
    circuit.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    const disposed = [...geometries].map((g) => vi.spyOn(g, "dispose"));
    circuit.dispose();
    for (const spy of disposed) expect(spy).toHaveBeenCalled();
  },
);

it("never puts scenery on a road, a branch or the bridge", () => {
  for (const trackId of ["city-v1", "summit-v1", "beach-v1"]) {
    const course = polylineTrack(trackId)!;
    const spots = sceneSpots(course, 60, 9, 5);
    expect(spots.length).toBeGreaterThan(10);
    for (const [x, z] of spots) expect(course.surfaceAt(x, z)).toBe("dirt");
  }
});

it("lays every strip face up, so the gorge and branches are seen from above", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  for (const [trackId, names] of [
    ["summit-v1", ["kart-bridge-gorge", "kart-branch-summit-v1-goat"]],
    ["city-v1", ["kart-branch-city-v1-site"]],
    ["beach-v1", ["kart-branch-beach-v1-boardwalk"]],
  ] as const) {
    const circuit = createCircuit(palette, false, undefined, trackId);
    for (const name of names) {
      const mesh = named(circuit.scene, name) as THREE.Mesh;
      const normals = mesh.geometry.getAttribute("normal");
      for (let i = 0; i < normals.count; i++)
        expect(normals.getY(i), `${name} vertex ${i}`).toBeGreaterThan(0.99);
    }
    circuit.dispose();
  }
});
