import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { RoomPlayer, RoomView } from "@kart-party/game";
import { Button } from "../ui/primitives";
import { DriverBadge } from "../kart/DriverBadge";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import type { useRoom } from "./use-room";

const InviteQr = lazy(() => import("./InviteQr"));

type Request = ReturnType<typeof useRoom>["api"]["request"];

/** The room link to share: a QR code for phones in the same room, and copy or share for everyone else. */
export function InvitePanel({ code }: { code: string }) {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/r/${code}`;
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="grid justify-items-end gap-3">
      <Button
        variant="secondary"
        aria-expanded={open}
        aria-controls="invite-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide invite" : "Invite friends"}
      </Button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="invite-panel"
            className="panel grid justify-items-center gap-3 p-4"
            initial={{ opacity: 0, y: reduced ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.2, ease: "easeOut" }}
          >
            <Suspense
              fallback={
                <div className="invite-qr grid place-items-center text-sm text-black">
                  Drawing the code…
                </div>
              }
            >
              <InviteQr link={link} code={code} />
            </Suspense>
            <p className="text-center text-sm text-muted">
              Scan with a phone camera, or share the link.
            </p>
            <p className="font-mono text-sm break-all">{link}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                className="min-h-11 text-base"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    // The clipboard refused; the link is on screen to copy by hand.
                  }
                }}
              >
                {copied ? "Link copied" : "Copy link"}
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator ? (
                <Button
                  variant="secondary"
                  className="min-h-11 text-base"
                  onClick={async () => {
                    try {
                      await navigator.share({ title: "Kart Party", url: link });
                    } catch {
                      // The share sheet was dismissed.
                    }
                  }}
                >
                  Share…
                </Button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One racer in the lobby list, with the host's actions for everyone else. */
export function PlayerRow({
  player,
  view,
  request,
  onNotice,
}: {
  player: RoomPlayer;
  view: RoomView;
  request: Request;
  onNotice: (message: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const host = view.hostId === view.selfId;
  const self = player.playerId === view.selfId;
  const isHost = player.playerId === view.hostId;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (body: Parameters<Request>[0], fallback: string) => {
    setBusy(true);
    const ack = await request(body);
    setBusy(false);
    setConfirming(false);
    onNotice(ack.ok ? "" : (ack.message ?? fallback));
  };
  return (
    <motion.li
      layout={reduced ? false : "position"}
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: player.connected ? 1 : 0.55, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.1 : 0.2 }}
      className="skin-control grid gap-2 border border-line px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <DriverBadge driver={player.driver} nickname={player.name} size={40} />
        <span className="min-w-0 flex-1 truncate font-bold">
          {player.name}
          {self ? <span className="ml-2 text-xs text-highlight">YOU</span> : null}
        </span>
        {isHost ? (
          <span className="text-xs font-bold uppercase text-accent">Host</span>
        ) : !player.connected ? (
          <span className="text-xs text-muted">away</span>
        ) : (
          <span className="lobby-badge" data-tone={player.ready ? "ready" : "waiting"}>
            {player.ready ? "Ready" : "Not ready"}
          </span>
        )}
        {player.wins > 0 ? (
          <span className="text-sm text-muted">
            {player.wins} {player.wins === 1 ? "win" : "wins"}
          </span>
        ) : null}
      </div>
      {host && !self ? (
        <div className="flex flex-wrap justify-end gap-2">
          {confirming ? (
            <>
              <span className="self-center text-sm">Remove {player.name}?</span>
              <button
                type="button"
                className="lobby-row-action"
                data-danger="true"
                disabled={busy}
                onClick={() =>
                  act(
                    { type: "kick", playerId: player.playerId },
                    "Could not remove that racer.",
                  )
                }
              >
                Remove
              </button>
              <button
                type="button"
                className="lobby-row-action"
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </>
          ) : (
            <>
              {player.connected ? (
                <button
                  type="button"
                  className="lobby-row-action"
                  disabled={busy}
                  onClick={() =>
                    act(
                      { type: "host", playerId: player.playerId },
                      "Could not hand over the host.",
                    )
                  }
                >
                  Make host
                </button>
              ) : null}
              <button
                type="button"
                className="lobby-row-action"
                data-danger="true"
                onClick={() => setConfirming(true)}
              >
                Remove…
              </button>
            </>
          )}
        </div>
      ) : null}
    </motion.li>
  );
}

/** The host locks the room or lists it for quick play; everyone else sees the state. */
export function AccessControls({
  view,
  request,
  onNotice,
}: {
  view: RoomView;
  request: Request;
  onNotice: (message: string) => void;
}) {
  const host = view.hostId === view.selfId;
  const change = async (locked: boolean, listed: boolean) => {
    const ack = await request({ type: "access", locked, listed });
    onNotice(ack.ok ? "" : (ack.message ?? "Could not change who can join."));
  };
  if (!host)
    return view.locked ? (
      <p className="text-sm text-muted">The host has locked this room to new racers.</p>
    ) : null;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
        Who can join
      </legend>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-[var(--accent)]"
          checked={view.locked}
          onChange={(event) => change(event.target.checked, view.listed)}
        />
        Lock the room
        <span className="text-sm font-normal text-muted">
          Only racers already here can come back
        </span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-[var(--accent)]"
          checked={view.listed}
          onChange={(event) => change(view.locked, event.target.checked)}
        />
        List on quick play
        <span className="text-sm font-normal text-muted">
          Strangers can find and join this room
        </span>
      </label>
    </fieldset>
  );
}
