import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  grandPrixDone,
  grandPrixNextTrack,
  grandPrixTable,
  kartCup,
  kartTrackId,
  kartTrackName,
  nicknameSchema,
  type DriverStyle,
  type GrandPrixState,
  type KartCupId,
  type KartPaint,
  type KartTrackId,
  type RaceResult,
} from "@kart-party/game";
import { Button, LinkButton, Segmented, TextField } from "../ui/primitives";
import { RaceOptions, type RaceRules } from "../race/RaceOptions";
import { CupPicker, DriverPicker, PaintPicker, TrackPicker } from "../race/pickers";
import { ResultsTable } from "../race/ResultsTable";
import { GrandPrixTable, Podium } from "../race/GrandPrixTable";
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
import { formatGap, formatRaceTime, readBest, readGhost } from "./records";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

type PracticeMode = "race" | "grandPrix";
type PracticePlan = {
  mode: PracticeMode;
  cupId: KartCupId;
  /** Everything but the track, which a Grand Prix takes from its cup. */
  setup: PracticeSetup;
};

export function PracticePage() {
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [run, setRun] = useState(0);
  const [grandPrix, setGrandPrix] = useState<GrandPrixState | null>(null);
  // The track is fixed when a race starts, so the table updating cannot change it.
  const [trackId, setTrackId] = useState<KartTrackId>(kartTrackId);
  const begin = (next: GrandPrixState | null, fallback: KartTrackId) => {
    setGrandPrix(next);
    setTrackId(next ? (grandPrixNextTrack(next) ?? fallback) : fallback);
    setRun((n) => n + 1);
  };
  if (!plan)
    return (
      <PracticeSetupForm
        onStart={(value) => {
          setPlan(value);
          begin(
            value.mode === "grandPrix" ? { cupId: value.cupId, races: [] } : null,
            value.setup.trackId,
          );
        }}
      />
    );
  return (
    <PracticeRace
      key={run}
      setup={{ ...plan.setup, trackId }}
      run={run}
      grandPrix={grandPrix}
      onFinished={(results) =>
        setGrandPrix((gp) => (gp ? { ...gp, races: [...gp.races, results] } : gp))
      }
      onAgain={() => {
        // After the final race, "again" starts a fresh cup; otherwise rerun this track.
        if (grandPrix && grandPrixDone(grandPrix))
          begin({ cupId: grandPrix.cupId, races: [] }, plan.setup.trackId);
        else setRun((n) => n + 1);
      }}
      onNext={() => begin(grandPrix, plan.setup.trackId)}
      onChange={() => setPlan(null)}
    />
  );
}

function PracticeSetupForm({ onStart }: { onStart: (plan: PracticePlan) => void }) {
  const [name, setName] = useState(() => savedName() || "Racer");
  const [driver, setDriver] = useState<DriverStyle>(() => savedDriver() ?? "racer");
  const [paint, setPaint] = useState<KartPaint>(() => savedPaint() ?? "flame");
  const [mode, setMode] = useState<PracticeMode>("race");
  const [trackId, setTrackId] = useState<KartTrackId>(kartTrackId);
  const [cupId, setCupId] = useState<KartCupId>("starter-cup");
  const [rules, setRules] = useState<RaceRules>({
    laps: 3,
    cpu: 3,
    cpuLevel: "normal",
    items: "all",
    speedClass: "100",
  });
  const [error, setError] = useState("");
  const key = { trackId, laps: rules.laps, speedClass: rules.speedClass };
  const best = mode === "race" ? readBest(key) : undefined;
  const ghost = mode === "race" && rules.cpu === 0 ? readGhost(key) : undefined;
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
          <p className="text-muted">
            A single race, a three-race Grand Prix, or a time trial against your ghost.
          </p>
        </div>
        {mode === "race" ? (
          <p className="text-sm text-muted" aria-live="polite">
            {best
              ? `Best on ${kartTrackName(trackId)}, ${rules.laps} ${rules.laps === 1 ? "lap" : "laps"}, ${rules.speedClass}cc: ${formatRaceTime(best.timeMs)}${best.bestLapMs ? ` · best lap ${formatRaceTime(best.bestLapMs)}` : ""}`
              : "No best time here yet."}
            {ghost ? " · Ghost ready" : ""}
          </p>
        ) : null}
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
          onStart({
            mode,
            cupId,
            setup: { name: parsed.data, driver, paint, trackId, ...rules },
          });
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
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "race", label: "Single race" },
            { value: "grandPrix", label: "Grand Prix", note: "3 races, points" },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {mode === "race" ? (
              <TrackPicker value={trackId} onChange={setTrackId} />
            ) : (
              <CupPicker value={cupId} onChange={setCupId} />
            )}
          </motion.div>
        </AnimatePresence>
        <RaceOptions
          value={rules}
          onChange={setRules}
          timeTrialLabel={mode === "race"}
        />
        <Button type="submit" className="justify-self-start px-10">
          {mode === "grandPrix"
            ? "Start Grand Prix"
            : rules.cpu === 0
              ? "Start time trial"
              : "Start race"}
        </Button>
      </form>
    </main>
  );
}

