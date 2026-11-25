import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSetting } from "../settings/settings";

/** The device's own reduce-motion setting, live. */
export function useSystemReducedMotion() {
  const media = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );
  const subscribe = useCallback(
    (notify: () => void) => {
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [media],
  );
  return useSyncExternalStore(
    subscribe,
    () => media.matches,
    () => true,
  );
}

/**
 * Reduce motion when the device asks for it, or when the racer turned it on in
 * Kart Party's settings. Shared by the chrome and the canvas adapters.
 */
export function usePrefersReducedMotion() {
  const system = useSystemReducedMotion();
  const chosen = useSetting((value) => value.motion === "reduce");
  return system || chosen;
}
