/** Longest one-lap window on a polyline course. */
export const polylineTrackLimitMs = 180_000;

/** Static closed route geometry shared by course definitions; progress is awarded by kart-laps. */
export function createKartRoute(points: readonly (readonly [number, number])[]) {
  if (
    points.length < 4 ||
    points.some((p) => p.some((n) => !Number.isFinite(n))) ||
    points[0]![0] !== points.at(-1)![0] ||
    points[0]![1] !== points.at(-1)![1]
  )
    throw new RangeError("A route needs a finite closed polyline");
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1]));
  if (lengths.some((length) => length <= 0))
    throw new RangeError("Route segments must have length");
  const offsets = lengths.reduce<number[]>(
    (all, value) => [...all, all.at(-1)! + value],
    [0],
  );
  const lapLength = offsets.at(-1)!;
  /** Public centreline geometry for navigation only; does not award progress. */
  function point(along: number) {
    if (!Number.isFinite(along)) throw new RangeError("Route distance must be finite");
    const wrapped = ((along % lapLength) + lapLength) % lapLength;
    const index = lengths.findIndex((length, i) => wrapped < offsets[i]! + length);
    const a = points[index]!,
      b = points[index + 1]!;
    const t = (wrapped - offsets[index]!) / lengths[index]!;
    return {
      x: a[0] + (b[0] - a[0]) * t,
      z: a[1] + (b[1] - a[1]) * t,
      heading: Math.atan2(b[1] - a[1], b[0] - a[0]),
    };
  }
  function progress(x: number, z: number) {
    let best = { distance: Infinity, along: 0, heading: -Math.PI / 2, x: 0, z: 0 };
    for (let i = 0; i < lengths.length; i++) {
      const a = points[i]!,
        b = points[i + 1]!,
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengths[i]! ** 2),
      );
      const px = a[0] + dx * t,
        pz = a[1] + dz * t,
        distance = Math.hypot(x - px, z - pz);
      if (distance < best.distance)
        best = {
          distance,
          along: offsets[i]! + lengths[i]! * t,
          heading: Math.atan2(dz, dx),
          x: px,
          z: pz,
        };
    }
    return best;
  }
  return { points, lapLength, point, progress };
}
export type KartRoute = ReturnType<typeof createKartRoute>;
