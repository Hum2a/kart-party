/**
 * Kart Party's soundtrack, written as data. Each theme is an original
 * eight-bar loop: a chord progression, a bass line, an arpeggio, a lead
 * melody and a drum pattern, all in scale degrees so a theme can change key
 * or mode in one place. `barEvents` turns a bar into timed notes; it is pure,
 * so the music can be tested without audio.
 */
export type ThemeId =
  | "menu"
  | "party-ring-v1"
  | "parkside-v1"
  | "harbour-v1"
  | "city-v1"
  | "summit-v1"
  | "beach-v1"
  | "podium";

const scales = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

export type Theme = {
  id: ThemeId;
  name: string;
  bpm: number;
  /** MIDI note of the key's root, around the bass register. */
  root: number;
  scale: keyof typeof scales;
  /** Chord root as a scale degree, one per bar. */
  progression: readonly number[];
  /** Eight eighth-note steps per bar: R root, 5 fifth, 8 octave, . rest. */
  bass: string;
  /** Sixteen sixteenth-note steps per bar: chord tone 0–3, or . for rest. */
  arp: string;
  /** One string per bar, eight eighth-note tokens: a scale degree, . rest, - hold. */
  lead: readonly string[];
  /** Sixteen steps each; x hits. */
  drums: { kick: string; snare: string; hat: string };
};

export const themes: Record<ThemeId, Theme> = {
  menu: {
    id: "menu",
    name: "Garage Groove",
    bpm: 108,
    root: 43,
    scale: "mixolydian",
    progression: [0, 6, 3, 0, 0, 6, 3, 4],
    bass: "R . . R 5 . R .",
    arp: "0 . 1 . 2 . 1 . 0 . 1 . 2 . 3 .",
    lead: [
      "4 . . 2 4 . 5 .",
      "6 . 5 . 4 . . .",
      "3 . . 2 3 . 4 .",
      "2 - - . . . . .",
      "4 . . 5 6 . 7 .",
      "8 . 7 . 6 . 4 .",
      "5 . 4 . 3 . 2 .",
      "0 - - . . . . .",
    ],
    drums: {
      kick: "x.......x.......",
      snare: "....x.......x...",
      hat: "..x...x...x...x.",
    },
  },
  "party-ring-v1": {
    id: "party-ring-v1",
    name: "Round and Round",
    bpm: 150,
    root: 48,
    scale: "major",
    progression: [0, 4, 5, 3, 0, 4, 3, 4],
    bass: "R . R . 5 . R 8",
    arp: "0 1 2 1 0 1 2 3 0 1 2 1 0 1 2 3",
    lead: [
      "4 . 4 5 4 2 0 .",
      "1 . 1 2 4 . . .",
      "5 . 5 4 2 . 4 .",
      "3 - 2 - 1 . . .",
      "4 . 4 5 7 . 6 5",
      "4 . 2 . 4 5 6 .",
      "5 4 3 2 3 . 1 .",
      "0 - - - . . 7 .",
    ],
    drums: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      hat: "x.x.x.x.x.x.x.x.",
    },
  },
  "parkside-v1": {
    id: "parkside-v1",
    name: "Sunday Sweepers",
    bpm: 136,
    root: 50,
    scale: "dorian",
    progression: [0, 3, 0, 3, 6, 5, 3, 4],
    bass: "R . 5 . R . 5 8",
    arp: "0 . 2 1 . 2 3 . 0 . 2 1 . 2 3 .",
    lead: [
      "0 . 2 3 4 . 2 .",
      "3 . . 2 3 4 5 .",
      "4 . 2 . 0 . 2 3",
      "4 - - . . . . .",
      "6 . 5 . 4 . 5 6",
      "7 . 6 5 4 . 2 .",
      "3 . 4 . 5 . 4 3",
      "2 - - . 1 . 0 .",
    ],
    drums: {
      kick: "x.....x.x.......",
      snare: "....x.......x..x",
      hat: "x.xxx.xxx.xxx.xx",
    },
  },
  "harbour-v1": {
    id: "harbour-v1",
    name: "Dockside Dash",
    bpm: 160,
    root: 45,
    scale: "minor",
    progression: [0, 5, 2, 6, 0, 5, 3, 4],
    bass: "R R . R 5 . R 8",
    arp: "0 2 1 2 0 2 1 3 0 2 1 2 0 2 3 2",
    lead: [
      "0 . 0 2 3 . 4 .",
      "5 . 4 3 2 . 0 .",
      "2 . 2 3 4 . 6 .",
      "7 - 6 - 4 . . .",
      "7 . 7 6 4 . 3 4",
      "5 . 4 3 2 . 3 .",
      "4 3 2 1 2 . -1 .",
      "0 - - - . . . .",
    ],
    drums: {
      kick: "x..x..x.x..x..x.",
      snare: "....x.......x...",
      hat: "xxxxxxxxxxxxxxxx",
    },
  },
  "city-v1": {
    id: "city-v1",
    name: "Neon Grid",
    bpm: 152,
    root: 43,
    scale: "dorian",
    progression: [0, 0, 6, 3, 0, 0, 5, 4],
    bass: "R R 8 R . R 5 8",
    arp: "0 2 3 2 1 2 3 2 0 2 3 2 1 3 2 1",
    lead: [
      "0 . 2 3 . 4 . 2",
      "4 - 3 . 2 . 0 .",
      "6 . 6 5 4 . 3 .",
      "4 - - . . 2 3 4",
      "7 . 6 . 4 . 6 7",
      "8 - 7 . 6 4 . .",
      "5 . 4 3 2 . 3 4",
      "0 - - - . . . .",
    ],
    drums: {
      kick: "x...x...x...x.x.",
      snare: "....x.......x...",
      hat: ".x.x.x.x.x.x.xxx",
    },
  },
  "summit-v1": {
    id: "summit-v1",
    name: "Thin Air",
    bpm: 142,
    root: 45,
    scale: "mixolydian",
    progression: [0, 6, 3, 0, 0, 6, 4, 4],
    bass: "R . R 5 . 5 R .",
    arp: "0 1 2 3 2 1 0 1 0 1 2 3 2 1 2 3",
    lead: [
      "4 . . 3 4 . 6 .",
      "7 - 6 . 4 . . .",
      "3 . 3 4 6 . 4 3",
      "4 - - - . . 2 3",
      "4 . . 3 4 . 7 .",
      "9 - 8 . 7 . 6 .",
      "4 . 6 . 7 . 8 .",
      "7 - - - . . . .",
    ],
    drums: {
      kick: "x.....x...x.....",
      snare: "....x.......x.x.",
      hat: "x.xxx.xxx.xxx.xx",
    },
  },
  "beach-v1": {
    id: "beach-v1",
    name: "Boardwalk Breeze",
    bpm: 128,
    root: 50,
    scale: "major",
    progression: [0, 5, 3, 4, 0, 5, 1, 4],
    bass: "R . . R 5 . R .",
    arp: "0 . 1 2 . 1 2 3 0 . 1 2 . 3 2 1",
    lead: [
      "2 . 4 . 4 5 4 .",
      "2 . 0 . -1 . 0 .",
      "3 . 5 . 5 6 5 .",
      "4 - - . . . . .",
      "7 . 6 . 4 . 2 .",
      "5 . 4 . 2 . 0 .",
      "1 . 2 . 3 . 4 .",
      "0 - - - . . . .",
    ],
    drums: {
      kick: "x.....x...x.....",
      snare: "....x.......x...",
      hat: "x.x.x.xxx.x.x.xx",
    },
  },
  podium: {
    id: "podium",
    name: "Top Step",
    bpm: 120,
    root: 48,
    scale: "major",
    progression: [0, 3, 4, 0],
    bass: "R . 5 . R . 5 .",
    arp: "0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 .",
    lead: ["0 2 4 7 . 4 7 .", "5 . 4 . 3 . 2 .", "4 . 5 . 6 . 4 .", "7 - - - . . . ."],
    drums: {
      kick: "x.......x.......",
      snare: "....x.......x...",
      hat: "x.x.x.x.x.x.x.x.",
    },
  },
};

