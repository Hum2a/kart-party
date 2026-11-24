import {
  publicRoomListSchema,
  roomCodeSchema,
  type PublicRoom,
} from "@kart-party/game";

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

/** Open public rooms, newest lobbies first. An empty list when offline. */
export async function listPublicRooms(
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; rooms: PublicRoom[] } | { ok: false }> {
  try {
    const response = await fetcher("/api/rooms/public");
    if (!response.ok) return { ok: false };
    const body = publicRoomListSchema.safeParse(await response.json());
    return body.success ? { ok: true, rooms: body.data.rooms } : { ok: false };
  } catch {
    return { ok: false };
  }
}
