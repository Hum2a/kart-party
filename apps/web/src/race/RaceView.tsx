import { useCallback, useMemo, useState, type ReactNode } from "react";
import type {
  KartFinish,
  KartInput,
  KartRaceView,
  LobbyDriver,
} from "@kart-party/game";
import { RaceScreen } from "../kart/RaceScreen";
import { KartDriversContext } from "../kart/drivers-context";
import type { RaceStage } from "../kart/race-stage";

export type RaceAck = { ok: boolean; message?: string };
type MaybeAsync<T> = T | Promise<T>;

export type RaceActions = {
  input: (input: KartInput) => void;
  finish: (report: KartFinish) => MaybeAsync<RaceAck>;
  item: (raceId: string) => MaybeAsync<RaceAck>;
  recover: (raceId: string) => MaybeAsync<RaceAck>;
};

/**
 * One race screen for practice and online rooms. It tracks the pending and
 * refused states of items, recovery and the finish report, so the racer sees
 * "sending" until the race owner answers.
 */
export function RaceView({
  stage,
  race,
  connected = true,
  actions,
  drivers,
  footer,
}: {
  stage: RaceStage;
  race: KartRaceView | undefined;
  connected?: boolean;
  actions: RaceActions;
  drivers: ReadonlyMap<string, LobbyDriver>;
  footer?: ReactNode;
}) {
  const [itemPending, setItemPending] = useState(false);
  const [itemNotice, setItemNotice] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [finishNotice, setFinishNotice] = useState("");

  const onUseItem = useCallback(
    async (raceId: string) => {
      setItemPending(true);
      setItemNotice("");
      const ack = await actions.item(raceId);
      setItemPending(false);
      setItemNotice(ack.ok ? "" : (ack.message ?? "That item could not be used."));
    },
    [actions],
  );
  const onRecover = useCallback(
    async (raceId: string) => {
      setRecoveryPending(true);
      setRecoveryNotice("");
      const ack = await actions.recover(raceId);
      setRecoveryPending(false);
      setRecoveryNotice(
        ack.ok ? "" : (ack.message ?? "Could not return to the track."),
      );
    },
    [actions],
  );
  const onFinish = useCallback(
    async (report: KartFinish) => {
      setFinishNotice("Finish recorded — saving your time…");
      const ack = await actions.finish(report);
      setFinishNotice(
        ack.ok ? "Time saved." : (ack.message ?? "Your finish could not be saved."),
      );
    },
    [actions],
  );
  const onInput = useCallback((input: KartInput) => actions.input(input), [actions]);
  const context = useMemo(
    () => ({ gameId: race?.raceId ?? "", byPlayer: drivers }),
    [race?.raceId, drivers],
  );
  return (
    <KartDriversContext.Provider value={context}>
      <RaceScreen
        stage={stage}
        race={race}
        connected={connected}
        onInput={onInput}
        onFinish={onFinish}
        finishNotice={finishNotice}
        onUseItem={onUseItem}
        itemPending={itemPending}
        itemNotice={itemNotice}
        onRecover={onRecover}
        recoveryPending={recoveryPending}
        recoveryNotice={recoveryNotice}
        footer={footer}
      />
    </KartDriversContext.Provider>
  );
}
