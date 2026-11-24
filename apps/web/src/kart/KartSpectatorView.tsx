import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { KartRaceView } from "@kart-party/game";
import { KartMap } from "./KartMap";
import { useKartGraphics } from "./graphics-preferences";
import { liveKartVfxPreset } from "./live-vfx";
import { liveKartLookPreset } from "./live-look";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { ordinal } from "./race-callouts";
import "./kart.css";
const KartCanvas = lazy(() => import("./KartCanvas"));

/** A finger uses the phone renderer. A mouse gets the desktop one. */
const coarsePointer = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/** "overview" frames the whole track from above; otherwise a racer's id. */
export type SpectatorTarget = "overview" | string;

/** Who to follow next: racers in their current race order, wrapping round. */
export function nextTarget(
  race: KartRaceView,
  current: SpectatorTarget,
  step: 1 | -1,
): string | undefined {
  const order = race.leaderboard.map((row) => row.playerId);
  if (order.length === 0) return undefined;
  const index = order.indexOf(current);
  if (index === -1) return order[step === 1 ? 0 : order.length - 1];
  return order[(index + step + order.length) % order.length];
}

/**
 * Watching a race without driving: a late joiner, or a racer who has already
 * crossed the line. Follow any kart in 3D or switch to an overview of the
 * whole track. Nothing here sends anything to the room.
 */
export function KartSpectatorView({
  race,
  initial,
}: {
  race: KartRaceView;
  /** Who to follow first, for example the racer who just finished. */
  initial?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [target, setTarget] = useState<SpectatorTarget>(
    () => initial ?? race.leaderboard[0]?.playerId ?? "overview",
  );
  const [map, setMap] = useState(false);
  const graphics = useKartGraphics(race.participantCount ?? race.participants.length);
  // A followed racer who has left the race hands over to the leader.
  const followed =
    target === "overview"
      ? undefined
      : race.participants.find((driver) => driver.playerId === target);
  useEffect(() => {
    if (target !== "overview" && !followed)
      setTarget(race.leaderboard[0]?.playerId ?? "overview");
  }, [target, followed, race.leaderboard]);
  const place = race.leaderboard.find((row) => row.playerId === target)?.place;
  const step = (direction: 1 | -1) => {
    const next = nextTarget(race, target, direction);
    if (next) setTarget(next);
  };
  return (
    <section className="kart-watch" aria-label="Watching the race">
      <div
        className="kart-driver-viewport kart-watch-viewport"
        data-view={map ? "map" : "chase"}
      >
        <div className="kart-driver-map">
          <KartMap race={race} />
        </div>
        {!map ? (
          <Suspense
            fallback={<p className="kart-driver-loading">Preparing the 3D view…</p>}
          >
            <KartCanvas
              // The camera type changes between following and the overview.
              key={`${race.raceId}-${followed ? "follow" : "overview"}`}
              race={race}
              mobile={coarsePointer()}
              reducedMotion={reduced}
              spectator
              followPlayerId={followed?.playerId}
              vfxPreset={liveKartVfxPreset(race.effectsEnabled)}
              lookPreset={liveKartLookPreset(race.look)}
              graphicsTier={graphics.tier}
              sharp={graphics.mode === "high"}
              onFrameHealth={graphics.onHealth}
            />
          </Suspense>
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={target}
            className="kart-watch-label"
            role="status"
            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.18, ease: "easeOut" }}
          >
            {followed
              ? `Watching ${followed.name}${place ? ` · ${ordinal(place)}` : ""}`
              : "Watching the whole track"}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="kart-watch-controls">
        <button
          type="button"
          className="kart-watch-button motion-press"
          aria-label="Previous racer"
          onClick={() => step(-1)}
        >
          ◀
        </button>
        <button
          type="button"
          className="kart-watch-button motion-press"
          aria-pressed={target === "overview"}
          onClick={() =>
            setTarget(
              target === "overview"
                ? (race.leaderboard[0]?.playerId ?? "overview")
                : "overview",
            )
          }
        >
          {target === "overview" ? "Follow the leader" : "Overview"}
        </button>
        <button
          type="button"
          className="kart-watch-button motion-press"
          aria-label="Next racer"
          onClick={() => step(1)}
        >
          ▶
        </button>
        <button
          type="button"
          className="kart-watch-button motion-press"
          aria-pressed={map}
          onClick={() => setMap((value) => !value)}
        >
          {map ? "3D view" : "Map"}
        </button>
      </div>
    </section>
  );
}