export type Voice = "lead" | "bass" | "arp" | "kick" | "snare" | "hat";
/** One note: start and length in beats from the bar's start, and a MIDI pitch for pitched voices. */
export type MusicNote = { voice: Voice; beat: number; beats: number; midi?: number };

const tokens = (pattern: string) => pattern.trim().split(/\s+/);

/** A scale degree (any octave, negative allowed) as a MIDI note above `base`. */
export function degreeMidi(theme: Pick<Theme, "scale">, base: number, degree: number) {
  const steps = scales[theme.scale];
  const octave = Math.floor(degree / steps.length);
  const index = ((degree % steps.length) + steps.length) % steps.length;
  return base + octave * 12 + steps[index]!;
}

export const barSeconds = (theme: Pick<Theme, "bpm">, tempo = 1) =>
  (4 * 60) / (theme.bpm * tempo);

/** Every note in one bar of a theme. Bars loop over the progression and lead. */
export function barEvents(theme: Theme, bar: number): MusicNote[] {
  const notes: MusicNote[] = [];
  const chord = theme.progression[bar % theme.progression.length]!;
  const chordTones = [0, 2, 4, 7].map((step) =>
    degreeMidi(theme, theme.root + 12, chord + step),
  );
  const chordRoot = degreeMidi(theme, theme.root, chord);
  tokens(theme.bass).forEach((token, step) => {
    if (token === ".") return;
    const midi =
      token === "5"
        ? degreeMidi(theme, theme.root, chord + 4)
        : token === "8"
          ? chordRoot + 12
          : chordRoot;
    notes.push({ voice: "bass", beat: step / 2, beats: 0.45, midi });
  });
  tokens(theme.arp).forEach((token, step) => {
    if (token === ".") return;
    notes.push({
      voice: "arp",
      beat: step / 4,
      beats: 0.2,
      midi: chordTones[Number(token)]! + 12,
    });
  });
  const lead = tokens(theme.lead[bar % theme.lead.length]!);
  lead.forEach((token, step) => {
    if (token === "." || token === "-") return;
    let length = 1;
    while (lead[step + length] === "-") length++;
    notes.push({
      voice: "lead",
      beat: step / 2,
      beats: length / 2 - 0.05,
      midi: degreeMidi(theme, theme.root + 24, Number(token)),
    });
  });
  for (const voice of ["kick", "snare", "hat"] as const)
    [...theme.drums[voice]].forEach((hit, step) => {
      if (hit === "x") notes.push({ voice, beat: step / 4, beats: 0.1 });
    });
  return notes;
}

export const raceTheme = (trackId: string): ThemeId =>
  trackId in themes ? (trackId as ThemeId) : "party-ring-v1";
