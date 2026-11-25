import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  RaceSession,
  defaultRoomSettings,
  type RoomPlayer,
  type RoomView,
} from "@kart-party/game";
import { EmoteBar, EmoteFeed } from "./emotes";
import { AccessControls, InvitePanel, PlayerRow } from "./lobby-parts";
import { QuickPlay } from "./QuickPlay";
import { nextTarget } from "../kart/KartSpectatorView";

afterEach(cleanup);

const player = (id: string, name: string, extra: Partial<RoomPlayer> = {}) => ({
  playerId: `p-${id.repeat(10)}`,
  name,
  driver: { style: "dj" as const, paint: "flame" as const },
  connected: true,
  ready: false,
  wins: 0,
  ...extra,
});
const ada = player("a", "Ada");
const bo = player("b", "Bo");
const room = (selfId: string, extra: Partial<RoomView> = {}): RoomView => ({
  code: "ABCD",
  phase: "lobby",
  settings: defaultRoomSettings,
  hostId: ada.playerId,
  selfId,
  players: [ada, bo],
  locked: false,
  listed: false,
  ...extra,
});
const ok = () => Promise.resolve({ ok: true });

it("sends a reaction from the bar, and slows down a held tap", () => {
  const send = vi.fn();
  render(<EmoteBar onSend={send} />);
  fireEvent.click(screen.getByLabelText("On fire"));
  fireEvent.click(screen.getByLabelText("Wave"));
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith("fire");
});

it("shows who reacted, and calls your own reactions yours", () => {
  const names = new Map([
    [ada.playerId, "Ada"],
    [bo.playerId, "Bo"],
  ]);
  render(
    <EmoteFeed
      selfId={bo.playerId}
      names={names}
      emotes={[
        { id: 1, playerId: ada.playerId, emote: "wave" },
        { id: 2, playerId: bo.playerId, emote: "trophy" },
      ]}
    />,
  );
  expect(screen.getByText("Ada")).toBeTruthy();
  expect(screen.getByText("You")).toBeTruthy();
  expect(screen.getByText("Trophy")).toBeTruthy();
});

it("lets the host remove a racer after confirming, or hand over the host", async () => {
  const request = vi.fn(ok);
  const notice = vi.fn();
  render(
    <ul>
      <PlayerRow
        player={bo}
        view={room(ada.playerId)}
        request={request}
        onNotice={notice}
      />
    </ul>,
  );
  expect(screen.getByText("Not ready")).toBeTruthy();
  fireEvent.click(screen.getByText("Remove…"));
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Keep"));
  fireEvent.click(screen.getByText("Remove…"));
  await act(async () => fireEvent.click(screen.getByText("Remove")));
  expect(request).toHaveBeenLastCalledWith({ type: "kick", playerId: bo.playerId });
  await act(async () => fireEvent.click(screen.getByText("Make host")));
  expect(request).toHaveBeenLastCalledWith({ type: "host", playerId: bo.playerId });
});

it("gives other racers no host actions, and shows who is ready", () => {
  render(
    <ul>
      <PlayerRow
        player={{ ...ada, ready: true }}
        view={room(bo.playerId)}
        request={vi.fn(ok)}
        onNotice={vi.fn()}
      />
      <PlayerRow
        player={{ ...bo, ready: true }}
        view={room(bo.playerId)}
        request={vi.fn(ok)}
        onNotice={vi.fn()}
      />
    </ul>,
  );
  expect(screen.queryByText("Remove…")).toBeNull();
  expect(screen.getByText("Host")).toBeTruthy();
  expect(screen.getByText("Ready")).toBeTruthy();
});

it("lets the host lock and list the room, and tells others it is locked", async () => {
  const request = vi.fn(ok);
  const view = render(
    <AccessControls view={room(ada.playerId)} request={request} onNotice={vi.fn()} />,
  );
  await act(async () => fireEvent.click(screen.getByLabelText(/Lock the room/)));
  expect(request).toHaveBeenLastCalledWith({
    type: "access",
    locked: true,
    listed: false,
  });
  await act(async () => fireEvent.click(screen.getByLabelText(/List on quick play/)));
  expect(request).toHaveBeenLastCalledWith({
    type: "access",
    locked: false,
    listed: true,
  });
  view.rerender(
    <AccessControls
      view={room(bo.playerId, { locked: true })}
      request={request}
      onNotice={vi.fn()}
    />,
  );
  expect(screen.queryByLabelText(/Lock the room/)).toBeNull();
  expect(screen.getByText(/locked this room/)).toBeTruthy();
});

it("draws a QR code for the room link when the invite opens", async () => {
  render(<InvitePanel code="ABCD" />);
  fireEvent.click(screen.getByText("Invite friends"));
  const qr = await screen.findByRole("img", { name: "QR code for room ABCD" });
  expect(qr.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  expect(screen.getByText(`${location.origin}/r/ABCD`)).toBeTruthy();
});

it("lists open rooms without names and joins one", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      rooms: [
        {
          code: "WXYZ",
          players: 3,
          phase: "racing",
          mode: "grandPrix",
          trackId: "party-ring-v1",
          cupId: "starter-cup",
          updatedAt: 1,
        },
      ],
    }),
  ) as unknown as typeof fetch;
  const join = vi.fn();
  render(<QuickPlay onJoin={join} fetcher={fetcher} />);
  await screen.findByText("WXYZ");
  expect(screen.getByText(/3\/8 racers · Racing now/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Join room WXYZ"));
  expect(join).toHaveBeenCalledWith("WXYZ");
});

it("says so when there are no open rooms or the list cannot load", async () => {
  const empty = vi.fn(async () =>
    Response.json({ rooms: [] }),
  ) as unknown as typeof fetch;
  const view = render(<QuickPlay onJoin={vi.fn()} fetcher={empty} />);
  await screen.findByText(/No open rooms right now/);
  view.unmount();
  const broken = vi.fn(async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  render(<QuickPlay onJoin={vi.fn()} fetcher={broken} />);
  await waitFor(() =>
    expect(screen.getByText(/Could not load open rooms/)).toBeTruthy(),
  );
});

it("cycles the watched racer through the race order and back round", () => {
  const session = RaceSession.create({
    raceId: "watch",
    players: [
      { playerId: ada.playerId, name: "Ada" },
      { playerId: bo.playerId, name: "Bo" },
    ],
    trackId: "party-ring-v1",
    laps: 1,
    cpu: 1,
    items: "off",
  });
  const race = session.view(null);
  const order = race.leaderboard.map((row) => row.playerId);
  expect(order).toHaveLength(3);
  expect(nextTarget(race, "overview", 1)).toBe(order[0]);
  expect(nextTarget(race, "overview", -1)).toBe(order[2]);
  expect(nextTarget(race, order[2]!, 1)).toBe(order[0]);
  expect(nextTarget(race, order[0]!, -1)).toBe(order[2]);
});

it("says practice still works when the device is offline", async () => {
  const { MemoryRouter } = await import("react-router");
  const { PlayPage } = await import("./PlayPage");
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  render(
    <MemoryRouter>
      <PlayPage />
    </MemoryRouter>,
  );
  expect(screen.getByText(/You are offline/)).toBeTruthy();
  online.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(screen.queryByText(/You are offline/)).toBeNull());
  online.mockRestore();
});
