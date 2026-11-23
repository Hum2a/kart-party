import { kartLookPresets, type KartLookName } from "@kart-party/game";

/** Optional cosmetics only. Old races and explicit off retain their source render. */
export function liveKartLookPreset(name: KartLookName | undefined) {
  return name && name !== "off" ? kartLookPresets[name] : undefined;
}
