import { z } from "zod";
import { kartTickMs, type KartDriver } from "./kart/kart-race-schema.ts";
import { kartTrackIdSchema } from "./kart/kart-tracks.ts";
import { kartSpeedClasses } from "./kart/kart-driving.ts";

/**
 * A ghost is a recorded run: the racer's pose every race tick, plus the
 * finish and lap times. It is replayed by interpolating between samples, so it
 * never touches the race and can never collect items or block anyone.
 */
export const ghostStepMs = kartTickMs;
/** Long enough for three slow laps; longer runs are not worth replaying. */
export const ghostMaxSamples = 6_000;
export const ghostPlayerId = "ghost-best";

export const kartGhostSchema = z
  .object({
    version: z.literal(1),
    trackId: kartTrackIdSchema,
    laps: z.number().int().min(1).max(3),
    speedClass: z.enum(kartSpeedClasses),
    timeMs: z.number().int().positive(),
    lapsMs: z.array(z.number().int().positive()).max(3),
    recordedAt: z.number().int().nonnegative(),
    /** Flat [x, z, heading] triples, one per ghostStepMs, rounded to centimetres. */
    poses: z
      .array(z.number().finite())
      .max(ghostMaxSamples * 3)
      .refine((poses) => poses.length % 3 === 0, "Poses come in threes"),
  })
  .strict();
export type KartGhost = z.infer<typeof kartGhostSchema>;

const round = (value: number, places: number) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

/** Collects one pose per race tick, in order. */
export function createGhostRecorder() {
  let poses: number[] = [];
  let lastStep = -1;
  return {
    sample(elapsedMs: number, pose: { x: number; z: number; heading: number }) {
      const step = Math.floor(elapsedMs / ghostStepMs);
      if (step <= lastStep || poses.length / 3 >= ghostMaxSamples) return;
      // Fill a skipped tick with the same pose so time stays aligned.
      while (lastStep < step - 1 && poses.length / 3 < ghostMaxSamples) {
        const at = poses.length - 3;
        poses.push(
          ...(at >= 0 ? poses.slice(at, at + 3) : [pose.x, pose.z, pose.heading]),
        );
        lastStep++;
      }
      poses.push(round(pose.x, 2), round(pose.z, 2), round(pose.heading, 3));
      lastStep = step;
    },
    finish(
      run: Omit<KartGhost, "version" | "poses" | "recordedAt">,
      recordedAt: number,
    ): KartGhost {
      return kartGhostSchema.parse({ version: 1, ...run, recordedAt, poses });
    },
    reset() {
      poses = [];
      lastStep = -1;
    },
  };
}

const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** The ghost's pose at a race time, or undefined once it has finished. */
export function ghostPoseAt(ghost: KartGhost, elapsedMs: number) {
  const count = ghost.poses.length / 3;
  if (count === 0 || elapsedMs < 0 || elapsedMs > ghost.timeMs) return undefined;
  const position = Math.min(count - 1, elapsedMs / ghostStepMs);
  const i = Math.floor(position),
    j = Math.min(count - 1, i + 1),
    t = position - i;
  const at = (index: number, offset: number) => ghost.poses[index * 3 + offset]!;
  const turn = wrapAngle(at(j, 2) - at(i, 2));
  const dx = at(j, 0) - at(i, 0),
    dz = at(j, 1) - at(i, 1);
  return {
    x: at(i, 0) + dx * t,
    z: at(i, 1) + dz * t,
    heading: at(i, 2) + turn * t,
    speed: Math.hypot(dx, dz) / (ghostStepMs / 1000),
  };
}

/** A public driver row that draws the ghost as one more kart near the racer. */
export function ghostDriver(
  ghost: KartGhost,
  elapsedMs: number,
  name = "Best run",
): KartDriver | undefined {
  const pose = ghostPoseAt(ghost, elapsedMs);
  if (!pose) return undefined;
  return {
    playerId: ghostPlayerId,
    name,
    number: 99,
    x: pose.x,
    z: pose.z,
    heading: pose.heading,
    speed: pose.speed,
    progress: Math.min(1, elapsedMs / ghost.timeMs),
    checkpoint: 0,
    driftCharge: 0,
    boostRemainingMs: 0,
    drifting: false,
    wrongWay: false,
    status: "RACING",
    lapTimeMs: null,
  };
}

/** Lap durations from cumulative lap end times. */
export const lapDurations = (lapsMs: readonly number[]) =>
  lapsMs.map((end, i) => end - (lapsMs[i - 1] ?? 0));

/**
 * How far ahead (negative) or behind (positive) the racer is against the
 * ghost at the end of a lap, in milliseconds.
 */
export function ghostSplit(ghost: KartGhost, lap: number, lapEndMs: number) {
  const target = ghost.lapsMs[lap - 1];
  return target === undefined ? undefined : lapEndMs - target;
}
