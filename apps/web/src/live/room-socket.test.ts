import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openRoomSocket, reconnectDelay, type RoomEvent } from "./room-socket";
import { saveToken } from "./identity";
import { serverOffset, resetServerClock } from "./server-clock";

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  sent: unknown[] = [];
  closed?: { code?: number };
  url: string;
  constructor(url: string) {
    super();
    this.url = url;
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code?: number) {
    this.closed = { code };
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  receive(message: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event("close"), { code }));
  }
}

const options = {
  url: "ws://test/api/rooms/ABCD/ws",
  WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  localStorage.clear();
  sessionStorage.clear();
  resetServerClock();
});
afterEach(() => vi.useRealTimers());

it("spreads reconnects with full jitter, capped at eight seconds", () => {
  expect(reconnectDelay(0, () => 0.999)).toBeLessThan(400);
  expect(reconnectDelay(10, () => 0.999)).toBeLessThan(8_000);
  expect(reconnectDelay(10, () => 0)).toBe(0);
});

it("says hello with the saved token and driver, then stores the new token", () => {
  saveToken("ABCD", "a".repeat(40));
  const events: RoomEvent[] = [];
  const socket = openRoomSocket(
    "ABCD",
    { name: "Ada", driver: "dj" },
    (e) => events.push(e),
    options,
  );
  const ws = FakeSocket.instances[0]!;
  ws.open();
  expect(ws.sent[0]).toEqual({
    type: "hello",
    name: "Ada",
    token: "a".repeat(40),
    driver: "dj",
  });
  ws.receive({ type: "welcome", playerId: "p-aaaaaaaaaa", token: "b".repeat(40) });
  expect(sessionStorage.getItem("kart-party:token:ABCD")).toBe("b".repeat(40));
  expect(events).toContainEqual({ kind: "welcome", playerId: "p-aaaaaaaaaa" });
  socket.close();
});

it("turns acknowledgements into answers and fails pending requests on disconnect", async () => {
  const socket = openRoomSocket("ABCD", { name: "Ada" }, () => {}, options);
  const ws = FakeSocket.instances[0]!;
  ws.open();
  const started = socket.request({ type: "start" });
  const sent = ws.sent.at(-1) as { requestId: string };
  ws.receive({
    type: "ack",
    requestId: sent.requestId,
    ok: false,
    message: "Only the host can do that.",
  });
  await expect(started).resolves.toEqual({
    ok: false,
    message: "Only the host can do that.",
  });
  const lost = socket.request({ type: "lobby" });
  ws.drop();
  await expect(lost).resolves.toMatchObject({ ok: false });
  socket.close();
});

it("reconnects after a drop but stops for a full room", () => {
  const events: RoomEvent[] = [];
  const socket = openRoomSocket(
    "ABCD",
    { name: "Ada" },
    (e) => events.push(e),
    options,
  );
  FakeSocket.instances[0]!.open();
  FakeSocket.instances[0]!.drop();
  expect(events.at(-1)).toEqual({ kind: "status", status: "reconnecting" });
  vi.advanceTimersByTime(8_000);
  expect(FakeSocket.instances).toHaveLength(2);
  const second = FakeSocket.instances[1]!;
  second.open();
  second.receive({ type: "error", code: "full", message: "This room is full." });
  second.drop(4000);
  vi.advanceTimersByTime(10_000);
  expect(FakeSocket.instances).toHaveLength(2);
  expect(events).toContainEqual({
    kind: "status",
    status: "full",
    message: "This room is full.",
  });
  socket.close();
});

it("measures the server clock from pongs and drops controls when backed up", () => {
  const socket = openRoomSocket("ABCD", { name: "Ada" }, () => {}, options);
  const ws = FakeSocket.instances[0]!;
  ws.open();
  const now = Date.now();
  ws.receive({ type: "pong", t: now, serverNow: now + 5_000 });
  expect(serverOffset()).toBeCloseTo(5_000, -1);
  const before = ws.sent.length;
  ws.bufferedAmount = 10_000;
  socket.sendInput({
    raceId: "r",
    sequence: 1,
    steer: 0,
    gas: true,
    brake: false,
    drift: false,
  });
  expect(ws.sent).toHaveLength(before);
  ws.bufferedAmount = 0;
  socket.sendInput({
    raceId: "r",
    sequence: 2,
    steer: 0,
    gas: true,
    brake: false,
    drift: false,
  });
  expect(ws.sent).toHaveLength(before + 1);
  socket.close();
});
