import type { RaceResult } from "@kart-party/game";

export type PodiumPlace = { playerId: string; name: string; place: 1 | 2 | 3 };

/** The top three finishers. A racer who did not finish never stands on the podium. */
export function podiumPlaces(
  results: readonly Pick<RaceResult, "playerId" | "name" | "place" | "timeMs">[],
): PodiumPlace[] {
  return [...results]
    .filter((row) => row.timeMs !== null && row.place >= 1 && row.place <= 3)
    .sort((a, b) => a.place - b.place)
    .slice(0, 3)
    .map((row, i) => ({
      playerId: row.playerId,
      name: row.name,
      place: (i + 1) as 1 | 2 | 3,
    }));
}

/** The top three of a Grand Prix table, which is already in points order. */
export function podiumFromTable(
  table: readonly { playerId: string; name: string }[],
): PodiumPlace[] {
  return table.slice(0, 3).map((row, i) => ({
    playerId: row.playerId,
    name: row.name,
    place: (i + 1) as 1 | 2 | 3,
  }));
}

/** Where each step stands and how tall it is. First in the middle, highest. */
export const podiumSteps = {
  1: { x: 0, height: 2.4 },
  2: { x: -3.7, height: 1.6 },
  3: { x: 3.7, height: 1 },
} as const;

/**
 * Karts face away from the camera, turned slightly in, so each driver looks
 * back over their shoulder and waves, as they do crossing the line.
 */
export function podiumPose(place: 1 | 2 | 3) {
  const step = podiumSteps[place];
  const turn = place === 1 ? 0 : place === 2 ? 0.35 : -0.35;
  return { x: step.x, z: 0, height: step.height, heading: -Math.PI / 2 + turn };
}

const ordinals = { 1: "1st", 2: "2nd", 3: "3rd" } as const;
export function podiumLabel(places: readonly PodiumPlace[]): string {
  return places.length
    ? `Podium: ${places.map((p) => `${ordinals[p.place]} ${p.name}`).join(", ")}`
    : "Podium: nobody finished";
}

export type ConfettiPiece = {
  x: number;
  y: number;
  z: number;
  vy: number;
  sway: number;
  phase: number;
  spin: number;
  angle: number;
  alive: boolean;
};

export const confettiCount = 160;
/** Pieces keep falling in for this long, then the last ones land. */
export const confettiBurstSeconds = 6;

/** Deterministic noise in [0, 1), so tests and frames agree. */
export const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export function spawnConfetti(piece: ConfettiPiece, seed: number, top = 10) {
  piece.x = (noise(seed) - 0.5) * 16;
  piece.z = (noise(seed + 1) - 0.5) * 7;
  piece.y = top + noise(seed + 2) * 5;
  piece.vy = 1.4 + noise(seed + 3) * 1.6;
  piece.sway = 0.4 + noise(seed + 4) * 0.8;
  piece.phase = noise(seed + 5) * Math.PI * 2;
  piece.spin = 2 + noise(seed + 6) * 5;
  piece.angle = noise(seed + 7) * Math.PI;
  piece.alive = true;
}

export function createConfetti(count = confettiCount): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const piece: ConfettiPiece = {
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      sway: 0,
      phase: 0,
      spin: 0,
      angle: 0,
      alive: false,
    };
    // Staggered heights so the first frame is not a flat sheet.
    spawnConfetti(piece, i * 17, 4 + (i / count) * 10);
    return piece;
  });
}

/**
 * Moves every piece down by `dt` seconds. While `spawning`, a piece that
 * reaches the floor starts again at the top; afterwards it stays down.
 * Returns how many are still falling.
 */
export function stepConfetti(
  pieces: ConfettiPiece[],
  dt: number,
  time: number,
  spawning: boolean,
): number {
  const step = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
  let falling = 0;
  pieces.forEach((piece, i) => {
    if (!piece.alive) return;
    piece.y -= piece.vy * step;
    piece.x += Math.sin(time * 2 + piece.phase) * piece.sway * step;
    piece.angle += piece.spin * step;
    if (piece.y <= 0) {
      if (spawning) spawnConfetti(piece, i * 17 + Math.floor(time * 10));
      else piece.alive = false;
    }
    if (piece.alive) falling++;
  });
  return falling;
}
