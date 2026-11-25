import { motion } from "motion/react";
import {
  driverStyles,
  kartCups,
  kartTrackName,
  kartPaints,
  kartTrackCatalogue,
  type DriverStyle,
  type KartPaint,
  type KartCupId,
  type KartTrackId,
  type KartTrackDefinition,
} from "@kart-party/game";
import { DriverEmblem } from "../kart/DriverBadge";
import { TrackPreview } from "./TrackPreview";
import { usePaintHex } from "../settings/paint";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { paintLock, styleLock, useUnlocked } from "../unlocks/unlocks";

const difficultyWords = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

/** A padlock over a locked choice, with how to earn it for screen readers. */
function LockBadge({ id, how }: { id: string; how: string }) {
  return (
    <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background shadow">
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <span id={id} className="sr-only">
        {`Locked. ${how}.`}
      </span>
    </span>
  );
}

/** The course features worth knowing before you pick a track. */
export function trackTraits(features: KartTrackDefinition["features"]): string[] {
  const count = (n: number, one: string, many: string) =>
    n ? [n === 1 ? one : `${n} ${many}`] : [];
  return [
    ...count(features.shortcuts, "a shortcut", "shortcuts"),
    ...count(features.alternates, "an alternate route", "alternate routes"),
    ...count(features.bridges, "a narrow bridge", "narrow bridges"),
    ...count(features.ramps, "a jump", "jumps"),
    ...count(features.hazards, "a hazard", "hazards"),
  ];
}

export function TrackPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: KartTrackId;
  onChange: (trackId: KartTrackId) => void;
  disabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Track
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {kartTrackCatalogue.map((track) => {
          const selected = track.id === value;
          return (
            <label
              key={track.id}
              className="motion-press panel relative grid cursor-pointer touch-manipulation gap-2 p-3 has-checked:border-accent has-disabled:cursor-not-allowed has-disabled:opacity-70"
            >
              <input
                type="radio"
                name="track"
                className="sr-only"
                checked={selected}
                onChange={() => onChange(track.id)}
              />
              <TrackPreview
                trackId={track.id}
                className="mx-auto aspect-square w-full max-w-36"
              />
              <span className="flex items-baseline justify-between gap-2">
                <strong className="text-lg">{track.name}</strong>
                <span className="text-xs font-bold uppercase text-highlight">
                  {difficultyWords[track.difficulty]}
                </span>
              </span>
              <span className="text-sm text-muted">{track.blurb}</span>
              <span className="text-xs text-muted">
                {[
                  `${Math.round(track.route.metres)} m lap`,
                  `${track.itemBoxes} item boxes`,
                  ...trackTraits(track.features),
                ].join(" · ")}
              </span>
              {selected ? (
                <motion.span
                  layoutId={reduced ? undefined : "track-selected"}
                  className="pointer-events-none absolute inset-0 rounded-[var(--radius-panel)] ring-2 ring-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DriverPicker({
  value,
  onChange,
}: {
  value: DriverStyle;
  onChange: (style: DriverStyle) => void;
}) {
  const unlocked = useUnlocked();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Driver
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {driverStyles.map((style) => {
          const locked = styleLock(style.id, unlocked);
          return (
            <label
              key={style.id}
              title={locked ? `Locked. ${locked}.` : style.note}
              className="motion-press skin-control relative grid cursor-pointer touch-manipulation justify-items-center gap-1 border border-line p-2 text-center text-xs font-bold has-checked:border-accent has-checked:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] has-disabled:cursor-not-allowed"
            >
              <input
                type="radio"
                name="driver"
                className="sr-only"
                checked={value === style.id}
                disabled={Boolean(locked) && value !== style.id}
                onChange={() => {
                  if (!locked) onChange(style.id);
                }}
                aria-describedby={locked ? `lock-${style.id}` : undefined}
              />
              <span className={`block size-12 ${locked ? "opacity-35 grayscale" : ""}`}>
                <DriverEmblem style={style.id} />
              </span>
              {style.name}
              {locked ? <LockBadge id={`lock-${style.id}`} how={locked} /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PaintPicker({
  value,
  onChange,
}: {
  value: KartPaint;
  onChange: (paint: KartPaint) => void;
}) {
  const paintHex = usePaintHex();
  const unlocked = useUnlocked();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Kart paint
      </legend>
      <div className="flex flex-wrap gap-2">
        {kartPaints.map((paint) => {
          const locked = paintLock(paint.id, unlocked);
          return (
            <label
              key={paint.id}
              title={locked ? `Locked. ${locked}.` : undefined}
              className="motion-press skin-control relative flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 border border-line py-1 pl-1.5 pr-3 text-sm font-bold has-checked:border-foreground has-checked:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] has-disabled:cursor-not-allowed"
            >
              <input
                type="radio"
                name="paint"
                className="sr-only"
                checked={value === paint.id}
                disabled={Boolean(locked) && value !== paint.id}
                onChange={() => {
                  if (!locked) onChange(paint.id);
                }}
                aria-describedby={locked ? `lock-${paint.id}` : undefined}
              />
              <span
                aria-hidden="true"
                className={`size-7 rounded-full border-2 border-background shadow ${locked ? "opacity-35 grayscale" : ""}`}
                style={{ background: paintHex(paint.id) }}
              />
              <span className={locked ? "text-muted" : undefined}>{paint.name}</span>
              {locked ? <LockBadge id={`lock-${paint.id}`} how={locked} /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CupPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: KartCupId;
  onChange: (cupId: KartCupId) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Cup
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {kartCups.map((cup) => (
          <label
            key={cup.id}
            className="motion-press panel grid cursor-pointer touch-manipulation gap-2 p-3 has-checked:border-accent has-checked:ring-2 has-checked:ring-accent has-disabled:cursor-not-allowed has-disabled:opacity-70"
          >
            <input
              type="radio"
              name="cup"
              className="sr-only"
              checked={value === cup.id}
              onChange={() => onChange(cup.id)}
            />
            <strong className="text-lg">{cup.name}</strong>
            <span className="flex flex-wrap gap-2" aria-hidden="true">
              {cup.tracks.map((trackId, i) => (
                <TrackPreview
                  key={`${trackId}-${i}`}
                  trackId={trackId}
                  className="size-16"
                />
              ))}
            </span>
            <span className="text-sm text-muted">
              {cup.tracks.map((trackId) => kartTrackName(trackId)).join(" → ")}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
