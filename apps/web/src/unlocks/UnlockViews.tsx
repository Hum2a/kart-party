import { AnimatePresence, motion } from "motion/react";
import {
  driverStyles,
  kartPaints,
  kartUnlocks,
  type KartUnlockId,
} from "@kart-party/game";
import { DriverEmblem } from "../kart/DriverBadge";
import { usePaintHex } from "../settings/paint";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { useUnlocked } from "./unlocks";

type Unlock = (typeof kartUnlocks)[number];

/** The paint or driver an unlock gives, by name. */
export function unlockName(unlock: Unlock): string {
  return unlock.kind === "paint"
    ? `${kartPaints.find((p) => p.id === unlock.item)?.name ?? unlock.item} paint`
    : `${driverStyles.find((s) => s.id === unlock.item)?.name ?? unlock.item} driver`;
}

function UnlockIcon({ unlock }: { unlock: Unlock }) {
  const paintHex = usePaintHex();
  return unlock.kind === "paint" ? (
    <span
      aria-hidden="true"
      className="block size-8 rounded-full border-2 border-background shadow"
      style={{ background: paintHex(unlock.item) }}
    />
  ) : (
    <span aria-hidden="true" className="block size-9">
      <DriverEmblem style={unlock.item} />
    </span>
  );
}

/** Shown on a Grand Prix's final results when it earned something new. */
export function UnlockNotice({ ids }: { ids: readonly KartUnlockId[] }) {
  const reduced = usePrefersReducedMotion();
  const fresh = kartUnlocks.filter((u) => ids.includes(u.id));
  return (
    <AnimatePresence>
      {fresh.length ? (
        <motion.section
          key="unlocked"
          role="status"
          aria-live="polite"
          className="panel grid gap-3 border-highlight p-4"
          initial={{ opacity: 0, scale: reduced ? 1 : 0.94, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 320, damping: 24, delay: 0.4 }
          }
        >
          <h3 className="wordmark text-xl text-highlight">Unlocked!</h3>
          <ul className="flex flex-wrap gap-3">
            {fresh.map((unlock, i) => (
              <motion.li
                key={unlock.id}
                className="flex items-center gap-2 font-bold"
                initial={{ opacity: 0, x: reduced ? 0 : -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduced ? 0 : 0.55 + i * 0.08, duration: 0.2 }}
              >
                <UnlockIcon unlock={unlock} />
                {unlockName(unlock)}
              </motion.li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Pick them next time you choose your driver and paint.
          </p>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

/** Every unlock, earned or not, with how to earn the rest. */
export function UnlockList() {
  const unlocked = useUnlocked();
  return (
    <ul className="grid gap-2">
      {kartUnlocks.map((unlock) => {
        const earned = unlocked.has(unlock.id);
        return (
          <li
            key={unlock.id}
            className="flex items-center gap-3"
            data-earned={earned ? "yes" : "no"}
          >
            <span className={earned ? "" : "opacity-40 grayscale"}>
              <UnlockIcon unlock={unlock} />
            </span>
            <span className="grid">
              <strong>{unlockName(unlock)}</strong>
              <span className="text-sm text-muted">
                {earned ? "Unlocked" : `Locked. ${unlock.how}.`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
