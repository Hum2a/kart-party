import type { RoomSettings } from "@kart-party/game";
import { Segmented } from "../ui/primitives";

/** The race rules shared by practice and online rooms, apart from the track. */
export type RaceRules = Pick<RoomSettings, "laps" | "cpu" | "cpuLevel" | "items">;

const itemNotes = {
  off: "No item boxes",
  classic: "Turbo, Bubble shield, Oil slick",
  all: "All seven, catch-up luck",
} as const;

export function RaceOptions({
  value,
  onChange,
  timeTrialLabel = false,
}: {
  value: RaceRules;
  onChange: (next: RaceRules) => void;
  /** Practice calls zero CPU racers a time trial. */
  timeTrialLabel?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Segmented
        label="Laps"
        value={value.laps}
        onChange={(laps) => onChange({ ...value, laps })}
        options={[
          { value: 1, label: "1" },
          { value: 2, label: "2" },
          { value: 3, label: "3" },
        ]}
      />
      <Segmented
        label="CPU racers"
        value={value.cpu}
        onChange={(cpu) => onChange({ ...value, cpu })}
        options={[0, 1, 3, 5, 7].map((n) => ({
          value: n,
          label: n === 0 && timeTrialLabel ? "Time trial" : String(n),
        }))}
      />
      <Segmented
        label="CPU difficulty"
        value={value.cpuLevel}
        disabled={value.cpu === 0}
        onChange={(cpuLevel) => onChange({ ...value, cpuLevel })}
        options={[
          { value: "easy", label: "Easy" },
          { value: "normal", label: "Normal" },
          { value: "hard", label: "Hard" },
        ]}
      />
      <div className="grid gap-1.5">
        <Segmented
          label="Items"
          value={value.items}
          onChange={(items) => onChange({ ...value, items })}
          options={[
            { value: "off", label: "Off" },
            { value: "classic", label: "Classic" },
            { value: "all", label: "All" },
          ]}
        />
        <p className="text-sm text-muted" aria-live="polite">
          {itemNotes[value.items]}
        </p>
      </div>
    </div>
  );
}
