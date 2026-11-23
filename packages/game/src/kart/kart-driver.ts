import { z } from "zod";

/**
 * Drivers a guest can sit in their kart. Each is a low-poly body built in the
 * renderer; colours come from the screen's theme, so a style is a shape, not a
 * palette. A guest may also put their own photo on the driver's face.
 */
export const driverStyles = [
  { id: "racer", name: "Racer", note: "Full helmet and visor" },
  { id: "party", name: "Party animal", note: "Birthday hat" },
  { id: "royal", name: "Royalty", note: "A crown, obviously" },
  { id: "cap", name: "Weekend driver", note: "Backwards cap" },
  { id: "dj", name: "DJ", note: "Big headphones" },
  { id: "bandit", name: "Bandit", note: "Bandana and goggles" },
] as const;

export type DriverStyle = (typeof driverStyles)[number]["id"];

/**
 * Kart paint. Each has a name for screen readers and results, so colour is
 * never the only way to tell karts apart.
 */
export const kartPaints = [
  { id: "flame", name: "Flame", hex: "#ff5a36" },
  { id: "lagoon", name: "Lagoon", hex: "#2fd4c4" },
  { id: "lemon", name: "Lemon", hex: "#ffd23f" },
  { id: "grape", name: "Grape", hex: "#9b6cff" },
  { id: "lime", name: "Lime", hex: "#7ddc3c" },
  { id: "sky", name: "Sky", hex: "#3d9bff" },
  { id: "bubblegum", name: "Bubblegum", hex: "#ff6fb5" },
  { id: "snow", name: "Snow", hex: "#f2f0ff" },
] as const;
export type KartPaint = (typeof kartPaints)[number]["id"];
export const kartPaintSchema = z.enum(
  kartPaints.map((paint) => paint.id) as [KartPaint, ...KartPaint[]],
);
export const kartPaintHex = (paint: KartPaint | undefined): string | undefined =>
  kartPaints.find((entry) => entry.id === paint)?.hex;
/** A racer who has not chosen still gets a varied, stable paint. */
export function defaultKartPaint(order: number): KartPaint {
  const index = ((order % kartPaints.length) + kartPaints.length) % kartPaints.length;
  return kartPaints[index]!.id;
}

export const driverStyleSchema = z.enum(
  driverStyles.map((style) => style.id) as [DriverStyle, ...DriverStyle[]],
);

/** What a phone sends to choose its driver. A null face clears the photo. */
export const driverChoiceSchema = z
  .object({
    style: driverStyleSchema,
    faceMediaId: z.uuid().nullable(),
  })
  .strict();

export type DriverChoice = z.infer<typeof driverChoiceSchema>;

/** The driver every screen sees. A hidden or missing face is simply absent. */
export const lobbyDriverSchema = z
  .object({
    style: driverStyleSchema,
    paint: kartPaintSchema.optional(),
    faceMediaId: z.uuid().optional(),
  })
  .strict();

export type LobbyDriver = z.infer<typeof lobbyDriverSchema>;

/** A guest who has not chosen still gets a varied, stable driver. */
export function defaultDriverStyle(order: number): DriverStyle {
  const index =
    ((order % driverStyles.length) + driverStyles.length) % driverStyles.length;
  return driverStyles[index]!.id;
}
