// Validates the generated content outside Astro: every entry matches its
// schema, ids are unique, and every reference points at a real entry.
// Run with: npm run check:content   (also runs before every build)

import { readFileSync } from "node:fs";
import { generatedSchemas, references } from "../src/lib/schemas.ts";
import { buildNewsIndex, indexFile, serialize } from "./index-news.ts";

type Name = keyof typeof generatedSchemas;
const names = Object.keys(generatedSchemas) as Name[];
const errors: string[] = [];

const data = Object.fromEntries(
  names.map((name) => [name, JSON.parse(readFileSync(new URL(`../content/generated/${name}.json`, import.meta.url), "utf8")) as { id: string }[]])
) as Record<Name, { id: string }[]>;
const ids = Object.fromEntries(names.map((name) => [name, new Set(data[name].map((e) => e.id))])) as Record<Name, Set<string>>;

for (const name of names) {
  for (const entry of data[name]) {
    const result = generatedSchemas[name].safeParse(entry);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${name}/${entry.id}: ${issue.path.join(".")}: ${issue.message}`);
    }
    for (const [field, target] of Object.entries(references[name] ?? {})) {
      // Follow dotted paths like "related.programs"; a missing optional field has nothing to check
      const value = field.split(".").reduce<unknown>((obj, key) => (obj as Record<string, unknown> | undefined)?.[key], entry);
      for (const ref of [value ?? []].flat() as string[]) {
        if (!ids[target].has(ref)) errors.push(`${name}/${entry.id}: ${field} "${ref}" is not a ${target} id`);
      }
    }
  }
  if (ids[name].size !== data[name].length) errors.push(`${name}: duplicate ids`);
}

// The news index must match content/news/
if (readFileSync(indexFile, "utf8") !== serialize(buildNewsIndex())) {
  errors.push("news: content/generated/news.json is out of date with content/news/. Run npm run index:news.");
}

if (errors.length) {
  console.error(`Content check failed with ${errors.length} problem(s):\n${errors.slice(0, 50).join("\n")}`);
  process.exit(1);
}
console.log(`✓ content: ${names.map((n) => `${data[n].length} ${n}`).join(", ")}`);
