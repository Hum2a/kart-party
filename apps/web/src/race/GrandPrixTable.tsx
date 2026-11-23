import { AnimatePresence, motion } from "motion/react";
import {
  kartCup,
  kartTrackName,
  type GrandPrixRow,
  type KartCupId,
} from "@kart-party/game";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};

/** The running Grand Prix standings, with each race's points. */
export function GrandPrixTable({
  cupId,
  table,
  round,
  selfId,
}: {
  cupId: KartCupId;
  table: readonly GrandPrixRow[];
  /** Races finished so far. */
  round: number;
  selfId?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const cup = kartCup(cupId);
  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold uppercase tracking-wide text-muted">
        {cup.name} ·{" "}
        {round >= cup.tracks.length
          ? "Final standings"
          : `After race ${round} of ${cup.tracks.length}`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-separate border-spacing-y-1 text-left">
          <caption className="sr-only">Grand Prix standings</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="w-12 px-2">
                Pos
              </th>
              <th scope="col" className="px-2">
                Racer
              </th>
              {cup.tracks.map((trackId, i) => (
                <th
                  key={`${trackId}-${i}`}
                  scope="col"
                  className="px-2 text-right"
                  title={kartTrackName(trackId)}
                >
                  R{i + 1}
                </th>
              ))}
              <th scope="col" className="px-2 text-right">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial>
              {table.map((row, i) => (
                <motion.tr
                  key={row.playerId}
                  layout={reduced ? false : "position"}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduced ? 0 : i * 0.04,
                    duration: reduced ? 0.12 : 0.25,
                  }}
                  className={
                    row.playerId === selfId
                      ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]"
                      : "bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]"
                  }
                >
                  <td className="rounded-l-[var(--radius-control)] px-2 py-2 font-black italic">
                    {ordinal(row.place)}
                  </td>
                  <td className="px-2 py-2 font-bold">
                    {row.name}
                    {row.playerId === selfId ? (
                      <span className="ml-2 text-xs text-highlight">YOU</span>
                    ) : null}
                  </td>
                  {cup.tracks.map((trackId, raceIndex) => (
                    <td
                      key={`${trackId}-${raceIndex}`}
                      className="px-2 py-2 text-right tabular-nums text-muted"
                    >
                      {raceIndex < round ? (row.races[raceIndex] ?? "–") : ""}
                    </td>
                  ))}
                  <td className="rounded-r-[var(--radius-control)] px-2 py-2 text-right text-lg font-black tabular-nums">
                    {row.points}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The top three on a podium, second on the left and third on the right. */
export function Podium({
  table,
  selfId,
}: {
  table: readonly GrandPrixRow[];
  selfId?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const steps = [
    { row: table[1], height: "h-20", label: "2nd" },
    { row: table[0], height: "h-28", label: "1st" },
    { row: table[2], height: "h-14", label: "3rd" },
  ];
  return (
    <ol className="grid grid-cols-3 items-end gap-2" aria-label="Podium">
      {steps.map(({ row, height, label }, i) =>
        row ? (
          <motion.li
            key={row.playerId}
            className="grid justify-items-center gap-1 text-center"
            initial={{ opacity: 0, y: reduced ? 0 : 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : {
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                    delay: [0.25, 0.5, 0][i],
                  }
            }
          >
            <span
              className={`text-sm font-bold ${row.playerId === selfId ? "text-highlight" : ""}`}
            >
              {row.name}
            </span>
            <span className="text-xs text-muted">{row.points} pts</span>
            <span
              className={`skin-control grid w-full place-items-center ${height} ${
                i === 1
                  ? "bg-accent text-accent-foreground"
                  : "border border-line bg-surface"
              } text-2xl font-black italic`}
            >
              {label}
            </span>
          </motion.li>
        ) : (
          <li key={label} aria-hidden="true" />
        ),
      )}
    </ol>
  );
}
