import { DurableObject } from "cloudflare:workers";
import {
  RaceSession,
  clientMessageSchema,
  commandRateLimit,
  countdownMs,
  defaultDriverStyle,
  defaultKartPaint,
  grandPrixDone,
  grandPrixNextTrack,
  grandPrixTable,
  kartCup,
  roomSettingsSchema,
  defaultRoomSettings,
  emoteRateLimit,
  kartTickMs,
  maxClientMessageBytes,
  maxRoomPlayers,
  raceResults,
  roomCodeSchema,
  takeToken,
  type ClientMessage,
  type DriverStyle,
  type GrandPrixState,
  type KartEmote,
  type KartPaint,
  type KartRace,
  type PublicRoom,
  type RateBucket,
  type RateLimit,
  type RaceResult,
  type RoomPhase,
  type RoomSettings,
  type RoomView,
  type ServerMessage,
} from "@kart-party/game";

/** Controls arrive about ten times a second per racer; allow bursts on reconnect. */
const inputRateLimit: RateLimit = { capacity: 40, refillPerSecond: 25 };
/** A room with nobody connected is wiped after this long. */
export const idleRoomMs = 6 * 60 * 60 * 1000;
/** Save the running race this often; finishes, items and recoveries save at once. */
const checkpointEveryTicks = 10;

type Meta = {
  code: string;
  createdAt: number;
  lastActiveAt: number;
  phase: RoomPhase;
  settings: RoomSettings;
  hostId: string | null;
  goAt?: number;
  raceId?: string;
  raceCount: number;
  results?: RaceResult[];
  /** The Grand Prix in progress or just finished, when the room is in that mode. */
  grandPrix?: GrandPrixState;
  /** Only racers already on the roster may come back in. Absent on older rooms. */
  locked?: boolean;
  /** Shown on the public quick-play list. */
  listed?: boolean;
};
type StoredPlayer = {
  playerId: string;
  name: string;
  tokenHash: string;
  driver: DriverStyle;
  /** Absent on racers saved before kart paint existed. */
  paint?: KartPaint;
  wins: number;
  joinedAt: number;
  /** Ready for the next race; cleared when a race starts. */
  ready?: boolean;
};
type Attachment = { playerId?: string };

const randomId = (bytes: number) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * One online room. It owns the roster, the host, the phase and the race.
 * Browsers send intents over one WebSocket; the room answers with room views,
 * per-racer race views and acknowledgements. State that matters is written to
 * this object's SQLite-backed storage before any acknowledgement; queued
 * steering and rate buckets live in memory only.
 */
