import { Hono } from "hono";
import { roomCodeAlphabet, roomCodeSchema } from "@kart-party/game";
import type { KartRoom } from "./room.ts";

export { KartRoom } from "./room.ts";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

const rooms = (env: Env) => env.KART_ROOM as DurableObjectNamespace<KartRoom>;

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => roomCodeAlphabet[b % roomCodeAlphabet.length]).join(
    "",
  );
}

app.get("/api/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

app.post("/api/rooms", async (c) => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    const stub = rooms(c.env).get(rooms(c.env).idFromName(code));
    if (await stub.create(code, Date.now())) return c.json({ code }, 201);
  }
  return c.json(
    { error: "busy", message: "Could not find a free room code. Try again." },
    503,
  );
});

app.get("/api/rooms/:code", async (c) => {
  const code = roomCodeSchema.safeParse(c.req.param("code"));
  if (!code.success) return c.json({ exists: false }, 404);
  const stub = rooms(c.env).get(rooms(c.env).idFromName(code.data));
  const room = await stub.describe();
  return c.json({ code: code.data, ...room }, room.exists ? 200 : 404);
});

app.get("/api/rooms/:code/ws", async (c) => {
  const code = roomCodeSchema.safeParse(c.req.param("code"));
  if (!code.success) return c.text("Room not found", 404);
  if (c.req.header("Upgrade") !== "websocket")
    return c.text("Expected a WebSocket", 426);
  const stub = rooms(c.env).get(rooms(c.env).idFromName(code.data));
  return stub.fetch(c.req.raw);
});

app.all("/api/*", (c) => c.json({ error: "not-found" }, 404));

export default app;
