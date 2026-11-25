import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  kartCup,
  kartTrackName,
  nicknameSchema,
  roomCodeSchema,
  type KartEmote,
  type LobbyDriver,
  type RoomSettings,
  type RoomView,
} from "@kart-party/game";
import { Button, LinkButton, Segmented, TextField } from "../ui/primitives";
import { GrandPrixTable, Podium } from "../race/GrandPrixTable";
import { RaceOptions } from "../race/RaceOptions";
import { CupPicker, DriverPicker, PaintPicker, TrackPicker } from "../race/pickers";
import { ResultsTable } from "../race/ResultsTable";
import { RaceView, type RaceActions } from "../race/RaceView";
import { PodiumStage } from "../race/PodiumStage";
import { podiumFromTable, podiumPlaces } from "../kart/podium";
import type { RaceStage } from "../kart/race-stage";
import { AccessControls, InvitePanel, PlayerRow } from "./lobby-parts";
import { EmoteBar, EmoteFeed } from "./emotes";
import { serverOffset } from "../live/server-clock";
import {
  saveDriver,
  saveName,
  savePaint,
  savedIdentity,
  savedName,
  type Identity,
} from "../live/identity";
import { useRoom } from "./use-room";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";
import { useMusic } from "../audio/use-music";
import { playSfx } from "../audio/sfx";
import { SoundButton } from "../audio/SoundSettings";

export function RoomPage() {
  const params = useParams();
  const code = roomCodeSchema.safeParse(params.code ?? "");
  const [identity, setIdentity] = useState<Identity | null>(() => {
    const name = savedName();
    return name ? savedIdentity(name) : null;
  });
  if (!code.success)
    return (
      <Notice title="That room link is not right">
        Room codes are four letters. Ask the host to share the link again.
      </Notice>
    );
  if (!identity) return <NameGate code={code.data} onReady={setIdentity} />;
  return <Room code={code.data} identity={identity} />;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 pt-16">
      <h1 className="wordmark text-4xl">{title}</h1>
      <p className="text-muted">{children}</p>
      <LinkButton to="/play" className="justify-self-start">
        Back
      </LinkButton>
    </main>
  );
}

function NameGate({
  code,
  onReady,
}: {
  code: string;
  onReady: (identity: Identity) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 pt-12">
      <h1 className="wordmark text-4xl">
        Join room <span className="font-mono not-italic text-accent">{code}</span>
      </h1>
      <form
        className="panel grid gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = nicknameSchema.safeParse(name);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Choose a name.");
            return;
          }
          saveName(parsed.data);
          onReady(savedIdentity(parsed.data));
        }}
      >
        <TextField
          label="Your name"
          value={name}
          maxLength={16}
          autoFocus
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          error={error}
        />
        <Button type="submit">Join</Button>
      </form>
    </main>
  );
}

const stagePhase = { countdown: "grid", racing: "racing", results: "done" } as const;
const serverNow = () => Date.now() + (serverOffset() ?? 0);