function PracticeRace({
  setup,
  run,
  grandPrix,
  onFinished,
  onAgain,
  onNext,
  onChange,
}: {
  setup: PracticeSetup;
  run: number;
  grandPrix: GrandPrixState | null;
  onFinished: (results: RaceResult[]) => void;
  onAgain: () => void;
  onNext: () => void;
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
    () =>
      new Map([
        [practicePlayerId, { style: setup.driver, paint: setup.paint }],
        ["ghost-best", { style: setup.driver, paint: "snow" as const }],
      ]),
    [setup.driver, setup.paint],
  );
  const outcome = local.outcome;
  // Hand each finished race to the Grand Prix exactly once.
  useEffect(() => {
    if (outcome) onFinished(outcome.results);
  }, [outcome]);
  const cup = grandPrix ? kartCup(grandPrix.cupId) : undefined;
  const table = grandPrix ? grandPrixTable(grandPrix.races) : [];
  const finalRace = Boolean(grandPrix && grandPrixDone(grandPrix));
  const nextTrack = grandPrix ? grandPrixNextTrack(grandPrix) : undefined;
  const [splitVisible, setSplitVisible] = useState(false);
  useEffect(() => {
    if (!local.split) return;
    setSplitVisible(true);
    const hide = setTimeout(() => setSplitVisible(false), 3_000);
    return () => clearTimeout(hide);
  }, [local.split]);
  return (
    <div className="relative">
      <RaceView
        stage={local.stage}
        race={local.race}
        actions={actions}
        drivers={drivers}
        footer={<p className="text-muted">Results are coming up…</p>}
      />
      {cup && local.stage.phase !== "done" ? (
        <p
          className="practice-round panel px-3 py-1.5 text-sm font-bold"
          aria-live="polite"
        >
          {cup.name} · Race {(grandPrix?.races.length ?? 0) + 1} of {cup.tracks.length}
        </p>
      ) : null}
      <AnimatePresence>
        {splitVisible && local.split ? (
          <motion.p
            key={`split-${local.split.lap}`}
            role="status"
            className={`practice-split panel px-4 py-2 text-xl font-black tabular-nums ${local.split.gapMs <= 0 ? "text-highlight" : "text-accent"}`}
            initial={{ opacity: 0, y: reduced ? 0 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Lap {local.split.lap} {formatGap(local.split.gapMs)} vs ghost
          </motion.p>
        ) : null}
      </AnimatePresence>
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
                  Restart race
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
          <motion.div
            key="results-backdrop"
            className="practice-results-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.3 }}
          />
        ) : null}
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
              {finalRace ? "Grand Prix complete" : "Results"}
            </h2>
            {finalRace ? <Podium table={table} selfId={practicePlayerId} /> : null}
            {!grandPrix && outcome.best ? (
              <p
                className={outcome.improved ? "font-bold text-highlight" : "text-muted"}
              >
                {outcome.improved
                  ? `New personal best: ${formatRaceTime(outcome.best.timeMs)}`
                  : `Personal best: ${formatRaceTime(outcome.best.timeMs)}`}
                {outcome.best.bestLapMs
                  ? ` · ${outcome.lapImproved ? "new " : ""}best lap ${formatRaceTime(outcome.best.bestLapMs)}`
                  : ""}
                {outcome.ghostSaved ? " · ghost saved" : ""}
              </p>
            ) : null}
            {grandPrix ? (
              <GrandPrixTable
                cupId={grandPrix.cupId}
                table={table}
                round={grandPrix.races.length}
                selfId={practicePlayerId}
              />
            ) : (
              <ResultsTable results={outcome.results} selfId={practicePlayerId} />
            )}
            <div className="flex flex-wrap gap-2">
              {grandPrix && !finalRace && nextTrack ? (
                <Button onClick={onNext}>Next race: {kartTrackName(nextTrack)}</Button>
              ) : (
                <Button onClick={onAgain}>
                  {grandPrix ? "New Grand Prix" : "Race again"}
                </Button>
              )}
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
