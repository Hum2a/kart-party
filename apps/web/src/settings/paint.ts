import { kartPaintHex, type KartPaint } from "@kart-party/game";
import { useSetting } from "./settings";

/**
 * The Okabe–Ito set, which stays distinct with the common kinds of colour
 * blindness, plus white. Each paint keeps its name, so results and screen
 * readers read the same; only the colour drawn on this device changes.
 */
export const colourSafePaint: Record<KartPaint, string> = {
  flame: "#d55e00",
  lagoon: "#56b4e9",
  lemon: "#f0e442",
  grape: "#e69f00",
  lime: "#009e73",
  sky: "#0072b2",
  bubblegum: "#cc79a7",
  snow: "#f2f0ff",
  // The earned paints differ from the set above by lightness as well as hue
  // (from the colour-blind-safe brown–teal ColorBrewer scale).
  copper: "#8c510a",
  racing: "#01665e",
  gold: "#dfc27d",
};

export function paintHex(
  paint: KartPaint | undefined,
  colourSafe: boolean,
): string | undefined {
  if (!paint) return undefined;
  return colourSafe ? colourSafePaint[paint] : kartPaintHex(paint);
}

/** Paint colours as this racer has chosen to see them. */
export function usePaintHex() {
  const colourSafe = useSetting((value) => value.colourSafe);
  return (paint: KartPaint | undefined) => paintHex(paint, colourSafe);
}