function Room({ code, identity }: { code: string; identity: Identity }) {
  const room = useRoom(code, identity);
  const view = room.room;
  const reduced = usePrefersReducedMotion();
  const drivers = useMemo(
    () =>
      new Map<string, LobbyDriver>(
        (view?.players ?? []).map((player) => [player.playerId, player.driver]),
      ),
    [view?.players],
  );
  const names = useMemo(
    () =>
      new Map<string, string>(
        (view?.players ?? []).map((player) => [player.playerId, player.name]),
      ),
    [view?.players],
  );
  const actions = useMemo<RaceActions>(
    () => ({
      input: (input) => room.api.sendInput(input),
      finish: (report) => room.api.request({ type: "finish", report }),
      item: (raceId) => room.api.request({ type: "item", raceId }),
      recover: (raceId) => room.api.request({ type: "recover", raceId }),
    }),
    [room.api],
  );
  const phase = view?.phase;
  const stage = useMemo<RaceStage | undefined>(
    () =>
      phase && phase !== "lobby"
        ? { phase: stagePhase[phase], goAt: view?.goAt, now: serverNow }
        : undefined,
    [phase, view?.goAt],
  );

  if (room.status === "full")
    return (
      <Notice title="This room is full">{room.message ?? "Try another room."}</Notice>
    );
  if (room.status === "closed")
    return (
      <Notice title="This room has closed">Create a new room to race again.</Notice>
    );
  if (room.status === "kicked")
    return (
      <Notice title="You left the room">
        The host removed you from this room. You can create a room of your own.
      </Notice>
    );
  if (room.status === "locked")
    return (
      <Notice title="This room is locked">
        The host is not letting new racers in right now. Ask them to unlock it.
      </Notice>
    );
  if (!view)
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <p role="status" className="text-lg text-muted">
          {room.status === "reconnecting"
            ? "Reconnecting to the room…"
            : "Joining the room…"}
        </p>
      </main>
    );

  const connected = room.status === "open";
  const racing = view.phase === "countdown" || view.phase === "racing";
  // Racers at the wheel keep both hands on the controls; everyone else can react.
  const driving = Boolean(
    room.race?.participants.some(
      (p) => p.playerId === view.selfId && p.status === "RACING",
    ),
  );
  return (
    <>
      <ConnectionBanner status={room.status} />
      <EmoteFeed emotes={room.emotes} names={names} selfId={view.selfId} />
      <AnimatePresence mode="wait" initial={false}>
        {racing && stage ? (
          <motion.div
            key={`race-${view.raceId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.25 }}
          >
            <RaceView
              stage={stage}
              race={room.race}
              connected={connected}
              actions={actions}
              drivers={drivers}
              footer={<p className="text-muted">Waiting for everyone to finish…</p>}
            />
            {!driving ? (
              <div className="mx-auto max-w-4xl px-4 pb-10">
                <EmoteBar onSend={room.api.emote} disabled={!connected} />
              </div>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.25 }}
          >
            <Lobby
              view={view}
              request={room.api.request}
              onEmote={room.api.emote}
              connected={connected}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ConnectionBanner({ status }: { status: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <AnimatePresence>
      {status === "reconnecting" ? (
        <motion.p
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-highlight px-4 py-2 text-center font-bold text-highlight-foreground"
          initial={{ y: reduced ? 0 : -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduced ? 0 : -40, opacity: 0 }}
        >
          Connection lost — reconnecting…
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

type Request = ReturnType<typeof useRoom>["api"]["request"];

function Lobby({
  view,
  request,
  onEmote,
  connected,
}: {
  view: RoomView;
  request: Request;
  onEmote: (emote: KartEmote) => void;
  connected: boolean;
}) {
  const host = view.hostId === view.selfId;
  const self = view.players.find((player) => player.playerId === view.selfId);
  const [notice, setNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const [readying, setReadying] = useState(false);
  // The room decides; this count only labels the start button.
  const waiting = view.players.filter(
    (p) => p.connected && p.playerId !== view.hostId && !p.ready,
  ).length;
  const change = async (settings: RoomSettings) => {
    const ack = await request({ type: "settings", settings });
    setNotice(ack.ok ? "" : (ack.message ?? "Could not change the race."));
  };
  const settings = view.settings;
  // Stable while the karts are, so a ready tick does not rebuild the podium scene.
  const driverKey = view.players
    .map((p) => `${p.playerId}:${p.driver.style}:${p.driver.paint ?? ""}`)
    .join("|");
  const drivers = useMemo(
    () =>
      new Map<string, LobbyDriver>(
        view.players.map((player) => [player.playerId, player.driver]),
      ),
    [driverKey],
  );
  const gp = view.grandPrix;
  const gpFinished = Boolean(gp && gp.round >= gp.total);
  useMusic(view.phase === "results" && gpFinished ? "podium" : "menu");
  useEffect(() => {
    if (view.phase === "results" && gpFinished) playSfx("podium");
  }, [view.phase, gpFinished]);
  // The track the next Grand Prix race uses, while a cup is under way.
  const gpNextTrack =
    gp && !gpFinished && settings.mode === "grandPrix"
      ? kartCup(gp.cupId).tracks[gp.round]
      : undefined;
  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 pb-16 pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <LinkButton to="/" variant="secondary" className="min-h-10 px-3 text-base">
              ← Leave
            </LinkButton>
            <SoundButton />
          </div>
          <p className="text-sm font-bold uppercase tracking-wide text-muted">
            Room code
          </p>
          <h1 className="font-mono text-6xl font-black tracking-[0.2em] text-accent">
            {view.code}
          </h1>
        </div>
        <InvitePanel code={view.code} />
      </header>

      {view.phase === "results" && view.results ? (
        <section className="panel grid gap-4 p-5" aria-labelledby="results-heading">
          <h2 id="results-heading" className="wordmark text-3xl">
            {gpFinished ? "Grand Prix complete" : "Results"}
          </h2>
          <PodiumStage
            places={
              gpFinished && view.grandPrix
                ? podiumFromTable(view.grandPrix.table)
                : podiumPlaces(view.results)
            }
            drivers={drivers}
            fallback={
              gpFinished && view.grandPrix ? (
                <Podium table={view.grandPrix.table} selfId={view.selfId} />
              ) : null
            }
          />
          <ResultsTable results={view.results} selfId={view.selfId} />
          {view.grandPrix ? (
            <GrandPrixTable
              cupId={view.grandPrix.cupId}
              table={view.grandPrix.table}
              round={view.grandPrix.round}
              selfId={view.selfId}
            />
          ) : null}
        </section>
      ) : null}

      <section className="panel grid gap-3 p-5" aria-labelledby="players-heading">
        <h2 id="players-heading" className="wordmark text-2xl">
          Racers ({view.players.length}/8)
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {view.players.map((player) => (
              <PlayerRow
                key={player.playerId}
                player={player}
                view={view}
                request={request}
                onNotice={setNotice}
              />
            ))}
          </AnimatePresence>
        </ul>
        {self && !host ? (
          <Button
            variant={self.ready ? "secondary" : "primary"}
            className="justify-self-start px-8"
            aria-pressed={self.ready}
            disabled={readying || !connected}
            onClick={async () => {
              setReadying(true);
              const ack = await request({ type: "ready", ready: !self.ready });
              setReadying(false);
              if (ack.ok) playSfx(self.ready ? "ui-tap" : "ui-confirm");
              else setNotice(ack.message ?? "Could not change that.");
            }}
          >
            {self.ready ? "Ready ✓ (tap to cancel)" : "I’m ready"}
          </Button>
        ) : null}
        <EmoteBar onSend={onEmote} disabled={!connected} />
        <AccessControls view={view} request={request} onNotice={setNotice} />
      </section>

      {self ? (
        <section className="panel p-5">
          <div className="grid gap-5">
            <DriverPicker
              value={self.driver.style}
              onChange={async (style) => {
                saveDriver(style);
                const ack = await request({
                  type: "driver",
                  style,
                  ...(self.driver.paint ? { paint: self.driver.paint } : {}),
                });
                if (!ack.ok) setNotice(ack.message ?? "Could not change driver.");
              }}
            />
            <PaintPicker
              value={self.driver.paint ?? "flame"}
              onChange={async (paint) => {
                savePaint(paint);
                const ack = await request({
                  type: "driver",
                  style: self.driver.style,
                  paint,
                });
                if (!ack.ok) setNotice(ack.message ?? "Could not change paint.");
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="panel grid gap-5 p-5" aria-labelledby="race-heading">
        <h2 id="race-heading" className="wordmark text-2xl">
          Next race
        </h2>
        {gpNextTrack ? (
          <p className="text-lg font-bold">
            {kartCup(view.grandPrix!.cupId).name} · race {view.grandPrix!.round + 1} of{" "}
            {view.grandPrix!.total}: {kartTrackName(gpNextTrack)}
          </p>
        ) : null}
        {host ? (
          <>
            <Segmented
              label="Mode"
              value={settings.mode}
              onChange={(mode) => change({ ...settings, mode })}
              options={[
                { value: "race", label: "Single race" },
                { value: "grandPrix", label: "Grand Prix", note: "3 races, points" },
              ]}
            />
            {settings.mode === "grandPrix" ? (
              <CupPicker
                value={settings.cupId}
                onChange={(cupId) => change({ ...settings, cupId })}
              />
            ) : (
              <TrackPicker
                value={settings.trackId}
                onChange={(trackId) => change({ ...settings, trackId })}
              />
            )}
            <RaceOptions
              value={settings}
              onChange={(rules) => change({ ...settings, ...rules })}
            />
            <Button
              className="justify-self-start px-10"
              disabled={starting || waiting > 0}
              onClick={async () => {
                setStarting(true);
                const ack = await request({ type: "start" });
                setStarting(false);
                if (!ack.ok) setNotice(ack.message ?? "Could not start the race.");
              }}
            >
              {starting
                ? "Starting…"
                : waiting > 0
                  ? `Waiting for ${waiting} ${waiting === 1 ? "racer" : "racers"} to get ready`
                  : gpNextTrack && (view.grandPrix?.round ?? 0) > 0
                    ? `Next race: ${kartTrackName(gpNextTrack)}`
                    : settings.mode === "grandPrix"
                      ? gpFinished
                        ? "New Grand Prix"
                        : "Start Grand Prix"
                      : view.phase === "results"
                        ? "Race again"
                        : "Start race"}
            </Button>
          </>
        ) : (
          <p className="text-lg">
            {settings.mode === "grandPrix"
              ? `${kartCup(settings.cupId).name} Grand Prix`
              : kartTrackName(settings.trackId)}{" "}
            · {settings.laps} {settings.laps === 1 ? "lap" : "laps"} · {settings.cpu}{" "}
            CPU
            {settings.cpu > 0 ? ` (${settings.cpuLevel})` : ""} · items {settings.items}{" "}
            · {settings.speedClass}cc
            <span className="mt-2 block text-muted">
              {self?.ready
                ? "You’re ready. Waiting for the host to start…"
                : "Tap “I’m ready” when you are, then the host starts."}
            </span>
          </p>
        )}
        <p role="status" className="text-accent">
          {notice}
        </p>
      </section>
    </main>
  );
}
