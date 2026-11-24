import { useCallback, useEffect, useRef, useState } from "react";
import type { KartRaceView } from "@kart-party/game";
import { buzz } from "../device/haptics";
import { createRaceAudio, type RaceAudio } from "./race-audio";
import { mixer } from "../audio/mixer";
import { music, type MusicPlayer } from "../audio/music";
import { raceTheme } from "../audio/music-themes";
import type { SfxName } from "../audio/sfx";
import { ordinal, selfCues, type SelfCue } from "./race-callouts";
import { selfHitCues } from "./hit-feed";

export type RaceBanner = {
  id: string;
  text: string;
  tone: "lap" | "final" | "place" | "hit" | "landed";
};

/** Roughly the circuit kart's top speed in metres a second, for the engine note. */
const topSpeed = 30;
export const bannerMs = 2200;

function bannerFor(cue: SelfCue, at: number): RaceBanner | undefined {
  if (cue.kind === "launch")
    return cue.grade === "perfect"
      ? { id: `launch-${at}`, text: "PERFECT START!", tone: "final" }
      : { id: `launch-${at}`, text: "Good start!", tone: "lap" };
  if (cue.kind === "final-lap")
    return { id: `final-${at}`, text: "FINAL LAP", tone: "final" };
  if (cue.kind === "lap")
    return {
      id: `lap-${cue.lap}-${at}`,
      text: `Lap ${cue.lap} of ${cue.laps}`,
      tone: "lap",
    };
  if (cue.kind === "place" && cue.gained)
    return {
      id: `place-${cue.place}-${at}`,
      text: `Up to ${ordinal(cue.place)}!`,
      tone: "place",
    };
  return undefined;
}

const heldItem = (race: KartRaceView | undefined) =>
  race?.presentation?.version === 3
    ? race.presentation.items.heldItem
    : (race?.powers?.selfItem ?? null);

/**
 * This racer's moments: banners for laps, the final lap and place gains, who
 * hit you and who you hit, buzzes, and sound: the engine note, drift tiers,
 * boosts, item pickups and uses, bumps, landings, and the track's music.
 */
export function useRaceFeedback(
  race: KartRaceView | undefined,
  {
    open,
    audio: injected,
    player = music(),
  }: { open: boolean; audio?: RaceAudio; player?: MusicPlayer },
) {
  const [audio] = useState(() => injected ?? createRaceAudio());
  const [soundOn, setSoundOn] = useState(() => audio.enabled);
  const [banner, setBanner] = useState<RaceBanner>();
  const previous = useRef<KartRaceView | undefined>(undefined);
  const seenHits = useRef(new Set<number>());
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(
    () =>
      injected
        ? undefined
        : mixer().subscribe((prefs, ready) => setSoundOn(ready && !prefs.muted)),
    [injected],
  );
  const toggleSound = useCallback(() => {
    if (soundOn) {
      audio.disable();
      setSoundOn(false);
      return;
    }
    setSoundOn(audio.enable());
  }, [audio, soundOn]);
  // The track's own theme plays for the whole race.
  const raceId = race?.raceId;
  const trackId = race?.trackId;
  useEffect(() => {
    if (!raceId || !trackId) return;
    player.play(raceTheme(trackId));
    return () => player.stop();
  }, [raceId, trackId, player]);
  useEffect(() => {
    if (!race) return;
    const self = race.participants.find((d) => d.playerId === race.selfPlayerId);
    const racing = Boolean(self && self.status === "RACING" && !race.ended);
    audio.engine(
      (self?.speed ?? 0) / topSpeed,
      open && racing,
      (self?.boostRemainingMs ?? 0) > 0,
    );
    const before = previous.current;
    previous.current = race;
    const was = before?.participants.find((d) => d.playerId === race.selfPlayerId);
    const same = before?.raceId === race.raceId;
    if (!same) seenHits.current.clear();
    if (same && open && self && was) {
      const tier = self.driftLevel ?? 0;
      if (tier > (was.driftLevel ?? 0))
        audio.cue(`drift-${Math.min(3, tier)}` as SfxName);
      if (self.boostRemainingMs > 0 && was.boostRemainingMs === 0)
        audio.cue(`boost-${Math.max(1, Math.min(3, self.boostLevel || 1))}` as SfxName);
      if (self.contact && !was.contact) audio.cue("bump");
      if ((was.height ?? 0) > 0 && !(self.height ?? 0)) audio.cue("land");
      if (self.slipstream === "active" && was.slipstream !== "active")
        audio.cue("slipstream");
      const held = heldItem(race),
        had = heldItem(before);
      if (held && !had) audio.cue("item-box");
      if (!held && had) audio.cue(`item-${had}` as SfxName);
    }
    for (const hit of selfHitCues(race, seenHits.current)) {
      if (!open) continue;
      setBanner({
        id: `hit-${hit.eventId}`,
        text: hit.text,
        tone: hit.kind === "landed" ? "landed" : hit.kind === "hit" ? "hit" : "lap",
      });
      if (hit.kind === "hit") {
        audio.cue("hit");
        buzz([70, 40, 140]);
      } else if (hit.kind === "landed") {
        audio.cue("hit-landed");
        buzz([25, 30, 25]);
      } else buzz(30);
    }
    for (const cue of selfCues(before, race)) {
      const next = bannerFor(cue, race.elapsedMs);
      if (next) setBanner(next);
      if (cue.kind === "finish") {
        audio.cue("finish");
        player.stop(0.4);
        buzz([90, 60, 90, 60, 220]);
      } else if (cue.kind === "final-lap") {
        audio.cue("final-lap");
        player.setTempo(1.1);
        buzz([60, 50, 60]);
      } else if (cue.kind === "lap") {
        audio.cue("lap");
        buzz(60);
      } else if (cue.kind === "launch") {
        audio.cue(cue.grade === "perfect" ? "launch-perfect" : "launch-good");
        buzz(cue.grade === "perfect" ? [40, 30, 90] : 50);
      } else if (cue.gained) {
        audio.cue("place-up");
        buzz(30);
      }
    }
  }, [race, open, audio, player]);
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(undefined), bannerMs);
    return () => clearTimeout(timer);
  }, [banner]);
  return { banner, soundOn, toggleSound };
}
