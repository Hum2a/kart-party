import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { LobbyDriver } from "@kart-party/game";
import { createDriverRig } from "./driver-rig";
import { paintHex } from "../settings/paint";
import { getSettings } from "../settings/settings";
import {
  confettiBurstSeconds,
  createConfetti,
  podiumLabel,
  podiumPose,
  podiumSteps,
  stepConfetti,
  type PodiumPlace,
} from "./podium";
import "./podium.css";

/**
 * The top three on a podium, waving, under falling confetti. A small scene of
 * its own, loaded with the results, so it never touches the race canvas.
 * Reduced motion holds the camera still and skips the confetti.
 */
export default function PodiumScene({
  places,
  drivers,
  reducedMotion,
  fallback = null,
}: {
  places: readonly PodiumPlace[];
  drivers: ReadonlyMap<string, LobbyDriver>;
  reducedMotion: boolean;
  /** Shown instead when this device cannot draw 3D. */
  fallback?: ReactNode;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const reduced = useRef(reducedMotion);
  useEffect(() => {
    reduced.current = reducedMotion;
  }, [reducedMotion]);
  const key = places.map((p) => `${p.place}:${p.playerId}`).join("|");

  useEffect(() => {
    const root = mount.current;
    if (!root) return;
    let renderer: THREE.WebGLRenderer;
    try {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      renderer = new THREE.WebGLRenderer({
        antialias: !coarse,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.setAttribute("aria-hidden", "true");
    root.append(renderer.domElement);

    const colour = (role: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--kart-${role}, var(--${role}))`;
      root.append(probe);
      const value = new THREE.Color(getComputedStyle(probe).color);
      probe.remove();
      return value;
    };
    const palette = {
      ground: colour("background"),
      surface: colour("surface"),
      accent: colour("accent"),
      highlight: colour("highlight"),
      ink: colour("foreground"),
      muted: colour("muted"),
    };
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const instances = new Set<THREE.InstancedMesh>();
    const geo = <T extends THREE.BufferGeometry>(value: T) => {
      geometries.add(value);
      return value;
    };
    const lambert = (color: THREE.Color | number) => {
      const value = new THREE.MeshLambertMaterial({ color, flatShading: true });
      materials.add(value);
      return value;
    };

    const scene = new THREE.Scene();
    scene.background = palette.ground;
    scene.add(new THREE.HemisphereLight(palette.ink, palette.ground, 2));
    const sun = new THREE.DirectionalLight(palette.ink, 2.2);
    sun.position.set(6, 14, 10);
    scene.add(sun);

    // Stage and steps.
    const stage = new THREE.Mesh(
      geo(new THREE.CylinderGeometry(9, 9.5, 0.4, 32)),
      lambert(palette.surface),
    );
    stage.position.y = -0.2;
    scene.add(stage);
    const numberTexture = (text: string, fill: string, ink: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      context.fillStyle = fill;
      context.fillRect(0, 0, 128, 128);
      context.fillStyle = ink;
      context.font = "italic 900 96px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 70);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture);
      return texture;
    };
    for (const place of [1, 2, 3] as const) {
      const step = podiumSteps[place];
      // Neutral steps, so no kart paint blends into its step; the number carries colour.
      const tone = palette.surface
        .clone()
        .lerp(palette.ink, place === 1 ? 0.3 : place === 2 ? 0.22 : 0.15);
      const ink =
        place === 1 ? palette.accent : place === 2 ? palette.ink : palette.highlight;
      const block = new THREE.Mesh(
        geo(new THREE.BoxGeometry(3.5, step.height, 3.5)),
        lambert(tone),
      );
      block.position.set(step.x, step.height / 2, 0);
      scene.add(block);
      const texture = numberTexture(
        String(place),
        `#${tone.getHexString()}`,
        `#${ink.getHexString()}`,
      );
      if (texture) {
        // Lit like the block, so the number panel does not show as a lighter square.
        const material = new THREE.MeshLambertMaterial({ map: texture });
        materials.add(material);
        const face = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.4, 1.4)), material);
        face.position.set(step.x, Math.max(0.75, step.height / 2), 1.76);
        scene.add(face);
      }
    }

    // Karts: the same low-poly shapes as the race, one group each.
    const second = lambert(palette.highlight);
    const seatMat = lambert(palette.ink);
    const wheelMat = lambert(palette.ground);
    const bodyGeo = geo(new THREE.BoxGeometry(2.8, 0.65, 1.5));
    const noseGeo = geo(new THREE.BoxGeometry(0.8, 0.35, 1.7));
    const seatGeo = geo(new THREE.BoxGeometry(0.65, 0.9, 0.65));
    const wheelGeo = geo(new THREE.BoxGeometry(0.65, 0.65, 0.35));
    const kartColour = (playerId: string, place: number) =>
      new THREE.Color(
        paintHex(drivers.get(playerId)?.paint, getSettings().colourSafe) ??
          (place % 2 ? "#ff5a36" : "#3d9bff"),
      );
    const karts: { playerId: string; place: 1 | 2 | 3; colour: THREE.Color }[] = [];
    for (const entry of places) {
      const pose = podiumPose(entry.place);
      const colour = kartColour(entry.playerId, entry.place);
      const kart = new THREE.Group();
      kart.position.set(pose.x, pose.height, pose.z);
      kart.rotation.y = -pose.heading;
      const body = new THREE.Mesh(bodyGeo, lambert(colour));
      body.position.y = 0.6;
      const nose = new THREE.Mesh(noseGeo, second);
      nose.position.set(1.25, 0.5, 0);
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(-0.78, 1.05, 0);
      seat.scale.set(0.5, 1, 1.1);
      kart.add(body, nose, seat);
      for (let j = 0; j < 4; j++) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(j < 2 ? -0.75 : 0.75, 0.35, j % 2 ? -0.78 : 0.78);
        kart.add(wheel);
      }
      scene.add(kart);
      karts.push({ playerId: entry.playerId, place: entry.place, colour });
    }
    const white = lambert(0xffffff);
    const rig = createDriverRig({
      scene,
      capacity: 3,
      geo,
      batch: (geometry, material, count) => {
        const value = new THREE.InstancedMesh(geometry, material, count);
        value.frustumCulled = false;
        scene.add(value);
        instances.add(value);
        return value;
      },
      material: white,
      textures,
      palette: {
        ink: palette.ink,
        ground: palette.ground,
        accent: palette.accent,
        highlight: palette.highlight,
      },
    });
    rig.setDrivers(drivers, (mediaId) => mediaId);
    const present = new Set(karts.map((kart) => kart.playerId));

    // Confetti: one instanced batch, theme colours plus the winners' paint.
    const pieces = createConfetti();
    const confettiMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    materials.add(confettiMat);
    const confetti = new THREE.InstancedMesh(
      geo(new THREE.PlaneGeometry(0.2, 0.3)),
      confettiMat,
      pieces.length,
    );
    confetti.frustumCulled = false;
    instances.add(confetti);
    const tones = [
      palette.accent,
      palette.highlight,
      palette.ink,
      ...karts.map((k) => k.colour),
    ];
    pieces.forEach((_, i) => confetti.setColorAt(i, tones[i % tones.length]!));
    scene.add(confetti);
    const holder = new THREE.Object3D();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    let distance = 14;
    const resize = () => {
      const width = Math.max(1, root.clientWidth),
        height = Math.max(1, root.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Narrow screens pull back so all three steps stay in view.
      distance = width / height < 1.2 ? 19 : 14;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();

    let raf = 0,
      last = 0,
      time = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const still = reduced.current;
      time += dt;
      const sway = still ? 0 : Math.sin(time * 0.35) * 0.28;
      camera.position.set(Math.sin(sway) * distance, 5, Math.cos(sway) * distance);
      camera.lookAt(0, 2, 0);
      rig.begin(dt);
      karts.forEach((kart, order) =>
        rig.place(
          kart.playerId,
          order,
          podiumPose(kart.place),
          { status: "FINISHED", drifting: false, elapsedMs: 10_000, turnRate: 0 },
          kart.colour,
          palette.highlight,
          dt,
          still,
        ),
      );
      rig.end(present);
      if (still) confetti.count = 0;
      else {
        stepConfetti(pieces, dt, time, time < confettiBurstSeconds);
        let shown = 0;
        for (const piece of pieces) {
          if (!piece.alive) continue;
          holder.position.set(piece.x, piece.y, piece.z);
          holder.rotation.set(piece.angle, piece.angle * 0.7, piece.angle * 0.3);
          holder.updateMatrix();
          confetti.setMatrixAt(shown++, holder.matrix);
        }
        confetti.count = shown;
        confetti.instanceMatrix.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      rig.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      instances.forEach((i) => i.dispose());
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // `key` stands for the places; drivers rarely change on a results screen.
  }, [key, drivers]);

  if (failed) return <>{fallback}</>;
  return (
    <div
      ref={mount}
      className="kart-podium"
      role="img"
      aria-label={podiumLabel(places)}
    />
  );
}
