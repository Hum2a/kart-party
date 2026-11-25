import { polylineTrack, type KartTrackId } from "@kart-party/game";
import { mapX, mapZ } from "./navigation";

/**
 * A course's shortcuts and alternate routes for an SVG map. A shortcut is a
 * dashed gravel track; an alternate route is drawn as road. Each has a title,
 * so it is named, not just coloured.
 */
export function BranchPaths({
  trackId,
  strokeWidth = 0.5,
}: {
  trackId: KartTrackId;
  strokeWidth?: number;
}) {
  const course = polylineTrack(trackId);
  if (!course?.branches.length) return null;
  const px = (x: number) => mapX(trackId, x).toFixed(2);
  const pz = (z: number) => mapZ(trackId, z).toFixed(2);
  return (
    <g data-track-branches={trackId}>
      {course.branches.map((branch) => {
        const outline = [
          ...branch.ribbon.map((edge) => edge.left),
          ...branch.ribbon.map((edge) => edge.right).reverse(),
        ];
        const shortcut = branch.kind === "shortcut";
        return (
          <path
            key={branch.id}
            data-branch={branch.kind}
            d={`M${outline.map(([x, z]) => `${px(x)} ${pz(z)}`).join("L")}Z`}
            fill={shortcut ? "var(--muted)" : "var(--surface)"}
            fillOpacity={shortcut ? 0.45 : 1}
            stroke={shortcut ? "var(--highlight)" : "var(--accent)"}
            strokeDasharray={
              shortcut ? `${strokeWidth * 3} ${strokeWidth * 2}` : undefined
            }
            strokeWidth={strokeWidth}
          >
            <title>{`${branch.name} (${shortcut ? "shortcut: needs a boost" : "alternate route"})`}</title>
          </path>
        );
      })}
    </g>
  );
}
