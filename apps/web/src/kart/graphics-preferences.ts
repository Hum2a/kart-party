import { createContext, useContext, useState } from "react";
import {
  graphicsTier,
  type FrameHealth,
  type GraphicsMode,
  type GraphicsTier,
} from "./graphics";

export const GraphicsTierContext = createContext<GraphicsTier>("high");
export const useGraphicsTier = () => useContext(GraphicsTierContext);

export function useKartGraphics(players: number) {
  const [mode, setMode] = useState<GraphicsMode>(() => {
    try {
      const value = sessionStorage.getItem("kart-party-graphics");
      return value === "high" || value === "low" ? value : "auto";
    } catch {
      return "auto";
    }
  });
  const [health, setHealth] = useState<FrameHealth>("checking");
  return {
    mode,
    health,
    tier: graphicsTier(mode, players, health),
    onHealth(next: FrameHealth) {
      setHealth((previous) => (previous === "strained" ? previous : next));
    },
    onMode(next: GraphicsMode) {
      setMode(next);
      setHealth("checking");
      try {
        sessionStorage.setItem("kart-party-graphics", next);
      } catch {
        /* Controls still work without storage. */
      }
    },
  };
}
