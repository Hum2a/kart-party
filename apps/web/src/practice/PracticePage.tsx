import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  kartTrackId,
  kartTrackName,
  nicknameSchema,
  type DriverStyle,
  type KartLaps,
  type KartTrackId,
} from "@kart-party/game";
import { Button, LinkButton, Segmented, TextField } from "../ui/primitives";
import { DriverPicker, TrackPicker } from "../race/pickers";
import { ResultsTable } from "../race/ResultsTable";
import { RaceView, type RaceActions } from "../race/RaceView";
import { saveDriver, saveName, savedDriver, savedName } from "../live/identity";
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
  const [laps, setLaps] = useState<KartLaps>(3);
  const [cpu, setCpu] = useState(3);
  const [items, setItems] = useState(true);
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
          onStart({ name: parsed.data, driver, trackId, laps, cpu, items });
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
        <TrackPicker value={trackId} onChange={setTrackId} />
        <div className="grid gap-5 sm:grid-cols-3">
          <Segmented
            label="Laps"
            value={laps}
            onChange={setLaps}
            options={[
              { value: 1, label: "1" },
              { value: 2, label: "2" },
              { value: 3, label: "3" },
            ]}
          />
          <Segmented
            label="CPU racers"
            value={cpu}
            onChange={setCpu}
            options={[0, 1, 3, 5, 7].map((n) => ({
              value: n,
              label: n === 0 ? "Time trial" : String(n),
            }))}
          />
          <Segmented
            label="Items"
            value={items ? "on" : "off"}
            onChange={(value) => setItems(value === "on")}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </div>
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
    () => new Map([[practicePlayerId, { style: setup.driver }]]),
    [setup.driver],
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
