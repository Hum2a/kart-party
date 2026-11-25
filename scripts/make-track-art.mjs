// Draws docs/assets/tracks.svg from the real course geometry, so the README
// shows every track exactly as the game builds it. Run `npm run track-art`.
import { writeFileSync } from "node:fs";
import { kartTrackCatalogue, polylineTrack } from "../packages/game/src/index.ts";

const out = new URL("../docs/assets/tracks.svg", import.meta.url);
const font = "'Avenir Next', 'Segoe UI', system-ui, sans-serif";
const heavy = "'Arial Black', 'Segoe UI Black', system-ui, sans-serif";
const pills = {
  easy: { fill: "#133330", ink: "#3ee0d0", width: 66 },
  medium: { fill: "#2b2416", ink: "#f6c15c", width: 82 },
  hard: { fill: "#361816", ink: "#ff5a36", width: 66 },
};
const n = (value) => value.toFixed(2);

/** The same ±45 box the in-game map uses. */
function frame(course) {
  const points = course.ribbon.flatMap((edge) => [edge.left, edge.right]);
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const scale =
    90 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  return ([x, z]) => `${n((x - cx) * scale)} ${n((z - cz) * scale)}`;
}

function map(track) {
  const course = polylineTrack(track.id);
  if (!course)
    return `<circle r="47" fill="none" stroke="#ff5a36" stroke-width="1.3"/>
      <circle r="42" fill="none" stroke="#242a52" stroke-width="9"/>
      <circle r="42" fill="none" stroke="#343b6e" stroke-dasharray="2 3" stroke-width="0.7"/>
      <circle r="37" fill="none" stroke="#ff5a36" stroke-width="1.3"/>
      <circle cx="42" cy="0" r="2.8" fill="#3ee0d0"/>`;
  const at = frame(course);
  const loop = (side) => `M${course.ribbon.map((edge) => at(edge[side])).join("L")}Z`;
  const branches = course.branches
    .map((branch) => {
      const outline = [
        ...branch.ribbon.map((edge) => edge.left),
        ...branch.ribbon.map((edge) => edge.right).reverse(),
      ];
      const shortcut = branch.kind === "shortcut";
      return `<path d="M${outline.map(at).join("L")}Z" fill="${shortcut ? "#3a3f63" : "#242a52"}" stroke="${shortcut ? "#3ee0d0" : "#ff5a36"}" stroke-width="1"${shortcut ? ' stroke-dasharray="2.4 1.6"' : ""}/>`;
    })
    .join("\n      ");
  return `${branches}
      <path d="${loop("left")} ${loop("right")}" fill="#242a52" fill-rule="evenodd" stroke="#ff5a36" stroke-width="1.2"/>
      <path d="M${course.route.points.map(at).join("L")}" fill="none" stroke="#343b6e" stroke-dasharray="2 3" stroke-width="0.65"/>
      <circle cx="${at(course.route.points[0]).split(" ")[0]}" cy="${at(course.route.points[0]).split(" ")[1]}" r="2.8" fill="#3ee0d0"/>`;
}

/** Splits a blurb into two lines of roughly equal length. */
function lines(text) {
  const words = text.split(" ");
  let best = [text, ""],
    gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "),
      b = words.slice(i).join(" ");
    if (Math.abs(a.length - b.length) < gap) {
      gap = Math.abs(a.length - b.length);
      best = [a, b];
    }
  }
  return best;
}

function features(track) {
  const f = track.features;
  const part = (count, one, many) =>
    count ? [`${count} ${count === 1 ? one : many}`] : [];
  return [
    ...part(f.boosts, "boost", "boosts"),
    ...part(f.ramps, "ramp", "ramps"),
    ...part(f.hazards, "hazard", "hazards"),
    ...(f.shortcuts ? ["shortcut"] : []),
    ...(f.alternates ? ["alt. route"] : []),
    ...(f.bridges ? ["bridge"] : []),
  ].join(" · ");
}

const card = (track, i) => {
  const x = (i % 3) * 409,
    y = Math.floor(i / 3) * 402;
  const pill = pills[track.difficulty];
  const [first, second] = lines(track.blurb);
  return `  <!-- ${track.name} -->
  <g transform="translate(${x}, ${y})">
    <rect x="1" y="1" width="382" height="388" rx="20" fill="url(#card-bg)" stroke="#343b6e" stroke-width="2"/>
    <rect x="24" y="24" width="${pill.width}" height="24" rx="12" fill="${pill.fill}" stroke="${pill.ink}" stroke-width="1"/>
    <text x="${24 + pill.width / 2}" y="40" text-anchor="middle" font-family="${font}" font-size="11" font-weight="800" fill="${pill.ink}" letter-spacing="0.8">${track.difficulty.toUpperCase()}</text>
    <text x="358" y="40" text-anchor="end" font-family="${font}" font-size="12" font-weight="600" fill="#a3a8cf">~${Math.round(track.route.metres)} m · ${track.route.segments} segs</text>
    <g transform="translate(191, 152) scale(1.75)">
      ${map(track)}
    </g>
    <text x="24" y="280" font-family="${heavy}" font-size="22" font-weight="900" fill="#f4f1ff">${track.name}</text>
    <text x="24" y="304" font-family="${font}" font-size="13.5" fill="#a3a8cf">${first}</text>
    <text x="24" y="323" font-family="${font}" font-size="13.5" fill="#a3a8cf">${second}</text>
    <line x1="24" y1="344" x2="358" y2="344" stroke="#343b6e" stroke-width="1"/>
    <text x="24" y="366" font-family="${font}" font-size="12.5" font-weight="600" fill="#3ee0d0">${track.itemBoxes} item boxes</text>
    <text x="358" y="366" text-anchor="end" font-family="${font}" font-size="12" fill="#a3a8cf">${features(track)}</text>
  </g>`;
};

const rows = Math.ceil(kartTrackCatalogue.length / 3);
const height = rows * 402 - 12;
const names = kartTrackCatalogue.map((t) => t.name).join(", ");
writeFileSync(
  out,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${height}" width="1200" height="${height}" role="img" aria-label="Kart Party tracks: ${names}">
  <defs>
    <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1f3d"/>
      <stop offset="100%" stop-color="#12162e"/>
    </linearGradient>
  </defs>
${kartTrackCatalogue.map(card).join("\n")}
</svg>
`,
);
console.log("wrote docs/assets/tracks.svg");
