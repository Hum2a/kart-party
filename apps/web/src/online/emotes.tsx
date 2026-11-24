import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { kartEmotes, type KartEmote } from "@kart-party/game";
import type { EmoteEvent } from "../live/room-socket";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { playSfx } from "../audio/sfx";

export const emoteGlyph: Record<KartEmote, string> = {
  wave: "👋",
  thumbs: "👍",
  laugh: "😂",
  wow: "😮",
  grr: "😤",
  fire: "🔥",
  clap: "👏",
  trophy: "🏆",
};
export const emoteLabel: Record<KartEmote, string> = {
  wave: "Wave",
  thumbs: "Thumbs up",
  laugh: "Laugh",
  wow: "Wow",
  grr: "Grr",
  fire: "On fire",
  clap: "Clap",
  trophy: "Trophy",
};

/** Matches the room's burst allowance, so a held tap does not look broken. */
const localGapMs = 600;

/** A row of reaction buttons. Sending is fire-and-forget. */
export function EmoteBar({
  onSend,
  disabled = false,
  compact = false,
}: {
  onSend: (emote: KartEmote) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const last = useRef(0);
  return (
    <div
      role="group"
      aria-label="Send a reaction"
      className={`emote-bar ${compact ? "emote-bar-compact" : ""}`}
    >
      {kartEmotes.map((emote) => (
        <button
          key={emote}
          type="button"
          className="emote-button motion-press"
          disabled={disabled}
          aria-label={emoteLabel[emote]}
          title={emoteLabel[emote]}
          onClick={(event) => {
            const now = performance.now();
            if (now - last.current < localGapMs) return;
            last.current = now;
            onSend(emote);
            event.currentTarget.blur();
          }}
        >
          <span aria-hidden="true">{emoteGlyph[emote]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Reactions from everyone in the room, floating in a corner. They never take
 * pointer events, so they cannot cover a control. Screen readers hear the name.
 */
export function EmoteFeed({
  emotes,
  names,
  selfId,
}: {
  emotes: EmoteEvent[];
  names: ReadonlyMap<string, string>;
  selfId?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [heard, setHeard] = useState(-1);
  const latest = emotes.at(-1);
  useEffect(() => {
    if (!latest || latest.id <= heard) return;
    setHeard(latest.id);
    if (latest.playerId !== selfId) playSfx("ui-tap");
  }, [latest, heard, selfId]);
  return (
    <div className="emote-feed" aria-live="polite">
      <AnimatePresence initial={false}>
        {emotes.map((item) => (
          <motion.p
            key={item.id}
            layout={reduced ? false : "position"}
            className="emote-toast"
            initial={{ opacity: 0, x: reduced ? 0 : 24, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : -12 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 28 }
            }
          >
            <span className="emote-toast-glyph" aria-hidden="true">
              {emoteGlyph[item.emote]}
            </span>
            <span className="emote-toast-name">
              {item.playerId === selfId
                ? "You"
                : (names.get(item.playerId) ?? "Someone")}
            </span>
            <span className="sr-only">{emoteLabel[item.emote]}</span>
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
