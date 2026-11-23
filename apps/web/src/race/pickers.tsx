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
} from "@kart-party/game";
import { DriverEmblem } from "../kart/DriverBadge";
import { TrackPreview } from "./TrackPreview";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

const difficultyWords = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

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
                {Math.round(track.route.metres)} m lap · {track.itemBoxes} item boxes
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
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Driver
      </legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {driverStyles.map((style) => (
          <label
            key={style.id}
            title={style.note}
            className="motion-press skin-control grid cursor-pointer touch-manipulation justify-items-center gap-1 border border-line p-2 text-center text-xs font-bold has-checked:border-accent has-checked:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
          >
            <input
              type="radio"
              name="driver"
              className="sr-only"
              checked={value === style.id}
              onChange={() => onChange(style.id)}
            />
            <span className="block size-12">
              <DriverEmblem style={style.id} />
            </span>
            {style.name}
          </label>
        ))}
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
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        Kart paint
      </legend>
      <div className="flex flex-wrap gap-2">
        {kartPaints.map((paint) => (
          <label
            key={paint.id}
            className="motion-press skin-control flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 border border-line py-1 pl-1.5 pr-3 text-sm font-bold has-checked:border-foreground has-checked:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
          >
            <input
              type="radio"
              name="paint"
              className="sr-only"
              checked={value === paint.id}
              onChange={() => onChange(paint.id)}
            />
            <span
              aria-hidden="true"
              className="size-7 rounded-full border-2 border-background shadow"
              style={{ background: paint.hex }}
            />
            {paint.name}
          </label>
        ))}
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
            <span className="flex gap-2" aria-hidden="true">
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
