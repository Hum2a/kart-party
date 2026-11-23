import { z } from "zod";
import {
  kartInputSchema,
  kartCpuCountSchema,
  kartLapsSchema,
  kartRaceSchema,
} from "./kart/kart-race-schema.ts";
import { kartFinishSchema } from "./kart/kart-rollback-schema.ts";
import { driverStyleSchema, lobbyDriverSchema } from "./kart/kart-driver.ts";
import { kartTrackIdSchema } from "./kart/kart-tracks.ts";
import { kartTrackId } from "./kart/kart-race-schema.ts";

/** Humans in one online room. CPU racers fill the grid on top of this. */
export const maxRoomPlayers = 8;
/** The 3-2-1 before GO. The race clock starts when it ends. */
export const countdownMs = 3_000;
/** A WebSocket message from a browser never needs more than this. */
export const maxClientMessageBytes = 2_048;

/** Four letters, no vowels-that-spell-words ambiguity: I and O are left out. */
export const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z]{4}$/, "A room code is four letters.");
export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "Choose a name.")
  .max(16, "Keep your name to 16 characters.")
  .regex(/^[^<>\u0000-\u001f]+$/, "Use letters, numbers and simple punctuation.");
/** Random, room-scoped credential. Never a device fingerprint. */
export const playerTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);
export const playerIdSchema = z.string().regex(/^p-[A-Za-z0-9_-]{8,32}$/);

export const roomSettingsSchema = z
  .object({
    trackId: kartTrackIdSchema,
    laps: kartLapsSchema,
    cpu: kartCpuCountSchema,
    items: z.boolean(),
  })
  .strict();
export type RoomSettings = z.infer<typeof roomSettingsSchema>;
export const defaultRoomSettings: RoomSettings = {
  trackId: kartTrackId,
  laps: 3,
  cpu: 3,
  items: true,
};

export const roomPhaseSchema = z.enum(["lobby", "countdown", "racing", "results"]);
export type RoomPhase = z.infer<typeof roomPhaseSchema>;

export const roomPlayerSchema = z
  .object({
    playerId: playerIdSchema,
    name: nicknameSchema,
    driver: lobbyDriverSchema,
    connected: z.boolean(),
    wins: z.number().int().nonnegative(),
  })
  .strict();
export type RoomPlayer = z.infer<typeof roomPlayerSchema>;

export const raceResultSchema = z
  .object({
    playerId: z.string().min(1).max(40),
    name: z.string().min(1).max(40),
    place: z.number().int().positive(),
    timeMs: z.number().int().nonnegative().nullable(),
    cpu: z.boolean(),
  })
  .strict();
export type RaceResult = z.infer<typeof raceResultSchema>;

export const roomViewSchema = z
  .object({
    code: roomCodeSchema,
    phase: roomPhaseSchema,
    settings: roomSettingsSchema,
    hostId: playerIdSchema.nullable(),
    selfId: playerIdSchema,
    players: z.array(roomPlayerSchema).max(maxRoomPlayers),
    /** Server clock time when GO happens; present during the countdown and race. */
    goAt: z.number().int().nonnegative().optional(),
    raceId: z.string().min(1).max(80).optional(),
    results: z
      .array(raceResultSchema)
      .max(maxRoomPlayers + 8)
      .optional(),
  })
  .strict();
export type RoomView = z.infer<typeof roomViewSchema>;

const requestId = z.string().min(1).max(40);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("hello"),
      name: nicknameSchema,
      token: playerTokenSchema.optional(),
      driver: driverStyleSchema.optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("settings"), requestId, settings: roomSettingsSchema })
    .strict(),
  z.object({ type: z.literal("driver"), requestId, style: driverStyleSchema }).strict(),
  z.object({ type: z.literal("start"), requestId }).strict(),
  z.object({ type: z.literal("lobby"), requestId }).strict(),
  z
    .object({
      type: z.literal("input"),
      input: kartInputSchema,
    })
    .strict(),
  z.object({ type: z.literal("finish"), requestId, report: kartFinishSchema }).strict(),
  z
    .object({ type: z.literal("item"), requestId, raceId: z.string().min(1).max(80) })
    .strict(),
  z
    .object({
      type: z.literal("recover"),
      requestId,
      raceId: z.string().min(1).max(80),
    })
    .strict(),
  z.object({ type: z.literal("ping"), t: z.number().finite() }).strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const serverMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("welcome"),
      playerId: playerIdSchema,
      token: playerTokenSchema,
    })
    .strict(),
  z
    .object({ type: z.literal("room"), room: roomViewSchema, serverNow: z.number() })
    .strict(),
  z
    .object({ type: z.literal("race"), race: kartRaceSchema, serverNow: z.number() })
    .strict(),
  z
    .object({
      type: z.literal("ack"),
      requestId,
      ok: z.boolean(),
      message: z.string().max(200).optional(),
    })
    .strict(),
  z.object({ type: z.literal("pong"), t: z.number(), serverNow: z.number() }).strict(),
  z
    .object({
      type: z.literal("error"),
      code: z.enum(["full", "bad-request", "rate-limited", "not-found", "kicked"]),
      message: z.string().max(200),
    })
    .strict(),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
