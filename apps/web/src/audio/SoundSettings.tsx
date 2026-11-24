import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { mixer, type AudioPrefs, type Mixer } from "./mixer";
import { playSfx } from "./sfx";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

/** Live audio preferences from the shared mixer. */
export function useAudioPrefs(target: Mixer = mixer()) {
  const snapshot = useRef({ prefs: target.prefs, ready: target.ready });
  const state = useSyncExternalStore(
    (notify) =>
      target.subscribe((prefs, ready) => {
        snapshot.current = { prefs, ready };
        notify();
      }),
    () => snapshot.current,
    () => snapshot.current,
  );
  return { ...state, set: (next: Partial<AudioPrefs>) => target.set(next) };
}

function Slider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value * 100)}%</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="w-full accent-[var(--accent)] disabled:opacity-50"
      />
    </div>
  );
}

/** Mute plus music and effects volume. Used in the sound menu and the race controls. */
export function SoundSettings({ target = mixer() }: { target?: Mixer }) {
  const { prefs, set } = useAudioPrefs(target);
  return (
    <div className="grid gap-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-[var(--accent)]"
          checked={!prefs.muted}
          onChange={(event) => {
            target.unlock();
            set({ muted: !event.target.checked });
          }}
        />
        Sound on
      </label>
      <Slider
        label="Music"
        value={prefs.music}
        disabled={prefs.muted}
        onChange={(music) => set({ music })}
      />
      <Slider
        label="Effects"
        value={prefs.sfx}
        disabled={prefs.muted}
        onChange={(sfx) => {
          set({ sfx });
          playSfx("ui-tap", target);
        }}
      />
    </div>
  );
}

/** A small button that opens the sound settings, for menu screens. */
export function SoundButton({ target = mixer() }: { target?: Mixer }) {
  const reduced = usePrefersReducedMotion();
  const { prefs } = useAudioPrefs(target);
  const [open, setOpen] = useState(false);
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !root.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        aria-label={
          prefs.muted
            ? "Sound off. Open sound settings"
            : "Sound on. Open sound settings"
        }
        onClick={() => {
          target.unlock();
          setOpen((value) => !value);
        }}
        className="motion-press skin-control grid size-11 place-items-center border border-line bg-background text-xl"
      >
        <span aria-hidden="true">{prefs.muted ? "🔇" : "🔊"}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panel}
            role="dialog"
            aria-label="Sound settings"
            className="panel absolute right-0 top-13 z-50 w-64 bg-surface p-4"
            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.16 }}
          >
            <SoundSettings target={target} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
