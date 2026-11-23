import { createContext, useContext } from "react";
import type { LobbyDriver } from "@kart-party/game";

export type KartDrivers = {
  gameId: string;
  byPlayer: ReadonlyMap<string, LobbyDriver>;
};

export const KartDriversContext = createContext<KartDrivers>({
  gameId: "",
  byPlayer: new Map(),
});

export function useKartDrivers(): KartDrivers {
  return useContext(KartDriversContext);
}
