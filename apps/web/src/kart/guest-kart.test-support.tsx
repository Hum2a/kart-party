import type { ComponentProps } from "react";
import type { KartRaceView } from "@kart-party/game";
import { RaceScreen } from "./RaceScreen";
import type { RaceStage } from "./race-stage";

/**
 * Test adapter for specs written against a room snapshot: a phase, pause flags,
 * a phase deadline and the race. It maps them onto the race stage so the same
 * assertions exercise the real RaceScreen.
 */
export type LobbySnapshot = {
  phase: string;
  paused?: boolean;
  held?: boolean;
  deadlineAt?: number | null;
  serverNow?: number;
  mode?: string;
  play?: { kart?: KartRaceView; question?: unknown; selfAward?: number | null };
};

export function stageFor(snapshot: LobbySnapshot): RaceStage {
  const phase =
    snapshot.phase === "collect"
      ? "racing"
      : snapshot.phase === "intro" || snapshot.phase === "prompt"
        ? "grid"
        : "done";
  return {
    phase,
    paused: Boolean(snapshot.paused || snapshot.held),
    ...(snapshot.phase === "prompt" && typeof snapshot.deadlineAt === "number"
      ? { goAt: snapshot.deadlineAt }
      : {}),
    now: () => snapshot.serverNow ?? Date.now(),
  };
}

export function GuestKart({
  snapshot,
  ...props
}: { snapshot: LobbySnapshot; observedAt?: number } & Omit<
  ComponentProps<typeof RaceScreen>,
  "stage" | "race"
>) {
  const { observedAt: _observedAt, ...rest } = props as typeof props & {
    observedAt?: number;
  };
  void _observedAt;
  return <RaceScreen stage={stageFor(snapshot)} race={snapshot.play?.kart} {...rest} />;
}
