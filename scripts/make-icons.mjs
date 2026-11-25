// Draws the app icons from the same shapes as apps/web/public/favicon.svg.
// No dependencies: a tiny rasteriser and PNG writer. Run `npm run icons`.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const out = new URL("../apps/web/public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const ground = hex("#0f1226");
// The favicon, in its own 64-unit space. Later shapes paint over earlier ones.
const shapes = [
  {
    kind: "poly",
    colour: hex("#ff5a36"),
    points: [
      [10, 40],
      [54, 40],
      [50, 30],
      [22, 30],
      [16, 22],
      [10, 22],
    ],
  },
  { kind: "circle", colour: hex("#f4f1ff"), cx: 20, cy: 44, r: 6 },
  { kind: "circle", colour: hex("#f4f1ff"), cx: 46, cy: 44, r: 6 },
  { kind: "circle", colour: ground, cx: 20, cy: 44, r: 2.5 },
  { kind: "circle", colour: ground, cx: 46, cy: 44, r: 2.5 },
  { kind: "rrect", colour: hex("#3ee0d0"), x: 34, y: 18, w: 8, h: 12, r: 4 },
];

function insidePoly(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function insideRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function hit(shape, x, y) {
  if (shape.kind === "poly") return insidePoly(shape.points, x, y);
  if (shape.kind === "circle")
    return (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.r ** 2;
  return insideRoundRect(x, y, shape.x, shape.y, shape.w, shape.h, shape.r);
}

/**
 * `maskable` fills the whole square and shrinks the kart into the middle 70%,
 * so a launcher can cut any shape from it. Otherwise the tile has round corners.
 */
function draw(size, maskable) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.7 : 1;
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < samples; sy++)
        for (let sx = 0; sx < samples; sx++) {
          // Sample point in favicon units.
          const ux = ((px + (sx + 0.5) / samples) / size) * 64;
          const uy = ((py + (sy + 0.5) / samples) / size) * 64;
          const tile = maskable || insideRoundRect(ux, uy, 0, 0, 64, 64, 14);
          if (!tile) continue;
          const x = 32 + (ux - 32) / scale;
          const y = 32 + (uy - 32) / scale;
          let colour = ground;
          for (const shape of shapes) if (hit(shape, x, y)) colour = shape.colour;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      const n = samples * samples;
      const i = (py * size + px) * 4;
      // Straight alpha: average colour over the covered samples only.
      const covered = a / 255;
      pixels[i] = covered ? Math.round(r / covered) : 0;
      pixels[i + 1] = covered ? Math.round(g / covered) : 0;
      pixels[i + 2] = covered ? Math.round(b / covered) : 0;
      pixels[i + 3] = Math.round(a / n);
    }
  return pixels;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
]) {
  writeFileSync(new URL(name, out), png(size, draw(size, maskable)));
  console.log("wrote", name);
}
