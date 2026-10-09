// Builds content/generated/news.json, an index of the stories in
// content/news/, for the MCP server (a Netlify Function can't read the
// Markdown collection). `npm run build` runs this first, and
// scripts/check-content.ts fails if the committed index is out of date.
// Run with: npm run index:news

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { newsIndexEntry, type NewsIndexEntry } from "../src/lib/schemas.ts";

const newsDir = new URL("../content/news/", import.meta.url);
export const indexFile = new URL("../content/generated/news.json", import.meta.url);

export function buildNewsIndex(): NewsIndexEntry[] {
  const entries = readdirSync(newsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const text = readFileSync(new URL(file, newsDir), "utf8");
      const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
      if (!frontmatter) throw new Error(`${file}: no frontmatter`);
      const data = parse(frontmatter, { schema: "core" });
      // YAML reads 2026-09-28 as a date; the index stores it as text
      const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
      return newsIndexEntry.parse({ id: file.replace(/\.md$/, ""), ...data, date, related: data.related ?? {} });
    });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export const serialize = (entries: NewsIndexEntry[]) => JSON.stringify(entries, null, 2) + "\n";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = buildNewsIndex();
  writeFileSync(indexFile, serialize(entries));
  console.log(`Wrote ${entries.length} news stories to content/generated/news.json.`);
}
