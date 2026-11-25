import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RaceSession,
  createGhostRecorder,
  ghostDriver,
  ghostSplit,
  kartTickMs,
  raceResults,
  countdownMs,
  type DriverStyle,
  type KartFinish,
  type KartGhost,
  type KartInput,
  type KartLaps,
  type KartRaceView,
  type KartTrackId,
  type KartPaint,
  type RaceResult,
  type RoomSettings,
} from "@kart-party/game";
import type { RaceStage } from "../kart/race-stage";
import { readGhost, recordBest, saveGhost, type BestRecord } from "./records";

export const practicePlayerId = "p-practice01";

export type PracticeSetup = {
  name: string;
  driver: DriverStyle;
  trackId: KartTrackId;
  laps: KartLaps;
  cpu: number;
  cpuLevel: RoomSettings["cpuLevel"];
  items: RoomSettings["items"];
  speedClass: RoomSettings["speedClass"];
  paint: KartPaint;
  /** False for a lesson: no best times, no ghost to race or save. */
  record?: boolean;
};

export type PracticeOutcome = {
  results: RaceResult[];
  best?: BestRecord;
  improved: boolean;
  lapImproved: boolean;
  /** A time trial that beat the stored best saves a new ghost. */
  ghostSaved: boolean;
};

/** The split shown when a lap ends in a time trial with a ghost. */
export type LapSplit = { lap: number; gapMs: number };

/** Adds the ghost to the karts drawn around the racer, never to the standings. */
function withGhost(view: KartRaceView, ghost: KartGhost | undefined): KartRaceView {
  const row = ghost ? ghostDriver(ghost, view.elapsedMs) : undefined;
  if (!row) return view;
  return { ...view, nearby: [...(view.nearby ?? []).slice(0, 7), row] };
}

/**
 * Offline practice. The same RaceSession the online room uses runs here, on
 * this device's clock, ticking ten times a second; the racer's own kart is
 * still drawn from local prediction, exactly as online. A time trial (no CPU
 * racers) records a ghost and races against the best one saved.
 */
export function useLocalRace(setup: PracticeSetup, run: number) {
  const { name, trackId, laps, cpu, cpuLevel, items, speedClass } = setup;
  const keepRecords = setup.record !== false;
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
        speedClass,
      }),
    [name, trackId, laps, cpu, cpuLevel, items, speedClass, run],
  );
  const timeTrial = cpu === 0 && keepRecords;
  const ghost = useMemo(
    () => (timeTrial ? readGhost({ trackId, laps, speedClass }) : undefined),
    // A new session reloads the ghost, so beating it replaces what you race next.
    [session],
  );
  const recorder = useMemo(() => createGhostRecorder(), [session]);
  const goAt = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const lapsSeen = useRef(0);
  const [phase, setPhase] = useState<RaceStage["phase"]>("grid");
  const [paused, setPaused] = useState(false);
  const [goTime, setGoTime] = useState(0);
  const [race, setRace] = useState<KartRaceView>(() =>
    withGhost(session.view(practicePlayerId), ghost),
  );
  const [outcome, setOutcome] = useState<PracticeOutcome | undefined>();
  const [split, setSplit] = useState<LapSplit | undefined>();

  const elapsed = useCallback(() => Date.now() - goAt.current, []);

  const publish = useCallback(() => {
    const view = withGhost(session.view(practicePlayerId), ghost);
    setRace(view);
    const self = view.participants.find((d) => d.playerId === practicePlayerId);
    const lapsMs = self?.lapsMs ?? (self?.lapTimeMs != null ? [self.lapTimeMs] : []);
    if (ghost && lapsMs.length > lapsSeen.current) {
      lapsSeen.current = lapsMs.length;
      const gapMs = ghostSplit(ghost, lapsMs.length, lapsMs.at(-1)!);
      if (gapMs !== undefined) setSplit({ lap: lapsMs.length, gapMs });
    }
  }, [session, ghost]);

  const settle = useCallback(
    (lapsMs: readonly number[] = []) => {
      setPhase("done");
      const results = raceResults(session.race);
      const mine = results.find((row) => row.playerId === practicePlayerId);
      const key = { trackId, laps, speedClass };
      const record =
        keepRecords && mine?.timeMs != null
          ? recordBest(key, mine.timeMs, Date.now(), undefined, lapsMs)
          : undefined;
      let ghostSaved = false;
      if (timeTrial && mine?.timeMs != null && record?.improved) {
        try {
          saveGhost(
            recorder.finish(
              {
                trackId,
                laps,
                speedClass,
                timeMs: mine.timeMs,
                lapsMs: lapsMs.length ? [...lapsMs] : [mine.timeMs],
              },
              Date.now(),
            ),
          );
          ghostSaved = true;
        } catch {
          // A run too long to replay keeps its time but saves no ghost.
        }
      }
      setOutcome({
        results,
        best: record?.best,
        improved: Boolean(record?.improved),
        lapImproved: Boolean(record?.lapImproved),
        ghostSaved,
      });
    },
    [session, trackId, laps, speedClass, timeTrial, recorder, keepRecords],
  );

  // A fresh run starts with a three-second countdown on the grid.
  useEffect(() => {
    const now = Date.now();
    goAt.current = now + countdownMs;
    pausedAt.current = null;
    lapsSeen.current = 0;
    recorder.reset();
    setGoTime(goAt.current);
    setPhase("grid");
    setPaused(false);
    setOutcome(undefined);
    setSplit(undefined);
    setRace(withGhost(session.view(practicePlayerId), ghost));
    const start = setTimeout(() => setPhase("racing"), countdownMs);
    return () => clearTimeout(start);
  }, [session, ghost, recorder]);

  useEffect(() => {
    if (phase !== "racing" || paused) return;
    const timer = setInterval(() => {
      const next = session.tick(elapsed());
      const self = next.drivers.find((d) => d.playerId === practicePlayerId);
      if (self && self.status === "RACING") recorder.sample(next.elapsedMs, self);
      publish();
      if (next.ended) {
        clearInterval(timer);
        settle(self?.lapTimes ?? []);
      }
    }, kartTickMs);
    return () => clearInterval(timer);
  }, [phase, paused, session, elapsed, settle, publish, recorder]);

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
    ghost,
    split,
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
        publish();
        if (result.ok && session.race.ended) settle(report.lapsMs);
        return result;
      },
      [session, settle, publish],
    ),
    useItem: useCallback(
      (raceId: string) => {
        const result = session.useItem(practicePlayerId, raceId, elapsed());
        publish();
        return result;
      },
      [session, elapsed, publish],
    ),
    recover: useCallback(
      (raceId: string) => {
        const result = session.recover(practicePlayerId, raceId, elapsed());
        publish();
        return result;
      },
      [session, elapsed, publish],
    ),
  };
}
