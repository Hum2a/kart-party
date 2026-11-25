import { createContext, useContext, useState } from "react";
import {
  graphicsTier,
  type FrameHealth,
  type GraphicsMode,
  type GraphicsTier,
} from "./graphics";
import { updateSettings, useSetting } from "../settings/settings";

export const GraphicsTierContext = createContext<GraphicsTier>("high");
export const useGraphicsTier = () => useContext(GraphicsTierContext);

/** The graphics choice is saved in settings; frame health belongs to each view. */
export function useKartGraphics(players: number) {
  const mode = useSetting((value) => value.graphics);
  const [health, setHealth] = useState<FrameHealth>("checking");
  return {
    mode,
    health,
    tier: graphicsTier(mode, players, health),
    onHealth(next: FrameHealth) {
      setHealth((previous) => (previous === "strained" ? previous : next));
    },
    onMode(next: GraphicsMode) {
      updateSettings({ graphics: next });
      setHealth("checking");
    },
  };
}
