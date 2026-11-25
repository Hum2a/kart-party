import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { kartPaints } from "@kart-party/game";
import { Button, LinkButton, Segmented } from "../ui/primitives";
import { SoundSettings } from "../audio/SoundSettings";
import { useMusic } from "../audio/use-music";
import {
  usePrefersReducedMotion,
  useSystemReducedMotion,
} from "../anim/use-reduced-motion";
import { promptInstall, useInstallState } from "../pwa/install";
import { KeyBindings } from "./KeyBindings";
import { UnlockList } from "../unlocks/UnlockViews";
import { paintHex } from "./paint";
import { resetSettings, updateSettings, useSettings } from "./settings";

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="panel grid gap-4 p-5">
      <div>
        <h2 id={id} className="wordmark text-2xl">
          {title}
        </h2>
        {intro ? <p className="text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-sm font-bold">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="tabular-nums text-muted">
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-bold">{label}</span>
        {note ? <span className="block text-sm text-muted">{note}</span> : null}
      </span>
    </label>
  );
}

/** Everything a racer can change, saved on this device. */
export function SettingsPage() {
  useMusic("menu");
  const settings = useSettings();
  const reduced = usePrefersReducedMotion();
  const systemReduced = useSystemReducedMotion();
  const install = useInstallState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const { steering } = settings;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 pb-16 pt-8">
      <header className="grid gap-3">
        <LinkButton
          to="/"
          variant="secondary"
          className="min-h-10 justify-self-start px-3 text-base"
        >
          ← Home
        </LinkButton>
        <h1 className="wordmark text-4xl sm:text-5xl">Settings</h1>
        <p className="text-muted">Saved on this device. Changes apply straight away.</p>
      </header>

      <Section title="Graphics" intro="Lower detail keeps older phones smooth.">
        <Segmented
          label="Detail"
          value={settings.graphics}
          onChange={(graphics) => updateSettings({ graphics })}
          options={[
            { value: "auto", label: "Auto", note: "adjusts as you drive" },
            { value: "high", label: "High" },
            { value: "low", label: "Low" },
          ]}
        />
        <Segmented
          label="Kart shadows"
          value={settings.shadows}
          onChange={(shadows) => updateSettings({ shadows })}
          options={[
            { value: "auto", label: "Auto", note: "off at low detail" },
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
        <Segmented
          label="Camera"
          value={settings.camera}
          onChange={(camera) => updateSettings({ camera })}
          options={[
            { value: "close", label: "Close" },
            { value: "normal", label: "Normal" },
            { value: "far", label: "Far", note: "see more track" },
          ]}
        />
      </Section>

      <Section title="Sound">
        <SoundSettings />
      </Section>

      <Section
        title="Controls"
        intro="Touch, keyboard and gamepad all work at once. Steering response changes how sharply a small push turns."
      >
        <Segmented
          label="Touch steering"
          value={steering.layout}
          onChange={(layout) => updateSettings({ steering: { layout } })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "pad", label: "Thumb pad" },
            { value: "slider", label: "Slider" },
          ]}
        />
        <Toggle
          label="Swap touch sides"
          note="Steer with your right thumb and press the pedals with your left."
          checked={steering.swapSides}
          onChange={(swapSides) => updateSettings({ steering: { swapSides } })}
        />
        <Range
          label="Steering response"
          value={steering.sensitivity}
          min={0.5}
          max={1.5}
          step={0.05}
          shown={`${steering.sensitivity.toFixed(2)}× · lower is gentler`}
          onChange={(sensitivity) => updateSettings({ steering: { sensitivity } })}
        />
        <Range
          label="Gamepad deadzone"
          value={steering.deadzone}
          min={0.05}
          max={0.4}
          step={0.01}
          shown={`${Math.round(steering.deadzone * 100)}%`}
          onChange={(deadzone) => updateSettings({ steering: { deadzone } })}
        />
        <Toggle
          label="Mouse steering area"
          note="Hold the left mouse button over a strip under the race to steer."
          checked={steering.mouse}
          onChange={(mouse) => updateSettings({ steering: { mouse } })}
        />
        <div className="grid gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
            Keyboard
          </h3>
          <KeyBindings />
        </div>
        <p className="text-sm text-muted">
          Gamepad: left stick steers, A accelerates, B brakes, RB or RT drifts, X uses
          your item and Y puts you back on the track.
        </p>
      </Section>

      <Section title="Accessibility">
        <Segmented
          label="Motion"
          value={settings.motion}
          onChange={(motion) => updateSettings({ motion })}
          options={[
            {
              value: "system",
              label: "Follow my device",
              note: systemReduced ? "reduced now" : undefined,
            },
            { value: "reduce", label: "Always reduce" },
          ]}
        />
        <p className="text-sm text-muted">
          Reduced motion uses a steady top-down camera, turns off camera sway, confetti
          and screen shake, and makes menus fade instead of slide.
        </p>
        <Toggle
          label="Colour-blind-safe kart paint"
          note="Draws every paint from a palette that stays distinct with colour blindness. Paint names stay the same, on this device only."
          checked={settings.colourSafe}
          onChange={(colourSafe) => updateSettings({ colourSafe })}
        />
        <ul className="flex flex-wrap gap-2" aria-label="Kart paint preview">
          {kartPaints.map((paint) => (
            <li
              key={paint.id}
              className="flex items-center gap-1.5 text-sm"
              title={paint.name}
            >
              <motion.span
                aria-hidden="true"
                className="size-6 rounded-full border-2 border-background shadow"
                animate={{ backgroundColor: paintHex(paint.id, settings.colourSafe) }}
                transition={{ duration: reduced ? 0 : 0.25 }}
              />
              {paint.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Unlocks"
        intro="Paints and drivers earned from Grand Prix results, kept on this device."
      >
        <UnlockList />
      </Section>

      <Section
        title="Driving school"
        intro="Six short steps: accelerate, steer, drift, boost, items and getting back on the track."
      >
        <p className="text-muted">
          {settings.schoolDone ? "You have been through it." : "Not taken yet."}
        </p>
        <LinkButton to="/school" variant="secondary" className="justify-self-start">
          {settings.schoolDone ? "Take it again" : "Start the driving school"}
        </LinkButton>
      </Section>

      <Section
        title="Install"
        intro="Add Kart Party to your home screen. Once installed, practice races work offline."
      >
        {install === "installed" ? (
          <p className="font-bold">Kart Party is installed on this device.</p>
        ) : install === "ready" ? (
          <Button
            className="justify-self-start"
            onClick={async () => {
              const accepted = await promptInstall();
              setNotice(accepted ? "Installing…" : "Not installed.");
            }}
          >
            Install Kart Party
          </Button>
        ) : (
          <p className="text-muted">
            Your browser has not offered to install yet. On iPhone and iPad, tap Share,
            then Add to Home Screen. In other browsers, look for Install in the menu.
          </p>
        )}
        <p className="text-sm text-muted" aria-live="polite">
          {notice}
        </p>
      </Section>

      <section className="grid gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {confirmReset ? (
            <motion.div
              key="confirm"
              className="flex flex-wrap items-center gap-2"
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className="font-bold">Reset every setting on this device?</span>
              <Button
                variant="secondary"
                onClick={() => {
                  resetSettings();
                  setConfirmReset(false);
                  setResetNotice("Settings are back to the defaults.");
                }}
              >
                Reset
              </Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Keep my settings
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="ask"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setResetNotice("");
                  setConfirmReset(true);
                }}
              >
                Reset all settings
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-sm text-muted" aria-live="polite">
          {resetNotice}
        </p>
      </section>
    </main>
  );
}
