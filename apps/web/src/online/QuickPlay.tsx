import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  kartCup,
  kartTrackName,
  maxRoomPlayers,
  type PublicRoom,
} from "@kart-party/game";
import { Button } from "../ui/primitives";
import { listPublicRooms } from "../api/rooms";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

/** The list refreshes on its own while the page is visible. */
const refreshMs = 15_000;

const phaseWords: Record<PublicRoom["phase"], string> = {
  lobby: "In the lobby",
  results: "Between races",
  countdown: "Starting",
  racing: "Racing now: watch, then join the next race",
};

/**
 * Rooms whose hosts chose to list them. The list shows codes and numbers
 * only, never anyone's name.
 */
export function QuickPlay({
  onJoin,
  fetcher,
}: {
  onJoin: (code: string) => void;
  fetcher?: typeof fetch;
}) {
  const reduced = usePrefersReducedMotion();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listPublicRooms(fetcher);
    setLoading(false);
    setFailed(!result.ok);
    if (result.ok) setRooms(result.rooms);
  }, [fetcher]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, refreshMs);
    return () => clearInterval(timer);
  }, [refresh]);
  return (
    <section className="panel grid gap-4 p-5" aria-labelledby="quick-play-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="quick-play-heading" className="wordmark text-2xl">
          Quick play
        </h2>
        <Button
          variant="secondary"
          className="min-h-10 px-3 text-base"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? "Checking…" : "Refresh"}
        </Button>
      </div>
      <p className="text-muted" role="status">
        {failed
          ? "Could not load open rooms. Check your connection and refresh."
          : rooms === null
            ? "Looking for open rooms…"
            : rooms.length === 0
              ? "No open rooms right now. Create one and tick “List on quick play”."
              : `${rooms.length} open ${rooms.length === 1 ? "room" : "rooms"}`}
      </p>
      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {(rooms ?? []).map((room) => (
            <motion.li
              key={room.code}
              layout={reduced ? false : "position"}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.1 : 0.2 }}
              className="skin-control flex flex-wrap items-center gap-3 border border-line px-3 py-2"
            >
              <span className="font-mono text-2xl font-black tracking-[0.2em] text-accent">
                {room.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {room.mode === "grandPrix"
                    ? `${kartCup(room.cupId).name} Grand Prix`
                    : kartTrackName(room.trackId)}
                </span>
                <span className="block text-sm text-muted">
                  {room.players}/{maxRoomPlayers} racers · {phaseWords[room.phase]}
                </span>
              </span>
              <Button
                className="min-h-11 px-5 text-base"
                aria-label={`Join room ${room.code}`}
                onClick={() => onJoin(room.code)}
              >
                Join
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
