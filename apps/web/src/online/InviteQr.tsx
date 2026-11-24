import { useMemo } from "react";
import { encode } from "uqr";

/**
 * The room link as a QR code, drawn as one SVG path from the encoded grid.
 * Loaded only when someone opens the invite, so the library stays out of the
 * first download.
 */
export default function InviteQr({ link, code }: { link: string; code: string }) {
  const path = useMemo(() => {
    const { data } = encode(link, { ecc: "M", border: 2 });
    let d = "";
    data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { d, size: data.length };
  }, [link]);
  return (
    <div className="invite-qr">
      <svg
        viewBox={`0 0 ${path.size} ${path.size}`}
        role="img"
        aria-label={`QR code for room ${code}`}
        shapeRendering="crispEdges"
      >
        <path d={path.d} fill="#111" />
      </svg>
    </div>
  );
}
