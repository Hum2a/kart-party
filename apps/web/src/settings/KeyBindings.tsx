import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  bindKey,
  bindableKey,
  defaultKeyBindings,
  getSettings,
  kartActionLabel,
  kartActions,
  keyLabel,
  updateSettings,
  useSetting,
  type KartAction,
} from "./settings";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

/**
 * Remap the keyboard. Pick an action, then press the key you want. Escape
 * cancels. A key already in use moves to the new action.
 */
export function KeyBindings() {
  const keys = useSetting((value) => value.keys);
  const reduced = usePrefersReducedMotion();
  const [listening, setListening] = useState<KartAction | null>(null);
  const [notice, setNotice] = useState("");
  const capture = useRef<HTMLParagraphElement>(null);
  const buttons = useRef(new Map<KartAction, HTMLButtonElement>());

  useEffect(() => {
    if (!listening) return;
    capture.current?.focus();
    const finish = () => {
      const action = listening;
      setListening(null);
      // Back to the button that started it, after it renders again.
      requestAnimationFrame(() => buttons.current.get(action)?.focus());
    };
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.type !== "keydown" || event.repeat) return;
      if (event.key === "Escape") {
        setNotice("No change.");
        finish();
        return;
      }
      if (!bindableKey(event.key)) {
        setNotice(`${keyLabel(event.key)} cannot be used. Try another key.`);
        return;
      }
      const before = getSettings().keys;
      const after = bindKey(before, listening, event.key);
      updateSettings({ keys: after });
      // Say so when another action gave up its key or took one in a swap.
      const moved = kartActions.filter(
        (name) => name !== listening && before[name].join() !== after[name].join(),
      );
      setNotice(
        [
          `${kartActionLabel[listening]} is now ${after[listening].map(keyLabel).join(" or ")}.`,
          ...moved.map(
            (name) =>
              `${kartActionLabel[name]} is now ${after[name].map(keyLabel).join(" or ")}.`,
          ),
        ].join(" "),
      );
      finish();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [listening]);

  return (
    <div className="grid gap-3">
      <ul className="settings-keys grid gap-1.5">
        {kartActions.map((action) => (
          <li key={action} className="settings-key-row">
            <span className="font-bold">{kartActionLabel[action]}</span>
            <span
              className="settings-key-caps"
              aria-label={`${kartActionLabel[action]} keys`}
            >
              {keys[action].map((key) => (
                <kbd key={key}>{keyLabel(key)}</kbd>
              ))}
            </span>
            <button
              type="button"
              ref={(node) => {
                if (node) buttons.current.set(action, node);
                else buttons.current.delete(action);
              }}
              className="settings-small-button motion-press"
              aria-label={`Change the key for ${kartActionLabel[action]}`}
              disabled={listening !== null && listening !== action}
              onClick={() => {
                setNotice("");
                setListening(action);
              }}
            >
              Change
            </button>
          </li>
        ))}
      </ul>
      <AnimatePresence>
        {listening ? (
          <motion.p
            key="listening"
            ref={capture}
            tabIndex={-1}
            role="status"
            className="settings-listening"
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Press a key for {kartActionLabel[listening]}. Escape cancels.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <p className="min-h-6 text-sm text-muted" aria-live="polite">
        {notice}
      </p>
      <button
        type="button"
        className="settings-small-button motion-press justify-self-start"
        disabled={listening !== null}
        onClick={() => {
          updateSettings({ keys: defaultKeyBindings });
          setNotice("Keys are back to the defaults.");
        }}
      >
        Reset keys
      </button>
    </div>
  );
}
