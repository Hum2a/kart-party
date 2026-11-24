import { useEffect, useMemo, useRef, useState } from "react";
import type { KartEmote, KartRaceView, RoomView } from "@kart-party/game";
import type { Identity } from "../live/identity";
import {
  openRoomSocket,
  type ConnectionStatus,
  type EmoteEvent,
  type RoomSocket,
} from "../live/room-socket";

export type RoomState = {
  status: ConnectionStatus;
  message?: string;
  playerId?: string;
  room?: RoomView;
};

/** How long a reaction stays on screen, and how many show at once. */
export const emoteShowMs = 3_200;
const maxShownEmotes = 6;

/**
 * Opens the room's socket for as long as the page is mounted. Room state,
 * race frames and reactions are kept apart: a race frame ten times a second
 * re-renders the race screen, never the lobby.
 */
export function useRoom(code: string, identity: Identity | null) {
  const [state, setState] = useState<RoomState>({ status: "connecting" });
  const [race, setRace] = useState<KartRaceView | undefined>();
  const [emotes, setEmotes] = useState<EmoteEvent[]>([]);
  const socket = useRef<RoomSocket | undefined>(undefined);
  const name = identity?.name;
  const driver = identity?.driver;
  const paint = identity?.paint;
  useEffect(() => {
    if (!name) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const opened = openRoomSocket(code, { name, driver, paint }, (event) => {
      switch (event.kind) {
        case "status":
          setState((previous) => ({
            ...previous,
            status: event.status,
            message: event.message,
          }));
          return;
        case "welcome":
          setState((previous) => ({ ...previous, playerId: event.playerId }));
          return;
        case "room":
          setState((previous) => ({ ...previous, room: event.room }));
          if (event.room.phase === "lobby") setRace(undefined);
          return;
        case "race":
          setRace(event.race);
          return;
        case "emote": {
          setEmotes((shown) => [...shown, event.emote].slice(-maxShownEmotes));
          const timer = setTimeout(() => {
            timers.delete(timer);
            setEmotes((shown) => shown.filter((item) => item.id !== event.emote.id));
          }, emoteShowMs);
          timers.add(timer);
          return;
        }
      }
    });
    socket.current = opened;
    return () => {
      opened.close();
      for (const timer of timers) clearTimeout(timer);
      socket.current = undefined;
    };
    // Driver and paint go with hello only; later changes go through a request.
  }, [code, name]);
  const api = useMemo(
    () => ({
      request: (body: Parameters<RoomSocket["request"]>[0]) =>
        socket.current?.request(body) ??
        Promise.resolve({ ok: false, message: "Not connected yet." }),
      sendInput: (input: Parameters<RoomSocket["sendInput"]>[0]) =>
        socket.current?.sendInput(input),
      emote: (emote: KartEmote) => socket.current?.emote(emote),
    }),
    [],
  );
  return {
    ...state,
    race: state.room?.phase === "lobby" ? undefined : race,
    emotes,
    api,
  };
}
