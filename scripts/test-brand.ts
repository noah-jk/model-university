// Tests for the brand foundations (#72): every text and surface pair the site
// uses has enough contrast in both themes, and the fonts and textures the
// browser downloads stay within budget. Run with: npm test

import { readFileSync, statSync } from "node:fs";
import { contrast, PAIRS, readTokens } from "../src/lib/brand.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

const css = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const { light, dark } = readTokens(css);
check(light.fir === "#296258" && light.sun === "#fdc300" && light.lichen === "#c9d5cc" && light.fog === "#f2f3ed", "tokens: the brand palette is in global.css");
check(dark.fog !== light.fog && dark.fir !== light.fir && dark.sun === light.sun, "tokens: dark mode redefines the ground and the green, and keeps the yellow");

for (const [theme, tokens] of [["light", light], ["dark", dark]] as const) {
  const failing = PAIRS.filter((p) => !tokens[p.fg] || !tokens[p.bg] || contrast(tokens[p.fg], tokens[p.bg]) < p.min);
  check(!failing.length, `contrast, ${theme}: all ${PAIRS.length} pairs pass${failing.length ? `; failing: ${failing.map((p) => `${p.fg} on ${p.bg} (${contrast(tokens[p.fg], tokens[p.bg]).toFixed(2)})`).join(", ")}` : ""}`);
}
check(contrast(light.sun, light.fog) < 3, "yellow is a fill only: it's too light for text or lines on the page, so nothing uses it that way");

// Files the browser downloads, with their budgets in KB
const BUDGETS: [string, number][] = [
  ["public/fonts/roboto-latin-wght.woff2", 60],
  ["public/fonts/roboto-condensed-latin-wght.woff2", 60],
  ["public/fonts/young-serif-latin.woff2", 40],
  ["public/textures/topo.svg", 40],
  ["public/textures/foliage.png", 100],
  ["public/textures/dots.webp", 50],
];
for (const [file, kb] of BUDGETS) {
  const size = statSync(new URL(`../${file}`, import.meta.url)).size;
  check(size <= kb * 1024, `${file.split("/").pop()}: ${(size / 1024).toFixed(0)} KB, under the ${kb} KB budget`);
}
for (const [file] of BUDGETS) check(css.includes(`/${file.replace("public/", "")}`), `global.css uses ${file.replace("public/", "/")}`);

console.log("\nBrand checks passed.");
