import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RaceSession,
  kartTickMs,
  raceResults,
  type DriverStyle,
  type KartFinish,
  type KartInput,
  type KartLaps,
  type KartRaceView,
  type KartTrackId,
  type KartPaint,
  type RaceResult,
  type RoomSettings,
} from "@kart-party/game";
import { countdownMs } from "@kart-party/game";
import type { RaceStage } from "../kart/race-stage";
import { recordBest, type BestRecord } from "./records";

export const practicePlayerId = "p-practice01";

export type PracticeSetup = {
  name: string;
  driver: DriverStyle;
  trackId: KartTrackId;
  laps: KartLaps;
  cpu: number;
  cpuLevel: RoomSettings["cpuLevel"];
  items: RoomSettings["items"];
  paint: KartPaint;
};

export type PracticeOutcome = {
  results: RaceResult[];
  best?: BestRecord;
  improved: boolean;
};

/**
 * Offline practice. The same RaceSession the online room uses runs here, on
 * this device's clock, ticking ten times a second; the racer's own kart is
 * still drawn from local prediction, exactly as online.
 */
export function useLocalRace(setup: PracticeSetup, run: number) {
  const { name, trackId, laps, cpu, cpuLevel, items } = setup;
  // Keyed on values, not object identity, so a new but equal setup is the same race.
  const session = useMemo(
    () =>
      RaceSession.create({
        raceId: `practice-${run}-${trackId}`,
        players: [{ playerId: practicePlayerId, name }],
        trackId,
        laps,
        cpu,
        cpuLevel,
        items,
      }),
    [name, trackId, laps, cpu, cpuLevel, items, run],
  );
  const goAt = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const [phase, setPhase] = useState<RaceStage["phase"]>("grid");
  const [paused, setPaused] = useState(false);
  const [goTime, setGoTime] = useState(0);
  const [race, setRace] = useState<KartRaceView>(() => session.view(practicePlayerId));
  const [outcome, setOutcome] = useState<PracticeOutcome | undefined>();

  const elapsed = useCallback(() => Date.now() - goAt.current, []);

  const settle = useCallback(() => {
    setPhase("done");
    const results = raceResults(session.race);
    const mine = results.find((row) => row.playerId === practicePlayerId);
    const record =
      mine?.timeMs != null
        ? recordBest(
            { trackId: setup.trackId, laps: setup.laps },
            mine.timeMs,
            Date.now(),
          )
        : undefined;
    setOutcome({ results, best: record?.best, improved: Boolean(record?.improved) });
  }, [session, setup.trackId, setup.laps]);

  // A fresh run starts with a three-second countdown on the grid.
  useEffect(() => {
    const now = Date.now();
    goAt.current = now + countdownMs;
    pausedAt.current = null;
    setGoTime(goAt.current);
    setPhase("grid");
    setPaused(false);
    setOutcome(undefined);
    setRace(session.view(practicePlayerId));
    const start = setTimeout(() => setPhase("racing"), countdownMs);
    return () => clearTimeout(start);
  }, [session]);

  useEffect(() => {
    if (phase !== "racing" || paused) return;
    const timer = setInterval(() => {
      const next = session.tick(elapsed());
      setRace(session.view(practicePlayerId));
      if (next.ended) {
        clearInterval(timer);
        settle();
      }
    }, kartTickMs);
    return () => clearInterval(timer);
  }, [phase, paused, session, elapsed, settle]);

  const pause = useCallback(
    (value: boolean) => {
      if (phase === "done") return;
      if (value && pausedAt.current === null) pausedAt.current = Date.now();
      if (!value && pausedAt.current !== null) {
        // The race clock does not run while paused.
        goAt.current += Date.now() - pausedAt.current;
        pausedAt.current = null;
        setGoTime(goAt.current);
      }
      setPaused(value);
    },
    [phase],
  );

  const stage = useMemo<RaceStage>(
    () => ({ phase, goAt: goTime, now: () => Date.now(), paused }),
    [phase, goTime, paused],
  );

  return {
    stage,
    race,
    outcome,
    paused,
    pause,
    onInput: useCallback(
      (input: KartInput) => {
        if (phase === "racing" && !paused)
          session.input(practicePlayerId, input, elapsed());
      },
      [phase, paused, session, elapsed],
    ),
    onFinish: useCallback(
      (report: KartFinish) => {
        const result = session.finish(practicePlayerId, report);
        setRace(session.view(practicePlayerId));
        if (result.ok && session.race.ended) settle();
        return result;
      },
      [session, settle],
    ),
    useItem: useCallback(
      (raceId: string) => {
        const result = session.useItem(practicePlayerId, raceId, elapsed());
        setRace(session.view(practicePlayerId));
        return result;
      },
      [session, elapsed],
    ),
    recover: useCallback(
      (raceId: string) => {
        const result = session.recover(practicePlayerId, raceId, elapsed());
        setRace(session.view(practicePlayerId));
        return result;
      },
      [session, elapsed],
    ),
  };
}
