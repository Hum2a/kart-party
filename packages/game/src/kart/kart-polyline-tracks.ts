import { parkTrack, parkTrackId } from "./kart-park.ts";
import { harbourTrack, harbourTrackId } from "./kart-harbour.ts";
import { cityTrack, cityTrackId } from "./kart-city.ts";
import { summitTrack, summitTrackId } from "./kart-summit.ts";
import { beachTrack, beachTrackId } from "./kart-beach.ts";
import type { PolylineTrack } from "./kart-polyline.ts";

/** Every original polyline course. The party ring is the one non-polyline track. */
export const polylineTracks: Readonly<Record<string, PolylineTrack>> = {
  [parkTrackId]: parkTrack,
  [harbourTrackId]: harbourTrack,
  [cityTrackId]: cityTrack,
  [summitTrackId]: summitTrack,
  [beachTrackId]: beachTrack,
};
export const polylineTrack = (
  trackId: string | undefined,
): PolylineTrack | undefined => (trackId ? polylineTracks[trackId] : undefined);
