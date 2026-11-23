import { AnimatePresence, motion } from "motion/react";
import type { RaceResult } from "@kart-party/game";
import { formatRaceTime } from "../practice/records";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};

export function ResultsTable({
  results,
  selfId,
}: {
  results: readonly RaceResult[];
  selfId?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <ol className="grid gap-2" aria-label="Race results">
      <AnimatePresence initial>
        {results.map((row, i) => (
          <motion.li
            key={row.playerId}
            initial={{ opacity: 0, x: reduced ? 0 : -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: reduced ? 0 : i * 0.05,
              duration: reduced ? 0.12 : 0.25,
            }}
            className={`skin-control flex items-center gap-3 border px-3 py-2 ${
              row.playerId === selfId
                ? "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
                : "border-line"
            }`}
          >
            <span className="w-10 text-xl font-black italic">{ordinal(row.place)}</span>
            <span className="flex-1 truncate font-bold">
              {row.name}
              {row.playerId === selfId ? (
                <span className="ml-2 text-xs text-highlight">YOU</span>
              ) : null}
            </span>
            <span className="tabular-nums text-muted">
              {row.timeMs === null ? "DNF" : formatRaceTime(row.timeMs)}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
