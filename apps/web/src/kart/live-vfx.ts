import { defaultKartVfxPreset } from "@kart-party/game";
const disabled = { ...defaultKartVfxPreset, enabled: false };
/** Absent flags keep older races on their legacy presentation. Explicit off clears decoration. */
export const liveKartVfxPreset = (enabled: boolean | undefined) =>
  enabled === undefined ? undefined : enabled ? defaultKartVfxPreset : disabled;
