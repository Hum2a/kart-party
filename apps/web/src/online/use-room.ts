import { useEffect, useMemo, useRef, useState } from "react";
import type { DriverStyle, KartRaceView, RoomView } from "@kart-party/game";
import {
  openRoomSocket,
  type ConnectionStatus,
  type RoomSocket,
} from "../live/room-socket";

export type RoomState = {
  status: ConnectionStatus;
  message?: string;
  playerId?: string;
  room?: RoomView;
};

/**
 * Opens the room's socket for as long as the page is mounted. Room state and
 * race frames are kept apart: a race frame ten times a second re-renders the
 * race screen, never the lobby.
 */
export function useRoom(
  code: string,
  identity: { name: string; driver?: DriverStyle } | null,
) {
  const [state, setState] = useState<RoomState>({ status: "connecting" });
  const [race, setRace] = useState<KartRaceView | undefined>();
  const socket = useRef<RoomSocket | undefined>(undefined);
  const name = identity?.name;
  const driver = identity?.driver;
  useEffect(() => {
    if (!name) return;
    const opened = openRoomSocket(code, { name, driver }, (event) => {
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
      }
    });
    socket.current = opened;
    return () => {
      opened.close();
      socket.current = undefined;
    };
    // The driver is sent with hello only; later changes go through a request.
  }, [code, name]);
  const api = useMemo(
    () => ({
      request: (body: Parameters<RoomSocket["request"]>[0]) =>
        socket.current?.request(body) ??
        Promise.resolve({ ok: false, message: "Not connected yet." }),
      sendInput: (input: Parameters<RoomSocket["sendInput"]>[0]) =>
        socket.current?.sendInput(input),
    }),
    [],
  );
  return { ...state, race: state.room?.phase === "lobby" ? undefined : race, api };
}