export class KartRoom extends DurableObject<Env> {
  private meta: Meta | undefined;
  private players = new Map<string, StoredPlayer>();
  private session: RaceSession | undefined;
  private buckets = new Map<string, RateBucket>();
  private ticks = 0;
  private nextTickAt: number | null = null;
  private emotes = 0;
  /** The last summary sent to the public list, so an unchanged room stays quiet. */
  private listing: string | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.load());
  }

  private load() {
    const kv = this.ctx.storage.kv;
    this.meta = kv.get<Meta>("meta");
    // Rooms saved before CPU levels and item modes keep working.
    if (this.meta) {
      const settings = this.meta.settings as Omit<Partial<RoomSettings>, "items"> & {
        items?: RoomSettings["items"] | boolean;
      };
      const upgraded = roomSettingsSchema.safeParse({
        ...defaultRoomSettings,
        ...settings,
        items:
          settings.items === true
            ? "all"
            : settings.items === false
              ? "off"
              : settings.items,
      });
      this.meta.settings = upgraded.success
        ? upgraded.data
        : { ...defaultRoomSettings };
    }
    this.players = new Map(
      (kv.get<StoredPlayer[]>("players") ?? []).map((player) => [
        player.playerId,
        player,
      ]),
    );
    const race = kv.get<KartRace>("race");
    this.session = race ? RaceSession.restore(race) : undefined;
  }

  private saveMeta() {
    this.ctx.storage.kv.put("meta", this.meta);
  }
  private savePlayers() {
    this.ctx.storage.kv.put("players", [...this.players.values()]);
  }
  private saveRace() {
    if (this.session) this.ctx.storage.kv.put("race", this.session.race);
    else this.ctx.storage.kv.delete("race");
  }

  /** RPC from the Worker: claim this room for a new code. False if it is taken. */
  async create(code: string, now: number): Promise<boolean> {
    if (this.meta) return false;
    this.meta = {
      code: roomCodeSchema.parse(code),
      createdAt: now,
      lastActiveAt: now,
      phase: "lobby",
      settings: { ...defaultRoomSettings },
      hostId: null,
      raceCount: 0,
    };
    this.saveMeta();
    // A room nobody joins disappears on its own.
    await this.ctx.storage.setAlarm(now + idleRoomMs);
    return true;
  }

  /** RPC from the Worker: is there a joinable room behind this code? */
  async describe(): Promise<{ exists: boolean; players: number; phase?: RoomPhase }> {
    if (!this.meta) return { exists: false, players: 0 };
    return { exists: true, players: this.players.size, phase: this.meta.phase };
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.meta) return new Response("Room not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected a WebSocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({} satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- socket plumbing -------------------------------------------------

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // A closing socket cannot be written; its close handler tidies up.
    }
  }
  private attachment(ws: WebSocket): Attachment {
    return (ws.deserializeAttachment() as Attachment | null) ?? {};
  }
  private sockets(): { ws: WebSocket; playerId?: string }[] {
    return this.ctx
      .getWebSockets()
      .map((ws) => ({ ws, playerId: this.attachment(ws).playerId }));
  }
  private connectedIds(): Set<string> {
    return new Set(this.sockets().flatMap((s) => (s.playerId ? [s.playerId] : [])));
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const now = Date.now();
    const size = typeof raw === "string" ? raw.length : raw.byteLength;
    if (size > maxClientMessageBytes) {
      this.send(ws, {
        type: "error",
        code: "bad-request",
        message: "Message too large.",
      });
      return;
    }
    let message: ClientMessage;
    try {
      const parsed = clientMessageSchema.safeParse(
        JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)),
      );
      if (!parsed.success) throw new Error("invalid");
      message = parsed.data;
    } catch {
      this.send(ws, {
        type: "error",
        code: "bad-request",
        message: "Unrecognised message.",
      });
      return;
    }
    const { playerId } = this.attachment(ws);
    const limit =
      message.type === "input"
        ? inputRateLimit
        : message.type === "emote"
          ? emoteRateLimit
          : commandRateLimit;
    const bucket =
      message.type === "input" ? "i" : message.type === "emote" ? "e" : "c";
    const key = `${bucket}:${playerId ?? "anon"}:${message.type === "hello" ? "hello" : ""}`;
    const taken = takeToken(this.buckets.get(key), limit, now);
    if (this.buckets.size > 200) this.buckets.clear();
    this.buckets.set(key, taken.bucket);
    if (!taken.allowed) {
      if (message.type !== "input" && message.type !== "emote")
        this.send(ws, {
          type: "error",
          code: "rate-limited",
          message: "Slow down a little.",
        });
      return;
    }
    if (message.type === "ping") {
      this.send(ws, { type: "pong", t: message.t, serverNow: now });
      return;
    }
    if (message.type === "hello") {
      await this.hello(ws, message, now);
      return;
    }
    if (!playerId || !this.players.has(playerId)) {
      this.send(ws, {
        type: "error",
        code: "bad-request",
        message: "Say hello first.",
      });
      return;
    }
    this.meta!.lastActiveAt = now;
    switch (message.type) {
      case "input": {
        if (
          this.meta!.phase === "racing" &&
          this.session &&
          this.meta!.goAt !== undefined
        )
          this.session.input(playerId, message.input, now - this.meta!.goAt);
        return;
      }
      case "settings":
        return this.ack(
          ws,
          message.requestId,
          this.changeSettings(playerId, message.settings),
        );
      case "driver":
        return this.ack(
          ws,
          message.requestId,
          this.changeDriver(playerId, message.style, message.paint),
        );
      case "start":
        return this.ack(ws, message.requestId, await this.start(playerId, now));
      case "ready":
        return this.ack(ws, message.requestId, this.setReady(playerId, message.ready));
      case "access":
        return this.ack(
          ws,
          message.requestId,
          this.changeAccess(playerId, message.locked, message.listed, now),
        );
      case "kick":
        return this.ack(
          ws,
          message.requestId,
          this.kick(playerId, message.playerId, now),
        );
      case "host":
        return this.ack(
          ws,
          message.requestId,
          this.transferHost(playerId, message.playerId),
        );
      case "emote":
        this.emote(playerId, message.emote);
        return;
      case "lobby":
        return this.ack(ws, message.requestId, this.backToLobby(playerId));
      case "finish":
        return this.ack(
          ws,
          message.requestId,
          this.raceAction(now, (session) => session.finish(playerId, message.report)),
        );
      case "item":
        return this.ack(
          ws,
          message.requestId,
          this.raceAction(now, (session, elapsed) =>
            session.useItem(playerId, message.raceId, elapsed),
          ),
        );
      case "recover":
        return this.ack(
          ws,
          message.requestId,
          this.raceAction(now, (session, elapsed) =>
            session.recover(playerId, message.raceId, elapsed),
          ),
        );
    }
  }

  private ack(
    ws: WebSocket,
    requestId: string,
    result: { ok: boolean; message?: string },
  ) {
    this.send(ws, {
      type: "ack",
      requestId,
      ok: result.ok,
      ...(result.ok ? {} : { message: result.message }),
    });
  }

  async webSocketClose(ws: WebSocket) {
    await this.dropped(ws);
  }
  async webSocketError(ws: WebSocket) {
    await this.dropped(ws);
  }

  private async dropped(ws: WebSocket) {
    const { playerId } = this.attachment(ws);
    ws.serializeAttachment({});
    if (!this.meta || !playerId) return;
    const stillHere = this.sockets().some(
      (s) => s.ws !== ws && s.playerId === playerId,
    );
    if (stillHere) return;
    if (this.meta.hostId === playerId) {
      const next = [...this.players.values()].find(
        (player) =>
          player.playerId !== playerId && this.connectedIds().has(player.playerId),
      );
      if (next) {
        this.meta.hostId = next.playerId;
        this.saveMeta();
      }
    }
    // The single alarm also drives the race clock, so only an idle room re-arms it here.
    const idle = this.meta.phase === "lobby" || this.meta.phase === "results";
    if (idle && this.sockets().every((s) => s.ws === ws || !s.playerId))
      await this.ctx.storage.setAlarm(Date.now() + idleRoomMs);
    this.broadcastRoom();
    this.syncListing(Date.now(), ws);
  }

  // ---- intents ----------------------------------------------------------

  private async hello(
    ws: WebSocket,
    message: Extract<ClientMessage, { type: "hello" }>,
    now: number,
  ) {
    const meta = this.meta!;
    let player: StoredPlayer | undefined;
    let token = message.token;
    if (token) {
      const hash = await hashToken(token);
      player = [...this.players.values()].find((p) => p.tokenHash === hash);
    }
    if (player) {
      player.name = message.name;
      if (message.driver) player.driver = message.driver;
      if (message.paint) player.paint = message.paint;
    } else {
      if (meta.locked) {
        this.send(ws, {
          type: "error",
          code: "locked",
          message: "The host has locked this room.",
        });
        ws.close(4005, "Room locked");
        return;
      }
      if (this.players.size >= maxRoomPlayers) {
        // Make room by forgetting someone who left while the room was in the lobby.
        const connected = this.connectedIds();
        const gone = [...this.players.values()].find((p) => !connected.has(p.playerId));
        if (!gone || meta.phase !== "lobby") {
          this.send(ws, { type: "error", code: "full", message: "This room is full." });
          ws.close(4000, "Room full");
          return;
        }
        this.players.delete(gone.playerId);
      }
      token = randomId(32);
      player = {
        playerId: `p-${randomId(12)}`,
        name: message.name,
        tokenHash: await hashToken(token),
        driver: message.driver ?? defaultDriverStyle(this.players.size),
        paint: message.paint ?? defaultKartPaint(this.players.size),
        wins: 0,
        joinedAt: now,
      };
      this.players.set(player.playerId, player);
    }
    if (!meta.hostId || !this.connectedIds().has(meta.hostId))
      meta.hostId = player.playerId;
    meta.lastActiveAt = now;
    this.savePlayers();
    this.saveMeta();
    ws.serializeAttachment({ playerId: player.playerId } satisfies Attachment);
    this.send(ws, { type: "welcome", playerId: player.playerId, token: token! });
    this.broadcastRoom();
    if (this.session && meta.phase !== "lobby") {
      // A racer coming back gets their own view; a late joiner watches.
      const racing = this.session.race.drivers.some(
        (driver) => driver.playerId === player.playerId,
      );
      this.send(ws, {
        type: "race",
        race: this.session.view(racing ? player.playerId : null),
        serverNow: now,
      });
    }
    this.syncListing(now);
  }

  private requireHost(playerId: string): { ok: false; message: string } | undefined {
    return this.meta!.hostId === playerId
      ? undefined
      : { ok: false, message: "Only the host can do that." };
  }

  private changeSettings(playerId: string, settings: RoomSettings) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    if (this.meta!.phase !== "lobby" && this.meta!.phase !== "results")
      return { ok: false as const, message: "Change the race between races." };
    const meta = this.meta!;
    // A new mode or cup starts a fresh Grand Prix; other changes carry on.
    if (settings.mode !== meta.settings.mode || settings.cupId !== meta.settings.cupId)
      meta.grandPrix = undefined;
    meta.settings = settings;
    this.saveMeta();
    this.broadcastRoom();
    this.syncListing(Date.now());
    return { ok: true as const };
  }

  private setReady(playerId: string, ready: boolean) {
    const phase = this.meta!.phase;
    if (phase !== "lobby" && phase !== "results")
      return { ok: false as const, message: "Get ready between races." };
    this.players.get(playerId)!.ready = ready;
    this.savePlayers();
    this.broadcastRoom();
    return { ok: true as const };
  }

  private changeAccess(
    playerId: string,
    locked: boolean,
    listed: boolean,
    now: number,
  ) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    this.meta!.locked = locked;
    this.meta!.listed = listed;
    this.saveMeta();
    this.broadcastRoom();
    this.syncListing(now);
    return { ok: true as const };
  }

  /**
   * Takes a racer off the roster and closes their sockets. A kart already on
   * the grid stays where it is with its controls released. They may join again
   * as someone new unless the room is locked.
   */
  private kick(playerId: string, targetId: string, now: number) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    if (targetId === playerId)
      return { ok: false as const, message: "You cannot remove yourself." };
    if (!this.players.delete(targetId))
      return { ok: false as const, message: "That racer has already left." };
    this.session?.forget(targetId);
    this.savePlayers();
    for (const { ws, playerId: id } of this.sockets()) {
      if (id !== targetId) continue;
      ws.serializeAttachment({} satisfies Attachment);
      this.send(ws, {
        type: "error",
        code: "kicked",
        message: "The host removed you from this room.",
      });
      ws.close(4003, "Removed by the host");
    }
    this.broadcastRoom();
    this.syncListing(now);
    return { ok: true as const };
  }

  private transferHost(playerId: string, targetId: string) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    if (!this.players.has(targetId) || !this.connectedIds().has(targetId))
      return { ok: false as const, message: "That racer is not here right now." };
    this.meta!.hostId = targetId;
    this.saveMeta();
    this.broadcastRoom();
    return { ok: true as const };
  }

  /** Reactions are passed straight on and never stored. */
  private emote(playerId: string, emote: KartEmote) {
    const id = this.emotes++;
    for (const socket of this.sockets())
      if (socket.playerId) this.send(socket.ws, { type: "emote", id, playerId, emote });
  }

  private changeDriver(playerId: string, style: DriverStyle, paint?: KartPaint) {
    const player = this.players.get(playerId)!;
    player.driver = style;
    if (paint) player.paint = paint;
    this.savePlayers();
    this.broadcastRoom();
    return { ok: true as const };
  }

  private async start(playerId: string, now: number) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    const meta = this.meta!;
    if (meta.phase !== "lobby" && meta.phase !== "results")
      return { ok: false as const, message: "A race is already running." };
    const connected = this.connectedIds();
    const racers = [...this.players.values()].filter((p) => connected.has(p.playerId));
    if (racers.length === 0)
      return { ok: false as const, message: "Nobody is here to race." };
    const waiting = racers.filter((p) => p.playerId !== playerId && !p.ready).length;
    if (waiting > 0)
      return {
        ok: false as const,
        message:
          waiting === 1
            ? "Waiting for 1 racer to get ready."
            : `Waiting for ${waiting} racers to get ready.`,
      };
    for (const player of this.players.values()) player.ready = false;
    meta.raceCount += 1;
    meta.raceId = `${meta.code}-${meta.raceCount}-${randomId(4)}`;
    meta.goAt = now + countdownMs;
    meta.phase = "countdown";
    meta.results = undefined;
    let trackId = meta.settings.trackId;
    if (meta.settings.mode === "grandPrix") {
      if (
        !meta.grandPrix ||
        grandPrixDone(meta.grandPrix) ||
        meta.grandPrix.cupId !== meta.settings.cupId
      )
        meta.grandPrix = { cupId: meta.settings.cupId, races: [] };
      trackId = grandPrixNextTrack(meta.grandPrix)!;
    } else meta.grandPrix = undefined;
    this.session = RaceSession.create({
      raceId: meta.raceId,
      players: racers.map((p) => ({ playerId: p.playerId, name: p.name })),
      trackId,
      laps: meta.settings.laps,
      cpu: meta.settings.cpu,
      cpuLevel: meta.settings.cpuLevel,
      speedClass: meta.settings.speedClass,
      items: meta.settings.items,
    });
    this.ticks = 0;
    this.saveRace();
    this.saveMeta();
    this.savePlayers();
    this.nextTickAt = meta.goAt;
    await this.ctx.storage.setAlarm(meta.goAt);
    this.broadcastRoom();
    this.broadcastRace(now);
    this.syncListing(now);
    return { ok: true as const };
  }

  private backToLobby(playerId: string) {
    const refusal = this.requireHost(playerId);
    if (refusal) return refusal;
    if (this.meta!.phase !== "results")
      return { ok: false as const, message: "Finish the race first." };
    this.meta!.phase = "lobby";
    this.meta!.goAt = undefined;
    this.session = undefined;
    this.saveRace();
    this.saveMeta();
    this.broadcastRoom();
    this.syncListing(Date.now());
    return { ok: true as const };
  }

  private raceAction(
    now: number,
    act: (
      session: RaceSession,
      elapsedMs: number,
    ) => { ok: true } | { ok: false; message: string },
  ) {
    const meta = this.meta!;
    if (meta.phase !== "racing" || !this.session || meta.goAt === undefined)
      return { ok: false as const, message: "The race is not running." };
    const result = act(this.session, now - meta.goAt);
    if (result.ok) {
      // Persist before the acknowledgement leaves this object.
      this.saveRace();
      if (this.session.race.ended) this.settle(now);
      else this.broadcastRace(now);
    }
    return result;
  }

  // ---- clock ---------------------------------------------------------------

  async alarm() {
    const now = Date.now();
    const meta = this.meta;
    if (!meta) return;
    if (meta.phase === "countdown" && meta.goAt !== undefined && now >= meta.goAt) {
      meta.phase = "racing";
      this.saveMeta();
      this.broadcastRoom();
      this.syncListing(now);
    }
    if (meta.phase === "racing" && this.session && meta.goAt !== undefined) {
      const race = this.session.tick(now - meta.goAt);
      this.ticks += 1;
      if (race.ended) {
        this.settle(now);
      } else {
        if (this.ticks % checkpointEveryTicks === 0) this.saveRace();
        this.broadcastRace(now);
        const due = this.nextTickAt ?? now;
        const onBeat = due + kartTickMs;
        this.nextTickAt = onBeat - now >= kartTickMs / 2 ? onBeat : now + kartTickMs;
        await this.ctx.storage.setAlarm(this.nextTickAt);
        return;
      }
    }
    if (meta.phase === "countdown" && meta.goAt !== undefined) {
      await this.ctx.storage.setAlarm(meta.goAt);
      return;
    }
    this.nextTickAt = null;
    const anyone = this.sockets().some((s) => s.playerId);
    if (!anyone && now - meta.lastActiveAt >= idleRoomMs) {
      if (meta.listed)
        await this.directory()
          .remove(meta.code, now)
          .catch(() => {});
      await this.ctx.storage.deleteAll();
      this.meta = undefined;
      this.players.clear();
      this.session = undefined;
      for (const { ws } of this.sockets()) ws.close(4004, "Room closed");
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(now, meta.lastActiveAt) + idleRoomMs);
  }

  private settle(now: number) {
    const meta = this.meta!;
    const race = this.session!.race;
    meta.phase = "results";
    meta.results = raceResults(race);
    meta.grandPrix?.races.push(meta.results);
    const winner = meta.results.find(
      (row) => !row.cpu && row.place === 1 && row.timeMs !== null,
    );
    if (winner) {
      const player = this.players.get(winner.playerId);
      if (player) player.wins += 1;
    }
    this.nextTickAt = null;
    this.saveRace();
    this.savePlayers();
    this.saveMeta();
    this.broadcastRace(now);
    this.broadcastRoom();
    this.syncListing(now);
    void this.ctx.storage.setAlarm(now + idleRoomMs);
  }

  // ---- public list ----------------------------------------------------------

  private directory() {
    const namespace = this.env.ROOM_DIRECTORY;
    return namespace.get(namespace.idFromName("public"));
  }

  /**
   * Tells the public list about this room when something it shows changes.
   * It runs after the room's own state is saved and never delays a reply: the
   * list is a convenience, not part of the race. `leaving` is a socket that is
   * closing and must not be counted.
   */
  private syncListing(now: number, leaving?: WebSocket) {
    const meta = this.meta;
    if (!meta) return;
    const here = new Set(
      this.sockets().flatMap((s) =>
        s.playerId && s.ws !== leaving ? [s.playerId] : [],
      ),
    );
    const open =
      meta.listed &&
      !meta.locked &&
      here.size > 0 &&
      this.players.size < maxRoomPlayers;
    const summary: PublicRoom | undefined = open
      ? {
          code: meta.code,
          players: here.size,
          phase: meta.phase,
          mode: meta.settings.mode,
          trackId: meta.settings.trackId,
          cupId: meta.settings.cupId,
          updatedAt: now,
        }
      : undefined;
    const key = summary ? JSON.stringify({ ...summary, updatedAt: 0 }) : "";
    // After a restart `listing` is unknown, so the first change always reports.
    if (this.listing !== undefined && key === this.listing) return;
    const was = this.listing;
    this.listing = key;
    const call = summary
      ? this.directory().upsert(summary)
      : was === "" || (was === undefined && !meta.listed)
        ? undefined
        : this.directory().remove(meta.code, now);
    if (call)
      this.ctx.waitUntil(
        call.catch(() => {
          // Report again on the next change.
          this.listing = undefined;
        }),
      );
  }

  // ---- views ---------------------------------------------------------------

  private roomView(selfId: string): RoomView {
    const meta = this.meta!;
    const connected = this.connectedIds();
    return {
      code: meta.code,
      phase: meta.phase,
      settings: meta.settings,
      hostId: meta.hostId,
      selfId,
      locked: Boolean(meta.locked),
      listed: Boolean(meta.listed),
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          playerId: p.playerId,
          name: p.name,
          driver: { style: p.driver, ...(p.paint ? { paint: p.paint } : {}) },
          connected: connected.has(p.playerId),
          ready: Boolean(p.ready),
          wins: p.wins,
        })),
      ...(meta.goAt !== undefined && meta.phase !== "lobby" ? { goAt: meta.goAt } : {}),
      ...(meta.raceId && meta.phase !== "lobby" ? { raceId: meta.raceId } : {}),
      ...(meta.results ? { results: meta.results } : {}),
      ...(meta.grandPrix
        ? {
            grandPrix: {
              cupId: meta.grandPrix.cupId,
              round: meta.grandPrix.races.length,
              total: kartCup(meta.grandPrix.cupId).tracks.length,
              table: grandPrixTable(meta.grandPrix.races),
            },
          }
        : {}),
    };
  }

  private broadcastRoom() {
    if (!this.meta) return;
    const now = Date.now();
    for (const { ws, playerId } of this.sockets())
      if (playerId)
        this.send(ws, { type: "room", room: this.roomView(playerId), serverNow: now });
  }

  /** One projection per racer (their own item, inputs and nearby karts); one shared for watchers. */
  private broadcastRace(now: number) {
    if (!this.session) return;
    let watcher: ReturnType<RaceSession["view"]> | undefined;
    const racing = new Set(this.session.race.drivers.map((d) => d.playerId));
    for (const { ws, playerId } of this.sockets()) {
      if (!playerId) continue;
      const race = racing.has(playerId)
        ? this.session.view(playerId)
        : (watcher ??= this.session.view(null));
      this.send(ws, { type: "race", race, serverNow: now });
    }
  }
}
