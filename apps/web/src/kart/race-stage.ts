/**
 * Where a race is in its life, and the clock its GO time is measured on.
 * Online rooms use the server clock (local clock plus the measured offset);
 * offline practice uses the local clock directly.
 */
export type RaceStage = {
  phase: "grid" | "racing" | "done";
  /** Clock time of GO, on the same clock as `now()`. */
  goAt?: number;
  now: () => number;
  /** Practice can pause; online races cannot. */
  paused?: boolean;
};
