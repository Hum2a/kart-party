import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createKartRace, projectKartRace } from "@kart-party/game";
import {
  confettiBurstSeconds,
  createConfetti,
  podiumFromTable,
  podiumLabel,
  podiumPlaces,
  podiumPose,
  stepConfetti,
} from "./podium";
import { createCircuit } from "./circuit";
import { cameraDistanceScale, kartCameraPose } from "./presentation";

afterEach(() => vi.restoreAllMocks());

const row = (playerId: string, place: number, timeMs: number | null) => ({
  playerId,
  name: playerId.toUpperCase(),
  place,
  timeMs,
});

describe("podium", () => {
  it("puts the top three finishers up, never someone who did not finish", () => {
    const places = podiumPlaces([
      row("c", 3, 3000),
      row("a", 1, 1000),
      row("d", 4, 4000),
      row("b", 2, 2000),
    ]);
    expect(places.map((p) => [p.playerId, p.place])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    expect(podiumPlaces([row("a", 1, 1000), row("b", 2, null)])).toEqual([
      { playerId: "a", name: "A", place: 1 },
    ]);
    expect(podiumLabel(places)).toBe("Podium: 1st A, 2nd B, 3rd C");
    expect(podiumLabel([])).toBe("Podium: nobody finished");
  });

  it("takes a finished Grand Prix's podium from the points table", () => {
    expect(
      podiumFromTable([
        { playerId: "x", name: "X" },
        { playerId: "y", name: "Y" },
      ]).map((p) => p.place),
    ).toEqual([1, 2]);
  });

  it("stands the winner highest, in the middle", () => {
    const first = podiumPose(1),
      second = podiumPose(2),
      third = podiumPose(3);
    expect(first.x).toBe(0);
    expect(second.x).toBeLessThan(0);
    expect(third.x).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(second.height);
    expect(second.height).toBeGreaterThan(third.height);
  });

  it("drops confetti for a few seconds, then lets the last pieces land", () => {
    const pieces = createConfetti(40);
    expect(pieces.every((p) => p.alive && p.y > 0)).toBe(true);
    const start = pieces.map((p) => p.y);
    stepConfetti(pieces, 0.05, 0.05, true);
    expect(pieces.every((p, i) => p.y < start[i]!)).toBe(true);
    // While the burst lasts, landed pieces start again at the top.
    let time = 0;
    for (; time < confettiBurstSeconds; time += 0.05)
      expect(stepConfetti(pieces, 0.05, time, true)).toBe(40);
    // Afterwards they settle and stop.
    let falling = 40;
    for (let i = 0; i < 400 && falling; i++)
      falling = stepConfetti(pieces, 0.05, (time += 0.05), false);
    expect(falling).toBe(0);
    // A huge frame gap is clamped, so a backgrounded tab does not teleport them.
    const one = createConfetti(1);
    const y = one[0]!.y;
    stepConfetti(one, 30, 0, true);
    expect(y - one[0]!.y).toBeLessThan(1);
  });
});

describe("kart shadows and camera", () => {
  const palette = Object.fromEntries(
    ["ground", "road", "accent", "highlight", "ink", "muted"].map((role) => [
      role,
      new THREE.Color(),
    ]),
  ) as Parameters<typeof createCircuit>[0];

  it("draws one shadow per kart when on, none when off, and shrinks it in the air", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const race = projectKartRace(
      createKartRace("shadows", [
        { playerId: "a", name: "A" },
        { playerId: "b", name: "B" },
      ]),
      null,
      0,
    );
    const circuit = createCircuit(palette, false, undefined, "party-ring-v1");
    const shadows = circuit.scene.getObjectByName(
      "kart-shadows",
    ) as THREE.InstancedMesh;
    circuit.update(race, 0.02, true);
    expect(shadows.count).toBe(0);
    circuit.setShadows(true);
    circuit.update(race, 0.02, true);
    expect(shadows.count).toBe(2);
    const matrix = new THREE.Matrix4();
    shadows.getMatrixAt(0, matrix);
    const grounded = new THREE.Vector3().setFromMatrixScale(matrix).x;
    race.participants[0]!.height = 3;
    circuit.update(race, 0.02, true);
    shadows.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeLessThan(grounded);
    circuit.setShadows(false);
    circuit.update(race, 0.02, true);
    expect(shadows.count).toBe(0);
    circuit.dispose();
  });

  it("repaints karts from the colour-blind-safe palette on this device only", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const race = projectKartRace(
      createKartRace("paint", [{ playerId: "a", name: "A" }]),
      null,
      0,
    );
    const circuit = createCircuit(palette, false, undefined, "party-ring-v1");
    circuit.setDrivers(new Map([["a", { style: "racer", paint: "lime" }]]), (id) => id);
    const body = () => {
      circuit.update(race, 0.02, true);
      const mesh = circuit.scene.children.find(
        (child) =>
          child instanceof THREE.InstancedMesh &&
          child.geometry instanceof THREE.BoxGeometry &&
          child.geometry.parameters.width === 2.8,
      ) as THREE.InstancedMesh;
      const colour = new THREE.Color();
      mesh.getColorAt(0, colour);
      return colour.getHexString();
    };
    const usual = body();
    circuit.setColourSafe(true);
    const safe = body();
    expect(safe).not.toBe(usual);
    expect(safe).toBe(new THREE.Color("#009e73").getHexString());
    circuit.dispose();
  });

  it("moves the chase camera closer or further back, but not the top-down one's target", () => {
    const pose = { x: 0, z: 0, heading: 0 };
    const near = kartCameraPose(pose, false, 0, cameraDistanceScale.close);
    const normal = kartCameraPose(pose, false, 0, cameraDistanceScale.normal);
    const far = kartCameraPose(pose, false, 0, cameraDistanceScale.far);
    expect(near.position[0]).toBeGreaterThan(normal.position[0]);
    expect(far.position[0]).toBeLessThan(normal.position[0]);
    expect(far.position[1]).toBeGreaterThan(normal.position[1]);
    expect(far.target).toEqual(normal.target);
    expect(kartCameraPose(pose, false, 0)).toEqual(normal);
    // Nonsense falls back to normal rather than putting the camera inside the kart.
    expect(kartCameraPose(pose, false, 0, Number.NaN)).toEqual(normal);
  });
});
