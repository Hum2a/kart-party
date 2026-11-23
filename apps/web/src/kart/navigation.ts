import { polylineTrack, type KartRaceView } from "@kart-party/game";

type MapFrame = { cx: number; cz: number; scale: number };
const frames = new Map<string, MapFrame>();
/** Fits a polyline course's road ribbon into the same ±45 map box as the ring. */
function frame(trackId: KartRaceView["trackId"]): MapFrame | undefined {
  const course = polylineTrack(trackId);
  if (!course) return undefined;
  const cached = frames.get(course.id);
  if (cached) return cached;
  const xs = course.ribbon.flatMap((edge) => [edge.left[0], edge.right[0]]),
    zs = course.ribbon.flatMap((edge) => [edge.left[1], edge.right[1]]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const value = {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    scale: 90 / Math.max(maxX - minX, maxZ - minZ),
  };
  frames.set(course.id, value);
  return value;
}
export const mapX = (trackId: KartRaceView["trackId"], x: number) => {
  const f = frame(trackId);
  return f ? (x - f.cx) * f.scale : x;
};
export const mapZ = (trackId: KartRaceView["trackId"], z: number) => {
  const f = frame(trackId);
  return f ? (z - f.cz) * f.scale : z;
};

export function mapHeadingPath(heading: number) {
  const x = Math.cos(heading),
    z = Math.sin(heading);
  return `M${8 * x} ${8 * z}L${4 * x + 2.5 * z} ${4 * z - 2.5 * x}L${4 * x - 2.5 * z} ${4 * z + 2.5 * x}Z`;
}

/** A public map marker, never a local lap counter or a driving target. */
export function mapSectorPoint(trackId: KartRaceView["trackId"], sector: number) {
  if (!Number.isInteger(sector) || sector < 1 || sector > 8)
    throw new RangeError("Sector must be between one and eight");
  const route = polylineTrack(trackId)?.route;
  if (route) return route.point((sector * route.lapLength) / 8);
  const angle = ((sector % 8) * Math.PI) / 4;
  return {
    x: Math.cos(angle) * 42,
    z: Math.sin(angle) * 42,
    heading: angle + Math.PI / 2,
  };
}

export function nextMapSector(race: KartRaceView) {
  const self = race.participants.find(
    (driver) => driver.playerId === race.selfPlayerId,
  );
  if (race.ended || !self || self.status !== "RACING" || self.checkpoint >= 8)
    return undefined;
  const sector = self.checkpoint + 1;
  return { sector, ...mapSectorPoint(race.trackId, sector) };
}
