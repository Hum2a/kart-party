import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import type { KartRaceView } from "@kart-party/game";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { buzz } from "../device/haptics";
import { playSfx } from "../audio/sfx";
import { useRaceCountdown } from "./countdown";
import type { RaceStage } from "./race-stage";

/** Large 3-2-1-GO over the race. Display only. */
export function KartCountdown({
  stage,
  race,
  haptics = false,
  enabled = true,
}: {
  stage: RaceStage;
  race: KartRaceView | undefined;
  haptics?: boolean;
  enabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const beat = useRaceCountdown(stage, race, enabled);
  const last = useRef({ beat: null as typeof beat, enabled });
  useEffect(() => {
    const resuming = enabled && !last.current.enabled;
    if (
      enabled &&
      !resuming &&
      haptics &&
      beat !== null &&
      beat !== last.current.beat
    ) {
      buzz(beat === "GO" ? [40, 30, 90] : [18]);
      playSfx(beat === "GO" ? "go" : "count");
    }
    last.current = { beat, enabled };
  }, [beat, haptics, enabled]);
  return (
    <div
      className="kart-countdown"
      data-active={enabled}
      aria-hidden={!enabled}
      aria-live={enabled ? "assertive" : "off"}
      aria-atomic="true"
    >
      <AnimatePresence>
        {beat !== null ? (
          <motion.span
            key={String(beat)}
            data-beat={beat}
            initial={{ opacity: 0, scale: reduced ? 1 : 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 420, damping: 26 }
            }
          >
            {beat}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
