import { Suspense, lazy, type ReactNode } from "react";
import type { LobbyDriver } from "@kart-party/game";
import type { PodiumPlace } from "../kart/podium";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

const PodiumScene = lazy(() => import("../kart/PodiumScene"));

/**
 * The 3D podium above a results table. Loaded with the results, never before;
 * the table under it carries the same places as text. `fallback` shows if this
 * device cannot draw 3D.
 */
export function PodiumStage({
  places,
  drivers,
  fallback = null,
}: {
  places: readonly PodiumPlace[];
  drivers: ReadonlyMap<string, LobbyDriver>;
  fallback?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  if (!places.length) return <>{fallback}</>;
  return (
    <Suspense fallback={<div className="kart-podium-placeholder" aria-hidden="true" />}>
      <PodiumScene
        places={places}
        drivers={drivers}
        reducedMotion={reduced}
        fallback={fallback}
      />
    </Suspense>
  );
}
