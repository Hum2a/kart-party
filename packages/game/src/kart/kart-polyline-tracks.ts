import { parkTrack, parkTrackId } from "./kart-park.ts";
import { harbourTrack, harbourTrackId } from "./kart-harbour.ts";
import type { PolylineTrack } from "./kart-polyline.ts";

/** Every original polyline course. The party ring is the one non-polyline track. */
export const polylineTracks: Readonly<Record<string, PolylineTrack>> = {
  [parkTrackId]: parkTrack,
  [harbourTrackId]: harbourTrack,
};
export const polylineTrack = (
  trackId: string | undefined,
): PolylineTrack | undefined => (trackId ? polylineTracks[trackId] : undefined);
