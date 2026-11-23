import { driverStyleSchema, nicknameSchema, type DriverStyle } from "@kart-party/game";

/**
 * Per-browser conveniences: the last name and driver used. The random
 * room-scoped token lives in this tab's session storage, so a refresh rejoins
 * as the same racer while a second tab joins as someone new.
 * Storage can be missing or refuse writes (private windows); every access is
 * guarded and the app works without it.
 */
const nameKey = "kart-party:name";
const driverKey = "kart-party:driver";
const tokenKey = (code: string) => `kart-party:token:${code}`;

type Area = "localStorage" | "sessionStorage";
function read(key: string, area: Area = "localStorage"): string | null {
  try {
    return globalThis[area]?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(key: string, value: string | null, area: Area = "localStorage"): void {
  try {
    if (value === null) globalThis[area]?.removeItem(key);
    else globalThis[area]?.setItem(key, value);
  } catch {
    // Unavailable storage only means the next visit starts fresh.
  }
}

export function savedName(): string {
  const parsed = nicknameSchema.safeParse(read(nameKey) ?? "");
  return parsed.success ? parsed.data : "";
}
export const saveName = (name: string) => write(nameKey, name);

export function savedDriver(): DriverStyle | undefined {
  const parsed = driverStyleSchema.safeParse(read(driverKey));
  return parsed.success ? parsed.data : undefined;
}
export const saveDriver = (style: DriverStyle) => write(driverKey, style);

export const savedToken = (code: string) =>
  read(tokenKey(code), "sessionStorage") ?? undefined;
export const saveToken = (code: string, token: string | null) =>
  write(tokenKey(code), token, "sessionStorage");
