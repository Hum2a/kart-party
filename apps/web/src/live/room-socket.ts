import type {
  ClientMessage,
  KartInput,
  KartRaceView,
  RoomView,
  ServerMessage,
} from "@kart-party/game";
import { noteServerTime } from "./server-clock";
import { saveToken, savedToken, type Identity } from "./identity";

export type ConnectionStatus =
  "connecting" | "open" | "reconnecting" | "full" | "closed";
export type RoomEvent =
  | { kind: "status"; status: ConnectionStatus; message?: string }
  | { kind: "welcome"; playerId: string }
  | { kind: "room"; room: RoomView }
  | { kind: "race"; race: KartRaceView };
export type Ack = { ok: boolean; message?: string };

/** Full jitter, capped: a room's worth of phones must not reconnect in step. */
export function reconnectDelay(attempt: number, random = Math.random): number {
  const cap = Math.min(8_000, 400 * 2 ** Math.min(attempt, 5));
  return Math.floor(random() * cap);
}

/** Controls are dropped rather than queued when the socket is backed up. */
const maxBufferedBytes = 8_192;
const requestTimeoutMs = 8_000;

type Requestable = Exclude<
  ClientMessage,
  { type: "hello" } | { type: "input" } | { type: "ping" }
>;
type RequestBody = Requestable extends infer M
  ? M extends { requestId: string }
    ? Omit<M, "requestId">
    : never
  : never;

/**
 * The only connection to an online room. One socket per open room page:
 * it says hello with the saved token, keeps the clock offset fresh, retries
 * with jitter and turns acknowledgements into promises.
 */
export function openRoomSocket(
  code: string,
  identity: Identity,
  listener: (event: RoomEvent) => void,
  options: { url?: string; WebSocketImpl?: typeof WebSocket } = {},
) {
  const Impl = options.WebSocketImpl ?? WebSocket;
  const url =
    options.url ??
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${code}/ws`;
  let socket: WebSocket | undefined;
  let attempt = 0;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let counter = 0;
  const pending = new Map<
    string,
    { resolve: (ack: Ack) => void; timer: ReturnType<typeof setTimeout> }
  >();

  const raw = (message: ClientMessage) => {
    if (socket?.readyState !== Impl.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };
  const ping = () => raw({ type: "ping", t: Date.now() });

  function settleAll(message: string) {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.resolve({ ok: false, message });
      pending.delete(id);
    }
  }

  function connect() {
    listener({ kind: "status", status: attempt === 0 ? "connecting" : "reconnecting" });
    const ws = new Impl(url);
    socket = ws;
    ws.addEventListener("open", () => {
      attempt = 0;
      const token = savedToken(code);
      raw({
        type: "hello",
        name: identity.name,
        ...(token ? { token } : {}),
        ...(identity.driver ? { driver: identity.driver } : {}),
        ...(identity.paint ? { paint: identity.paint } : {}),
      });
      // A few quick samples give a usable clock offset before GO.
      for (let i = 0; i < 5; i++) setTimeout(ping, i * 150);
      heartbeat = setInterval(ping, 20_000);
    });
    ws.addEventListener("message", (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case "welcome":
          saveToken(code, message.token);
          listener({ kind: "status", status: "open" });
          listener({ kind: "welcome", playerId: message.playerId });
          return;
        case "pong":
          noteServerTime(message.t, message.serverNow, Date.now());
          return;
        case "room":
          listener({ kind: "room", room: message.room });
          return;
        case "race":
          listener({ kind: "race", race: message.race });
          return;
        case "ack": {
          const entry = pending.get(message.requestId);
          if (!entry) return;
          clearTimeout(entry.timer);
          pending.delete(message.requestId);
          entry.resolve({ ok: message.ok, message: message.message });
          return;
        }
        case "error":
          if (message.code === "full") {
            stopped = true;
            listener({ kind: "status", status: "full", message: message.message });
          }
          return;
      }
    });
    ws.addEventListener("close", (event) => {
      clearInterval(heartbeat);
      settleAll("Connection lost. Try again in a moment.");
      if (stopped) return;
      if (event.code === 4004) {
        stopped = true;
        listener({
          kind: "status",
          status: "closed",
          message: "This room has closed.",
        });
        return;
      }
      listener({ kind: "status", status: "reconnecting" });
      retry = setTimeout(connect, reconnectDelay(attempt++));
    });
  }

  connect();

  return {
    request(body: RequestBody): Promise<Ack> {
      const requestId = `r${Date.now().toString(36)}${(counter++).toString(36)}`;
      return new Promise<Ack>((resolve) => {
        if (!raw({ ...body, requestId } as ClientMessage)) {
          resolve({ ok: false, message: "Not connected yet. Try again in a moment." });
          return;
        }
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ ok: false, message: "No answer from the room. Try again." });
        }, requestTimeoutMs);
        pending.set(requestId, { resolve, timer });
      });
    },
    sendInput(input: KartInput) {
      if (socket && socket.bufferedAmount >= maxBufferedBytes) return;
      raw({ type: "input", input });
    },
    close() {
      stopped = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      settleAll("Left the room.");
      socket?.close(1000, "Left");
    },
  };
}

export type RoomSocket = ReturnType<typeof openRoomSocket>;
