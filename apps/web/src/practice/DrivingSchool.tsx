import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KartInput } from "@kart-party/game";
import { Button, LinkButton } from "../ui/primitives";
import { RaceView, type RaceActions } from "../race/RaceView";
import { savedDriver, savedName, savedPaint } from "../live/identity";
import { useLocalRace, practicePlayerId, type PracticeSetup } from "./local-race";
import {
  advanceSchool,
  schoolDone,
  schoolInstruction,
  schoolStart,
  schoolSteps,
  schoolTitle,
  skipSchoolStep,
  type SchoolProgress,
} from "./school";
import { updateSettings, useSetting } from "../settings/settings";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { useMusic } from "../audio/use-music";
import { playSfx } from "../audio/sfx";

const touchScreen = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/**
 * A guided practice lap: six short steps on the Party Ring at 50cc, with
 * items on and no other karts. Nothing here is saved as a best time.
 */
export function DrivingSchool() {
  useMusic("menu");
  const reduced = usePrefersReducedMotion();
  const keys = useSetting((value) => value.keys);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState<SchoolProgress>(schoolStart);
  const setup = useMemo<PracticeSetup>(
    () => ({
      name: savedName() || "Racer",
      driver: savedDriver() ?? "racer",
      paint: savedPaint() ?? "flame",
      trackId: "party-ring-v1",
      laps: 3,
      cpu: 0,
      cpuLevel: "easy",
      items: "all",
      speedClass: "50",
      record: false,
    }),
    [],
  );
  const local = useLocalRace(setup, run);
  const steer = useRef(0);
  const itemUsed = useRef(false);
  const recovered = useRef(false);
  const lastSample = useRef(0);

  const actions = useMemo<RaceActions>(
    () => ({
      input: (input: KartInput) => {
        steer.current = input.steer;
        local.onInput(input);
      },
      finish: local.onFinish,
      item: (raceId: string) => {
        const ack = local.useItem(raceId);
        if (ack.ok) itemUsed.current = true;
        return ack;
      },
      recover: (raceId: string) => {
        const ack = local.recover(raceId);
        if (ack.ok) recovered.current = true;
        return ack;
      },
    }),
    [local.onInput, local.onFinish, local.useItem, local.recover],
  );
  const drivers = useMemo(
    () => new Map([[practicePlayerId, { style: setup.driver, paint: setup.paint }]]),
    [setup],
  );

  // Each published race view is one sample. The school only watches; the race decides.
  const race = local.race;
  const self = race.participants.find((d) => d.playerId === practicePlayerId);
  const itemHeld = Boolean(race.powers?.selfItem);
  useEffect(() => {
    if (!self || local.stage.phase !== "racing") return;
    const dt = lastSample.current
      ? Math.max(0, race.elapsedMs - lastSample.current)
      : 0;
    lastSample.current = race.elapsedMs;
    const sample = {
      speed: self.speed,
      steer: steer.current,
      driftLevel: self.driftLevel ?? 0,
      boosting: self.boostRemainingMs > 0,
      itemHeld,
      itemUsed: itemUsed.current,
      recovered: recovered.current,
    };
    itemUsed.current = false;
    recovered.current = false;
    setProgress((current) => {
      const next = advanceSchool(current, sample, dt);
      if (next.step !== current.step) playSfx("ui-confirm");
      return next;
    });
  }, [race, self, itemHeld, local.stage.phase]);

  const done = schoolDone(progress);
  useEffect(() => {
    if (done) {
      updateSettings({ schoolDone: true });
      playSfx("podium");
    }
  }, [done]);

  const step = schoolSteps[progress.step];
  const touch = touchScreen();
  const restart = useCallback(() => {
    lastSample.current = 0;
    setRun((n) => n + 1);
  }, []);
  const ranOut = Boolean(local.outcome) && !done;

  return (
    <div className="relative">
      <RaceView
        stage={local.stage}
        race={race}
        actions={actions}
        drivers={drivers}
        footer={<p className="text-muted">That is the end of the practice laps.</p>}
      />
      <AnimatePresence mode="wait">
        {done ? (
          <motion.section
            key="passed"
            className="school-card school-card-done panel grid gap-3 p-5"
            aria-labelledby="school-done-heading"
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 300, damping: 26 }
            }
          >
            <h2 id="school-done-heading" className="wordmark text-3xl">
              You have passed
            </h2>
            <p className="text-muted">
              Accelerate, steer, drift, boost, items and getting back on the track. That
              is everything. Keep driving here, or start a proper race.
            </p>
            <div className="flex flex-wrap gap-2">
              <LinkButton to="/practice">Start a race</LinkButton>
              <LinkButton to="/play" variant="secondary">
                Race friends
              </LinkButton>
              <Button
                variant="secondary"
                onClick={() => {
                  setProgress(schoolStart);
                  restart();
                }}
              >
                Take it again
              </Button>
            </div>
          </motion.section>
        ) : step ? (
          <motion.section
            key={`step-${progress.step}`}
            className="school-card panel grid gap-2 p-4"
            aria-labelledby="school-step-heading"
            aria-live="polite"
            initial={{ opacity: 0, y: reduced ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Driving school · Step {progress.step + 1} of {schoolSteps.length}
            </p>
            <h2 id="school-step-heading" className="wordmark text-2xl">
              {schoolTitle[step]}
            </h2>
            <p>{schoolInstruction(step, keys, touch, itemHeld)}</p>
            {step === "steer" ? (
              <p className="text-sm text-muted">
                Left {progress.steeredLeft ? "✓" : "…"} · Right{" "}
                {progress.steeredRight ? "✓" : "…"}
              </p>
            ) : null}
            <ol className="school-dots" aria-label="Steps">
              {schoolSteps.map((name, i) => (
                <li
                  key={name}
                  data-state={
                    i < progress.step ? "done" : i === progress.step ? "now" : "next"
                  }
                  aria-label={`${schoolTitle[name]}${i < progress.step ? ", done" : i === progress.step ? ", now" : ""}`}
                />
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="settings-small-button motion-press"
                onClick={() => setProgress(skipSchoolStep)}
              >
                Skip this step
              </button>
              <LinkButton
                to="/"
                variant="secondary"
                className="min-h-10 px-3 text-base"
                onClick={() => updateSettings({ schoolDone: true })}
              >
                Leave
              </LinkButton>
            </div>
            {ranOut ? (
              <div className="grid gap-2">
                <p className="font-bold">The practice laps are over.</p>
                <Button onClick={restart}>Keep going on a fresh lap</Button>
              </div>
            ) : null}
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
