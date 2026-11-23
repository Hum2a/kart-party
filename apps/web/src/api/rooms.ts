import { roomCodeSchema } from "@kart-party/game";

export async function createRoom(
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  try {
    const response = await fetcher("/api/rooms", { method: "POST" });
    const body = (await response.json()) as { code?: unknown; message?: unknown };
    const code = roomCodeSchema.safeParse(body.code);
    if (response.ok && code.success) return { ok: true, code: code.data };
    return {
      ok: false,
      message:
        typeof body.message === "string" ? body.message : "Could not create a room.",
    };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
}

export async function roomExists(code: string, fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher(`/api/rooms/${encodeURIComponent(code)}`);
    return response.ok;
  } catch {
    return false;
  }
}
