import {
  SELF,
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import type { ServerMessage, RoomView } from "@kart-party/game";
import type { KartRoom } from "../src/room.ts";

type Client = {
  ws: WebSocket;
  messages: ServerMessage[];
  next: <T extends ServerMessage["type"]>(
    type: T,
    where?: (message: Extract<ServerMessage, { type: T }>) => boolean,
  ) => Promise<Extract<ServerMessage, { type: T }>>;
  send: (value: unknown) => void;
};

const open: WebSocket[] = [];
afterEach(() => {
  for (const ws of open.splice(0)) ws.close();
});

async function createRoom(): Promise<string> {
  const response = await SELF.fetch("https://kart.test/api/rooms", { method: "POST" });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { code: string };
  expect(body.code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  return body.code;
}

async function connect(code: string): Promise<Client> {
  const response = await SELF.fetch(`https://kart.test/api/rooms/${code}/ws`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = response.webSocket;
  if (!ws) throw new Error(`No socket (${response.status})`);
  ws.accept();
  open.push(ws);
  const messages: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  ws.addEventListener("message", (event) => {
    messages.push(JSON.parse(event.data as string) as ServerMessage);
    for (const wake of waiters.splice(0)) wake();
  });
  let read = 0;
  const next: Client["next"] = async (type, where) => {
    for (let spins = 0; spins < 200; spins++) {
      while (read < messages.length) {
        const message = messages[read++]!;
        if (message.type === type && (!where || where(message as never)))
          return message as never;
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
    const recent = messages
      .slice(-6)
      .map((m) =>
        m.type === "room"
          ? `room:${m.room.phase}:${m.room.grandPrix?.round ?? "-"}`
          : m.type === "ack"
            ? `ack:${m.requestId}:${m.ok}:${m.message ?? ""}`
            : m.type,
      );
    throw new Error(`Timed out waiting for ${type}; last: ${recent.join(", ")}`);
  };
  return { ws, messages, next, send: (value) => ws.send(JSON.stringify(value)) };
}

async function join(code: string, name: string, token?: string) {
  const client = await connect(code);
  client.send({ type: "hello", name, ...(token ? { token } : {}) });
  const welcome = await client.next("welcome");
  const room = await client.next("room");
  return { client, welcome, room: room.room };
}

const roomStub = (code: string) =>
  (env.KART_ROOM as DurableObjectNamespace<KartRoom>).get(
    env.KART_ROOM.idFromName(code),
  );

describe("room API", () => {
  it("creates rooms, describes them and refuses unknown or malformed codes", async () => {
    const code = await createRoom();
    const found = await SELF.fetch(`https://kart.test/api/rooms/${code.toLowerCase()}`);
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({
      code,
      exists: true,
      players: 0,
      phase: "lobby",
    });
    const missing = await SELF.fetch("https://kart.test/api/rooms/ZZZZ");
    expect(missing.status).toBe(404);
    const malformed = await SELF.fetch("https://kart.test/api/rooms/12");
    expect(malformed.status).toBe(404);
    const health = await SELF.fetch("https://kart.test/api/health");
    expect(await health.json()).toEqual({ ok: true, env: "local" });
  });
});

describe("KartRoom", () => {
  it("makes the first player host and keeps identity across a reconnect", async () => {
    const code = await createRoom();
    const ada = await join(code, "Ada");
    expect(ada.room.hostId).toBe(ada.welcome.playerId);
    expect(ada.room.players).toHaveLength(1);
    const bo = await join(code, "Bo");
    expect(bo.room.hostId).toBe(ada.welcome.playerId);
    expect(bo.room.players.map((p) => p.name)).toEqual(["Ada", "Bo"]);

    bo.client.ws.close();
    const again = await join(code, "Bo two", bo.welcome.token);
    expect(again.welcome.playerId).toBe(bo.welcome.playerId);
    expect(
      again.room.players.find((p) => p.playerId === bo.welcome.playerId)?.name,
    ).toBe("Bo two");
  });

  it("refuses host-only intents from other players and validates settings", async () => {
    const code = await createRoom();
    const ada = await join(code, "Ada");
    const bo = await join(code, "Bo");
    bo.client.send({ type: "start", requestId: "s1" });
    expect(await bo.client.next("ack")).toMatchObject({ requestId: "s1", ok: false });
    bo.client.send({
      type: "settings",
      requestId: "s2",
      settings: {
        trackId: "harbour-v1",
        laps: 1,
        cpu: 0,
        cpuLevel: "normal",
        items: "off",
        speedClass: "100",
        mode: "race",
        cupId: "starter-cup",
      },
    });
    expect(await bo.client.next("ack")).toMatchObject({ requestId: "s2", ok: false });
    ada.client.send({
      type: "settings",
      requestId: "s3",
      settings: {
        trackId: "harbour-v1",
        laps: 1,
        cpu: 0,
        cpuLevel: "normal",
        items: "off",
        speedClass: "100",
        mode: "race",
        cupId: "starter-cup",
      },
    });
    expect(await ada.client.next("ack")).toMatchObject({ requestId: "s3", ok: true });
    const updated = await bo.client.next(
      "room",
      (m) => m.room.settings.trackId === "harbour-v1",
    );
    expect(updated.room.settings).toEqual({
      trackId: "harbour-v1",
      laps: 1,
      cpu: 0,
      cpuLevel: "normal",
      items: "off",
      speedClass: "100",
      mode: "race",
      cupId: "starter-cup",
    });
    ada.client.send({
      type: "settings",
      requestId: "s4",
      settings: {
        trackId: "nowhere",
        laps: 9,
        cpu: 0,
        cpuLevel: "normal",
        items: "off",
        speedClass: "100",
        mode: "race",
        cupId: "starter-cup",
      },
    });
    expect(await ada.client.next("error")).toMatchObject({ code: "bad-request" });
  });

  it("runs a race from countdown to results with device finishes", async () => {
    const code = await createRoom();
    const ada = await join(code, "Ada");
    const bo = await join(code, "Bo");
    ada.client.send({
      type: "settings",
      requestId: "set",
      settings: {
        trackId: "party-ring-v1",
        laps: 1,
        cpu: 1,
        cpuLevel: "hard",
        items: "all",
        speedClass: "100",
        mode: "race",
        cupId: "starter-cup",
      },
    });
    await ada.client.next("ack", (m) => m.requestId === "set");
    ada.client.send({ type: "start", requestId: "go" });
    expect(await ada.client.next("ack", (m) => m.requestId === "go")).toMatchObject({
      ok: true,
    });
    const countdown = await bo.client.next("room", (m) => m.room.phase === "countdown");
    expect(countdown.room.goAt).toBeGreaterThan(countdown.serverNow);
    const grid = await bo.client.next("race");
    expect(grid.race.selfPlayerId).toBe(bo.welcome.playerId);
    expect(
      grid.race.participants.length + (grid.race.nearby?.length ?? 0),
    ).toBeGreaterThan(0);
    const raceId = countdown.room.raceId!;

    // Jump the clock: pretend GO was five seconds ago, then fire the alarm.
    const stub = roomStub(code);
    await runInDurableObject(stub, (instance: KartRoom) => {
      const meta = (instance as unknown as { meta: { goAt: number } }).meta;
      meta.goAt = Date.now() - 20_000;
    });
    await runDurableObjectAlarm(stub);
    await ada.client.next("room", (m) => m.room.phase === "racing");

    ada.client.send({
      type: "input",
      input: { raceId, sequence: 1, steer: 0, gas: true, brake: false, drift: false },
    });
    ada.client.send({
      type: "finish",
      requestId: "f1",
      report: { raceId, elapsedMs: 18_000, lapsMs: [18_000] },
    });
    expect(await ada.client.next("ack", (m) => m.requestId === "f1")).toMatchObject({
      ok: true,
    });
    ada.client.send({
      type: "finish",
      requestId: "f2",
      report: { raceId, elapsedMs: 18_500, lapsMs: [18_500] },
    });
    expect(await ada.client.next("ack", (m) => m.requestId === "f2")).toMatchObject({
      ok: false,
    });
    bo.client.send({
      type: "finish",
      requestId: "f3",
      report: { raceId, elapsedMs: 19_000, lapsMs: [19_000] },
    });
    expect(await bo.client.next("ack", (m) => m.requestId === "f3")).toMatchObject({
      ok: true,
    });
    const results = await ada.client.next("room", (m) => m.room.phase === "results");
    const humans = results.room.results!.filter((row) => !row.cpu);
    expect(humans.map((row) => [row.name, row.timeMs])).toEqual([
      ["Ada", 18_000],
      ["Bo", 19_000],
    ]);
    const adaRow = (results.room as RoomView).players.find((p) => p.name === "Ada")!;
    // The CPU may have won outright; a human win is counted only for first place.
    const cpuFirst = results.room.results![0]!.cpu;
    expect(adaRow.wins).toBe(cpuFirst ? 0 : 1);

    // The race survives the object being evicted and reloaded from storage.
    await runInDurableObject(stub, (_instance, state) => {
      expect(state.storage.kv.get("race")).toMatchObject({ raceId, ended: true });
    });

    ada.client.send({ type: "lobby", requestId: "back" });
    expect(await ada.client.next("ack", (m) => m.requestId === "back")).toMatchObject({
      ok: true,
    });
    await bo.client.next("room", (m) => m.room.phase === "lobby");
  });

  it("refuses unknown players and oversized or malformed messages", async () => {
    const code = await createRoom();
    const stranger = await connect(code);
    stranger.send({ type: "start", requestId: "x" });
    expect(await stranger.next("error")).toMatchObject({ code: "bad-request" });
    stranger.ws.send("not json");
    expect(await stranger.next("error")).toMatchObject({ code: "bad-request" });
    stranger.send({ type: "hello", name: "x".repeat(3000) });
    expect(await stranger.next("error")).toMatchObject({ code: "bad-request" });
    stranger.send({ type: "hello", name: "<script>" });
    expect(await stranger.next("error")).toMatchObject({ code: "bad-request" });
  });

  it("caps a room at eight connected players", async () => {
    const code = await createRoom();
    for (let i = 0; i < 8; i++) await join(code, `P${i}`);
    const late = await connect(code);
    late.send({ type: "hello", name: "Late" });
    expect(await late.next("error")).toMatchObject({ code: "full" });
  });
});

describe("phase 1 options", () => {
  it("gives each racer a kart paint and lets them change it", async () => {
    const code = await createRoom();
    const ada = await join(code, "Ada");
    const bo = await join(code, "Bo");
    const paints = bo.room.players.map((p) => p.driver.paint);
    expect(paints[0]).toBeTruthy();
    expect(paints[0]).not.toBe(paints[1]);
    bo.client.send({ type: "driver", requestId: "d1", style: "dj", paint: "grape" });
    expect(await bo.client.next("ack", (m) => m.requestId === "d1")).toMatchObject({
      ok: true,
    });
    const seen = await ada.client.next("room", (m) =>
      m.room.players.some((p) => p.driver.paint === "grape"),
    );
    expect(seen.room.players.find((p) => p.name === "Bo")?.driver).toEqual({
      style: "dj",
      paint: "grape",
    });
  });

  it("upgrades settings saved before CPU levels and item modes", async () => {
    const code = await createRoom();
    const stub = roomStub(code);
    await runInDurableObject(stub, (_instance, state) => {
      const meta = state.storage.kv.get<{ settings: unknown }>("meta")!;
      state.storage.kv.put("meta", {
        ...meta,
        settings: { trackId: "parkside-v1", laps: 2, cpu: 5, items: false },
      });
    });
    await evictDurableObject(stub);
    const ada = await join(code, "Ada");
    expect(ada.room.settings).toEqual({
      trackId: "parkside-v1",
      laps: 2,
      cpu: 5,
      cpuLevel: "normal",
      items: "off",
      speedClass: "100",
      mode: "race",
      cupId: "starter-cup",
    });
  });
});

describe("Grand Prix rooms", () => {
  it("runs the cup's tracks in order and keeps a running table", async () => {
    const code = await createRoom();
    const ada = await join(code, "Ada");
    ada.client.send({
      type: "settings",
      requestId: "gp",
      settings: {
        trackId: "party-ring-v1",
        laps: 1,
        cpu: 1,
        cpuLevel: "normal",
        items: "off",
        speedClass: "100",
        mode: "grandPrix",
        cupId: "reverse-cup",
      },
    });
    await ada.client.next("ack", (m) => m.requestId === "gp");
    const stub = roomStub(code);
    const tracks: string[] = [];
    for (let round = 1; round <= 3; round++) {
      ada.client.send({ type: "start", requestId: `start-${round}` });
      expect(
        await ada.client.next("ack", (m) => m.requestId === `start-${round}`),
      ).toMatchObject({ ok: true });
      // The room broadcasts the countdown and the grid before it acknowledges the start.
      const racing = [...ada.client.messages]
        .reverse()
        .find(
          (m): m is Extract<ServerMessage, { type: "room" }> =>
            m.type === "room" && m.room.phase === "countdown",
        )!;
      const grid = [...ada.client.messages]
        .reverse()
        .find(
          (m): m is Extract<ServerMessage, { type: "race" }> =>
            m.type === "race" && m.race.raceId === racing.room.raceId,
        )!;
      tracks.push(grid.race.trackId);
      await runInDurableObject(stub, (instance: KartRoom) => {
        (instance as unknown as { meta: { goAt: number } }).meta.goAt =
          Date.now() - 1_000;
      });
      await runDurableObjectAlarm(stub);
      ada.client.send({
        type: "finish",
        requestId: `finish-${round}`,
        report: { raceId: racing.room.raceId!, elapsedMs: 30_000, lapsMs: [30_000] },
      });
      // The room settles and broadcasts results before acknowledging the finish.
      const results = await ada.client.next(
        "room",
        (m) => m.room.phase === "results" && m.room.grandPrix?.round === round,
      );
      expect(
        await ada.client.next("ack", (m) => m.requestId === `finish-${round}`),
      ).toMatchObject({ ok: true });
      expect(results.room.grandPrix).toMatchObject({ cupId: "reverse-cup", total: 3 });
      expect(results.room.grandPrix!.table).toHaveLength(2);
    }
    expect(tracks).toEqual(["harbour-v1", "party-ring-v1", "parkside-v1"]);

    // Starting again after the final race begins a new Grand Prix.
    ada.client.send({ type: "start", requestId: "again" });
    const fresh = await ada.client.next(
      "room",
      (m) => m.room.phase === "countdown" && m.room.grandPrix?.round === 0,
    );
    expect(fresh.room.grandPrix!.table).toEqual([]);
  });
});
