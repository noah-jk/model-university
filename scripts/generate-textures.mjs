// Brand textures (#72), written to public/textures/ as masks: the shapes are
// opaque, everything else transparent, so CSS can paint them in any color and
// they follow the theme (see .texture-* in src/styles/global.css).
//
// - topo.svg: topographic contours, generated. The height field is a sum of
//   waves with whole-number frequencies across the tile, so it repeats
//   seamlessly. Every third contour is a solid line; the rest are dotted.
// - foliage.png and dots.webp: from the source images in
//   src/assets/textures/ (a halftone of a Pexels photo, and an uneven dot
//   field), with their dark parts turned into opacity.
//
// Deterministic: the same seed always gives the same files.
// Run with: npm run textures

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/textures");
const sources = join(root, "src/assets/textures");
mkdirSync(out, { recursive: true });

// Topographic contours -------------------------------------------------------

const TILE = 720; // px; the pattern repeats every TILE in both directions
const CELLS = 180; // grid for tracing contours (4px cells)
const LEVELS = 11;

// Small seeded random numbers (mulberry32), like generate-data.mjs
function random(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = random(20261124);

// Broad hills and ridges, then smaller ripples. Whole-number frequencies keep it seamless.
const waves = [];
for (const [count, low, high, amplitude] of [[4, 1, 2, 1], [4, 2, 3, 0.32], [3, 3, 4, 0.08]]) {
  for (let i = 0; i < count; i++) {
    const pick = () => Math.round(low + rand() * (high - low)) * (rand() < 0.5 ? -1 : 1);
    let m = pick(), n = pick();
    if (rand() < 0.3) m = 0; else if (rand() < 0.3) n = 0;
    if (!m && !n) m = low;
    waves.push({ m, n, a: amplitude * (0.6 + rand() * 0.8), phase: rand() * Math.PI * 2 });
  }
}
const height = (x, y) => waves.reduce((sum, w) => sum + w.a * Math.sin((2 * Math.PI * (w.m * x + w.n * y)) / TILE + w.phase), 0);

const step = TILE / CELLS;
const grid = [];
for (let j = 0; j <= CELLS; j++) {
  grid.push([]);
  for (let i = 0; i <= CELLS; i++) grid[j].push(height(i * step, j * step));
}
const values = grid.flat();
const [lo, hi] = [Math.min(...values), Math.max(...values)];

// Marching squares: the segments where the field crosses one level
function segmentsAt(level) {
  const segments = [];
  const lerp = (a, b, va, vb) => a + ((level - va) / (vb - va)) * (b - a);
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const [a, b, c, d] = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]; // corners, clockwise from top left
      const x = i * step, y = j * step;
      const top = [lerp(x, x + step, a, b), y];
      const right = [x + step, lerp(y, y + step, b, c)];
      const bottom = [lerp(x, x + step, d, c), y + step];
      const left = [x, lerp(y, y + step, a, d)];
      const index = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      const cases = {
        1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
        5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
        9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
        13: [[bottom, right]], 14: [[left, bottom]],
      };
      for (const segment of cases[index] ?? []) segments.push(segment);
    }
  }
  return segments;
}

// Join segments that share an end into longer lines, so dots run evenly along them
function polylines(segments) {
  const key = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
  const ends = new Map();
  segments.forEach((s, n) => {
    for (const p of s) (ends.get(key(p)) ?? ends.set(key(p), []).get(key(p))).push(n);
  });
  const used = new Set();
  const lines = [];
  for (let n = 0; n < segments.length; n++) {
    if (used.has(n)) continue;
    used.add(n);
    const line = [...segments[n]];
    for (const atStart of [false, true]) {
      for (;;) {
        const tip = atStart ? line[0] : line.at(-1);
        const next = (ends.get(key(tip)) ?? []).find((m) => !used.has(m));
        if (next === undefined) break;
        used.add(next);
        const [p, q] = segments[next];
        const far = key(p) === key(tip) ? q : p;
        atStart ? line.unshift(far) : line.push(far);
      }
    }
    lines.push(line);
  }
  return lines;
}

// Fewer points, same shape (Ramer–Douglas–Peucker)
function simplify(points, tolerance = 0.5) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  let worst = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const distance = Math.abs((b[1] - a[1]) * x - (b[0] - a[0]) * y + b[0] * a[1] - b[1] * a[0]) / length;
    if (distance > worst) [worst, at] = [distance, i];
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

// A smooth path: curves through the midpoints, with each point as the control
const f = (n) => Math.round(n * 10) / 10;
function smoothPath(points) {
  if (points.length < 3) return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = points.at(-1);
  return `${d}L${f(lx)} ${f(ly)}`;
}

const solid = [];
const dotted = [];
for (let k = 1; k < LEVELS; k++) {
  const level = lo + ((hi - lo) * k) / LEVELS;
  const paths = polylines(segmentsAt(level)).filter((l) => l.length > 3).map((l) => smoothPath(simplify(l)));
  (k % 3 === 0 ? solid : dotted).push(...paths);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="1.1" d="${solid.join("")}"/><path stroke-width="1.8" stroke-dasharray="0 5.5" d="${dotted.join("")}"/></svg>\n`;
writeFileSync(join(out, "topo.svg"), svg);

// Image masks ------------------------------------------------------------------

// Dark parts of a source image become opaque, light parts transparent. `low`
// and `high` are the grey levels that map to fully opaque and fully clear.
// Halftone dots survive four levels of opacity, which a palette PNG stores far
// smaller than WebP does; the softer dot field stays WebP.
async function maskFrom(source, target, { low, high, width }) {
  // The dot field's own transparency is a flat wash; its dots are in the colors, so it's dropped
  const grey = sharp(join(sources, source)).removeAlpha().resize({ width, withoutEnlargement: true }).greyscale();
  const { data, info } = await grey.raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(Math.min(1, Math.max(0, (high - data[i * info.channels]) / (high - low))) * 255);
  const image = sharp({ create: { width: info.width, height: info.height, channels: 3, background: "#000000" } }).joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } });
  await (target.endsWith(".png") ? image.png({ palette: true, colours: 4, compressionLevel: 9, effort: 10 }) : image.webp({ quality: 70, alphaQuality: 60, effort: 6 })).toFile(join(out, target));
}

await maskFrom("foliage-halftone.webp", "foliage.png", { low: 40, high: 175, width: 600 });
await maskFrom("uneven-dots.png", "dots.webp", { low: 0, high: 250, width: 633 });

console.log(`Wrote topo.svg (${solid.length} solid and ${dotted.length} dotted contours), foliage.png, and dots.webp to public/textures/.`);
