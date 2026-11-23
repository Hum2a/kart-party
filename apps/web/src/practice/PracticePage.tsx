import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  kartTrackId,
  kartTrackName,
  nicknameSchema,
  type DriverStyle,
  type KartLaps,
  type KartPaint,
  type KartTrackId,
} from "@kart-party/game";
import { Button, LinkButton, TextField } from "../ui/primitives";
import { RaceOptions, type RaceRules } from "../race/RaceOptions";
import { DriverPicker, PaintPicker, TrackPicker } from "../race/pickers";
import { ResultsTable } from "../race/ResultsTable";
import { RaceView, type RaceActions } from "../race/RaceView";
import {
  saveDriver,
  saveName,
  savePaint,
  savedDriver,
  savedName,
  savedPaint,
} from "../live/identity";
import { useLocalRace, practicePlayerId, type PracticeSetup } from "./local-race";
import { formatRaceTime, readBest } from "./records";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

export function PracticePage() {
  const [setup, setSetup] = useState<PracticeSetup | null>(null);
  const [run, setRun] = useState(0);
  if (!setup)
    return (
      <PracticeSetupForm
        onStart={(value) => {
          setSetup(value);
          setRun((n) => n + 1);
        }}
      />
    );
  return (
    <PracticeRace
      key={run}
      setup={setup}
      run={run}
      onAgain={() => setRun((n) => n + 1)}
      onChange={() => setSetup(null)}
    />
  );
}

function PracticeSetupForm({ onStart }: { onStart: (setup: PracticeSetup) => void }) {
  const [name, setName] = useState(() => savedName() || "Racer");
  const [driver, setDriver] = useState<DriverStyle>(() => savedDriver() ?? "racer");
  const [trackId, setTrackId] = useState<KartTrackId>(kartTrackId);
  const [paint, setPaint] = useState<KartPaint>(() => savedPaint() ?? "flame");
  const [rules, setRules] = useState<RaceRules>({
    laps: 3,
    cpu: 3,
    cpuLevel: "normal",
    items: "all",
  });
  const laps: KartLaps = rules.laps;
  const [error, setError] = useState("");
  const best = readBest({ trackId, laps });
  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 pb-16 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <LinkButton
            to="/"
            variant="secondary"
            className="mb-4 min-h-10 px-3 text-base"
          >
            ← Home
          </LinkButton>
          <h1 className="wordmark text-4xl sm:text-5xl">Practice</h1>
          <p className="text-muted">Race CPU drivers or set a time on your own.</p>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {best
            ? `Your best on ${kartTrackName(trackId)} (${laps} ${laps === 1 ? "lap" : "laps"}): ${formatRaceTime(best.timeMs)}`
            : "No best time here yet."}
        </p>
      </header>
      <form
        className="panel grid gap-6 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = nicknameSchema.safeParse(name);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Choose a name.");
            return;
          }
          saveName(parsed.data);
          saveDriver(driver);
          savePaint(paint);
          onStart({ name: parsed.data, driver, paint, trackId, ...rules });
        }}
      >
        <TextField
          label="Your name"
          value={name}
          maxLength={16}
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          error={error}
        />
        <DriverPicker value={driver} onChange={setDriver} />
        <PaintPicker value={paint} onChange={setPaint} />
        <TrackPicker value={trackId} onChange={setTrackId} />
        <RaceOptions value={rules} onChange={setRules} timeTrialLabel />
        <Button type="submit" className="justify-self-start px-10">
          Start race
        </Button>
      </form>
    </main>
  );
}

function PracticeRace({
  setup,
  run,
  onAgain,
  onChange,
}: {
  setup: PracticeSetup;
  run: number;
  onAgain: () => void;
  onChange: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const local = useLocalRace(setup, run);
  const actions = useMemo<RaceActions>(
    () => ({
      input: local.onInput,
      finish: local.onFinish,
      item: local.useItem,
      recover: local.recover,
    }),
    [local.onInput, local.onFinish, local.useItem, local.recover],
  );
  const drivers = useMemo(
    () => new Map([[practicePlayerId, { style: setup.driver, paint: setup.paint }]]),
    [setup.driver, setup.paint],
  );
  const outcome = local.outcome;
  return (
    <div className="relative">
      <RaceView
        stage={local.stage}
        race={local.race}
        actions={actions}
        drivers={drivers}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button onClick={onAgain}>Race again</Button>
            <Button variant="secondary" onClick={onChange}>
              Change race
            </Button>
          </div>
        }
      />
      {local.stage.phase !== "done" ? (
        <div className="practice-menu">
          <Button
            variant="secondary"
            className="min-h-10 px-3 text-base"
            aria-pressed={local.paused}
            onClick={() => local.pause(!local.paused)}
          >
            {local.paused ? "Resume" : "Pause"}
          </Button>
          <AnimatePresence>
            {local.paused ? (
              <motion.div
                key="paused"
                className="practice-paused panel grid gap-3 p-5"
                initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.18 }}
                role="dialog"
                aria-label="Paused"
              >
                <h2 className="wordmark text-3xl">Paused</h2>
                <Button onClick={() => local.pause(false)}>Resume</Button>
                <Button variant="secondary" onClick={onAgain}>
                  Restart
                </Button>
                <Button variant="secondary" onClick={onChange}>
                  Quit to setup
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      <AnimatePresence>
        {outcome ? (
          <motion.section
            key="results"
            className="practice-results panel grid gap-4 p-5"
            initial={{ opacity: 0, y: reduced ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 300, damping: 28 }
            }
            aria-labelledby="practice-results-heading"
          >
            <h2 id="practice-results-heading" className="wordmark text-3xl">
              Results
            </h2>
            {outcome.best ? (
              <p
                className={outcome.improved ? "font-bold text-highlight" : "text-muted"}
              >
                {outcome.improved
                  ? `New personal best: ${formatRaceTime(outcome.best.timeMs)}`
                  : `Personal best: ${formatRaceTime(outcome.best.timeMs)}`}
              </p>
            ) : null}
            <ResultsTable results={outcome.results} selfId={practicePlayerId} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onAgain}>Race again</Button>
              <Button variant="secondary" onClick={onChange}>
                Change race
              </Button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
