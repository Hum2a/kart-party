import { useEffect, useState } from "react";
import { resolveKartSettings, type KartRaceView } from "@kart-party/game";
import type { RaceStage } from "./race-stage";

export type RaceCountdown = 3 | 2 | 1 | "GO" | null;

/** How long "GO" stays up once the race opens. */
export const goMs = 1_000;

/**
 * Pure: the countdown beat. 3-2-1 covers the three seconds before GO; GO
 * shows for the first second of racing. Nothing here starts or times the race.
 */
export function raceCountdown(input: {
  /** Milliseconds until GO; negative once the race is running. */
  untilGoMs: number | null;
  paused: boolean;
  mode: "prompt-tail" | "none";
  enabled?: boolean;
}): RaceCountdown {
  if (input.enabled === false || input.mode === "none" || input.paused) return null;
  if (input.untilGoMs === null) return null;
  if (input.untilGoMs > 3_000) return null;
  if (input.untilGoMs > 0)
    return Math.max(1, Math.ceil(input.untilGoMs / 1_000)) as 1 | 2 | 3;
  return -input.untilGoMs < goMs ? "GO" : null;
}

/** Re-reads the stage clock a few times a second only around GO. */
export function useRaceCountdown(
  stage: RaceStage,
  race: KartRaceView | undefined,
  enabled = true,
): RaceCountdown {
  const [now, setNow] = useState(() => stage.now());
  const near =
    stage.goAt !== undefined &&
    stage.phase !== "done" &&
    stage.goAt - now <= 4_000 &&
    now - stage.goAt <= goMs + 200;
  const waiting = stage.goAt !== undefined && stage.goAt - now > 4_000;
  useEffect(() => {
    if (!near && !waiting) return;
    const timer = window.setInterval(() => setNow(stage.now()), near ? 100 : 500);
    return () => window.clearInterval(timer);
  }, [near, waiting, stage]);
  return raceCountdown({
    untilGoMs: stage.goAt === undefined ? null : stage.goAt - now,
    paused: Boolean(stage.paused),
    mode: resolveKartSettings(race?.settings).countdown,
    enabled,
  });
}
