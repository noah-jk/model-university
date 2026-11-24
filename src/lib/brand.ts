// The brand's color tokens, read from src/styles/global.css (the one place
// they're defined), and the contrast of the pairs the site uses. The brand
// page (/lab/brand/) shows them; scripts/test-brand.ts checks every pair in
// both themes. No DOM code.

export type Tokens = Record<string, string>;

// The custom properties with hex values in the bare :root block (light) and
// in the dark-mode block, which only redefines some of them
export function readTokens(css: string): { light: Tokens; dark: Tokens } {
  const block = (start: number) => {
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
    }
    return "";
  };
  const tokens = (text: string): Tokens => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(([, name, value]) => [name, value.toLowerCase()]));
  const light = tokens(block(css.search(/^:root\s*\{/m)));
  const darkAt = css.indexOf("@media (prefers-color-scheme: dark)");
  const dark = { ...light, ...tokens(block(darkAt)) };
  return { light, dark };
}

const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Text and the surfaces it sits on, and the minimum each needs: 4.5 for text,
// 3 for focus rings and large type
export const PAIRS: { fg: string; bg: string; min: number; use: string }[] = [
  { fg: "basalt", bg: "fog", min: 4.5, use: "Body text on the page" },
  { fg: "basalt", bg: "paper", min: 4.5, use: "Body text on cards" },
  { fg: "basalt", bg: "lichen", min: 4.5, use: "Body text on sage" },
  { fg: "muted", bg: "fog", min: 4.5, use: "Secondary text on the page" },
  { fg: "muted", bg: "paper", min: 4.5, use: "Secondary text on cards" },
  { fg: "muted", bg: "lichen", min: 4.5, use: "Secondary text on sage" },
  { fg: "fir", bg: "fog", min: 4.5, use: "Links and headings on the page" },
  { fg: "fir", bg: "paper", min: 4.5, use: "Links and headings on cards" },
  { fg: "fir", bg: "lichen", min: 4.5, use: "Headings on sage" },
  { fg: "fir", bg: "mist", min: 4.5, use: "Outline button on hover" },
  { fg: "fog", bg: "fir", min: 4.5, use: "Green button text" },
  { fg: "on-dark", bg: "fir-deep", min: 4.5, use: "Text on dark panels and the header" },
  { fg: "on-dark", bg: "forest", min: 4.5, use: "Text on green callouts and boxed headlines" },
  { fg: "on-sun", bg: "sun", min: 4.5, use: "Primary (yellow) button text" },
  { fg: "on-sun", bg: "sun-deep", min: 4.5, use: "Primary button on hover" },
  { fg: "salmonberry", bg: "paper", min: 4.5, use: "Error messages on cards" },
  { fg: "salmonberry", bg: "fog", min: 4.5, use: "Error messages on the page" },
  { fg: "focus", bg: "fog", min: 3, use: "Focus ring on the page" },
  { fg: "focus", bg: "paper", min: 3, use: "Focus ring on cards" },
];
