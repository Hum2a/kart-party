import type { ReactElement } from "react";
import type { DriverStyle, LobbyDriver } from "@kart-party/game";
import "./driver.css";

/** A round driver avatar: an emblem for the racer's driver style. */
export function DriverBadge({
  driver,
  nickname,
  size = 40,
}: {
  driver: LobbyDriver | undefined;
  nickname: string;
  /** Pixels, or any CSS length such as "1.4em" to follow the text size. */
  size?: number | string;
}) {
  return (
    <span
      className="driver-badge"
      style={{ width: size, height: size }}
      data-driver-style={driver?.style ?? "racer"}
    >
      <DriverEmblem style={driver?.style ?? "racer"} label={`${nickname}’s driver`} />
    </span>
  );
}

/** Simple head-and-headgear drawings, one per style, in the screen's theme colours. */
export function DriverEmblem({ style, label }: { style: DriverStyle; label?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="driver-emblem"
    >
      <circle cx="20" cy="22" r="11" className="driver-emblem-face" />
      <circle cx="16" cy="22" r="1.4" className="driver-emblem-ink" />
      <circle cx="24" cy="22" r="1.4" className="driver-emblem-ink" />
      <path d="M16 27q4 3 8 0" className="driver-emblem-line" />
      {headgear[style]}
    </svg>
  );
}

const headgear: Record<DriverStyle, ReactElement> = {
  racer: (
    <>
      <path d="M7 22a13 13 0 0 1 26 0v2H7z" className="driver-emblem-accent" />
      <rect
        x="11"
        y="18"
        width="18"
        height="6"
        rx="3"
        className="driver-emblem-visor"
      />
    </>
  ),
  party: (
    <>
      <path d="M13 13 20 1l7 12z" className="driver-emblem-accent" />
      <circle cx="20" cy="2" r="2.4" className="driver-emblem-highlight" />
      <path d="M15.5 9h9" className="driver-emblem-line" />
    </>
  ),
  royal: (
    <path d="M10 14 12 5l4 5 4-7 4 7 4-5 2 9z" className="driver-emblem-highlight" />
  ),
  cap: (
    <>
      <path d="M9 17a11 9 0 0 1 22 0z" className="driver-emblem-accent" />
      <path d="M28 16h8v2h-8z" className="driver-emblem-accent" />
    </>
  ),
  dj: (
    <>
      <path d="M8 22a12 12 0 0 1 24 0" className="driver-emblem-band" />
      <rect
        x="4.5"
        y="19"
        width="6"
        height="9"
        rx="2.5"
        className="driver-emblem-accent"
      />
      <rect
        x="29.5"
        y="19"
        width="6"
        height="9"
        rx="2.5"
        className="driver-emblem-accent"
      />
    </>
  ),
  bandit: (
    <>
      <path d="M9 15a11 8 0 0 1 22 0z" className="driver-emblem-accent" />
      <path d="M31 13l5-3-1 6z" className="driver-emblem-accent" />
      <rect
        x="10"
        y="18"
        width="20"
        height="6"
        rx="3"
        className="driver-emblem-visor"
      />
    </>
  ),
};
