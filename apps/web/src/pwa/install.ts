import { useSyncExternalStore } from "react";

/** Chrome's install prompt event; not in the DOM typings. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = "unavailable" | "ready" | "installed";

let deferred: InstallPromptEvent | null = null;
let state: InstallState = "unavailable";
const listeners = new Set<() => void>();
const set = (next: InstallState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * Keeps the browser's install prompt for the Settings page's Install button,
 * and registers the offline worker in production builds. Call once at start.
 */
export function installPwa({ register = import.meta.env.PROD } = {}) {
  if (typeof window === "undefined") return;
  if (standalone()) state = "installed";
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    set("ready");
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    set("installed");
  });
  if (register && "serviceWorker" in navigator)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* The game still works online without the offline worker. */
      });
    });
}

/** Shows the browser's own install dialog. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  set(outcome === "accepted" ? "installed" : "unavailable");
  return outcome === "accepted";
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

/** Whether the browser says it is online. Practice works either way. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
