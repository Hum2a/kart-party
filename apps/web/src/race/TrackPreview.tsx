import { polylineTrack, type KartTrackId } from "@kart-party/game";
import { mapX, mapZ } from "../kart/navigation";

/** A small, static drawing of a course for menus. Purely decorative text-wise. */
export function TrackPreview({
  trackId,
  className = "",
}: {
  trackId: KartTrackId;
  className?: string;
}) {
  const course = polylineTrack(trackId);
  const px = (x: number) => mapX(trackId, x);
  const pz = (z: number) => mapZ(trackId, z);
  return (
    <svg viewBox="-58 -58 116 116" className={className} aria-hidden="true">
      {course ? (
        <>
          <path
            d={(["left", "right"] as const)
              .map(
                (side) =>
                  `M${course.ribbon.map((edge) => `${px(edge[side][0]).toFixed(2)} ${pz(edge[side][1]).toFixed(2)}`).join("L")}Z`,
              )
              .join(" ")}
            fill="var(--surface)"
            fillRule="evenodd"
            stroke="var(--accent)"
            strokeWidth="1.2"
          />
          <path
            d={`M${course.route.points.map(([x, z]) => `${px(x).toFixed(2)} ${pz(z).toFixed(2)}`).join("L")}`}
            fill="none"
            stroke="var(--line)"
            strokeDasharray="2 3"
            strokeWidth="0.6"
          />
          <circle cx={px(0)} cy={pz(0)} r="2.6" fill="var(--highlight)" />
        </>
      ) : (
        <>
          <circle r="47" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
          <circle r="42" fill="none" stroke="var(--surface)" strokeWidth="9" />
          <circle r="37" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
          <circle cx="42" cy="0" r="2.6" fill="var(--highlight)" />
        </>
      )}
    </svg>
  );
}
