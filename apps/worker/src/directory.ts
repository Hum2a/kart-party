import { DurableObject } from "cloudflare:workers";
import {
  maxPublicRooms,
  publicRoomSchema,
  publicRoomTtlMs,
  roomCodeSchema,
  type PublicRoom,
} from "@kart-party/game";

/**
 * The public quick-play list. One instance for the whole site. Rooms report
 * here only when their roster, phase or access changes, never on race ticks,
 * and a room that stops reporting drops off after `publicRoomTtlMs`.
 */
export class RoomDirectory extends DurableObject<Env> {
  private rooms(): Map<string, PublicRoom> {
    const saved = this.ctx.storage.kv.get<PublicRoom[]>("rooms") ?? [];
    return new Map(saved.map((room) => [room.code, room]));
  }
  private save(rooms: Map<string, PublicRoom>, now: number) {
    const fresh = [...rooms.values()]
      .filter((room) => now - room.updatedAt < publicRoomTtlMs)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      // Keep a little headroom beyond what the list shows.
      .slice(0, maxPublicRooms * 2);
    this.ctx.storage.kv.put("rooms", fresh);
  }

  /** A listed, joinable room's latest summary. */
  async upsert(raw: PublicRoom): Promise<void> {
    const room = publicRoomSchema.parse(raw);
    const rooms = this.rooms();
    rooms.set(room.code, room);
    this.save(rooms, room.updatedAt);
  }

  async remove(code: string, now: number): Promise<void> {
    const rooms = this.rooms();
    if (!rooms.delete(roomCodeSchema.parse(code))) return;
    this.save(rooms, now);
  }

  /** Rooms with space, newest first. Lobbies come before rooms mid-race. */
  async list(now: number): Promise<PublicRoom[]> {
    const order = { lobby: 0, results: 1, countdown: 2, racing: 3 } as const;
    return [...this.rooms().values()]
      .filter((room) => now - room.updatedAt < publicRoomTtlMs)
      .sort((a, b) => order[a.phase] - order[b.phase] || b.updatedAt - a.updatedAt)
      .slice(0, maxPublicRooms);
  }
}
