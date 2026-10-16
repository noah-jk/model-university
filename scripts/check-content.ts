// Validates the generated content outside Astro: every entry matches its
// schema, ids are unique, and every reference points at a real entry.
// Run with: npm run check:content   (also runs before every build)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { calendarEntry, calendarTerms, officesFor, stepsFor } from "../src/lib/enrollment.ts";
import { calendarEntry as calendarEntrySchema, enrollmentStep, generatedSchemas, JOURNEY_STEPS, officeSet, references } from "../src/lib/schemas.ts";
import { STUDENT_TYPES } from "../src/lib/vocab.ts";
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

// Enrollment rules (content/enrollment/), edited by hand ---------------------------

const readEnrollment = (name: string) => JSON.parse(readFileSync(new URL(`../content/enrollment/${name}.json`, import.meta.url), "utf8")) as Record<string, unknown>[];
const enrollment = { calendar: readEnrollment("calendar"), steps: readEnrollment("steps"), offices: readEnrollment("offices") };
const schemas = { calendar: calendarEntrySchema, steps: enrollmentStep, offices: officeSet };
for (const [name, rows] of Object.entries(enrollment) as [keyof typeof schemas, Record<string, unknown>[]][]) {
  rows.forEach((row, i) => {
    const result = schemas[name].safeParse(row);
    if (!result.success) for (const issue of result.error.issues) errors.push(`enrollment/${name}[${row.id ?? i}]: ${issue.path.join(".")}: ${issue.message}`);
  });
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push(`enrollment/${name}: duplicate ids`);
}

// Site pages a link may point to: every static page under src/pages/
function sitePaths(dir = new URL("../src/pages/", import.meta.url), path = "/"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const child = new URL(name, dir);
    if (statSync(child).isDirectory()) return name.includes("[") ? [] : sitePaths(new URL(`${name}/`, dir), `${path}${name}/`);
    return name === "index.astro" ? [path] : [];
  });
}
const paths = new Set(sitePaths());
const checkLink = (where: string, url: unknown) => {
  if (typeof url === "string" && url.startsWith("/") && !paths.has(url)) errors.push(`${where}: url "${url}" isn't a page on this site`);
};
const checkService = (where: string, service: unknown) => {
  if (typeof service === "string" && !ids.services.has(service)) errors.push(`${where}: "${service}" is not a services id`);
};

const levelTypes = Object.entries(STUDENT_TYPES).flatMap(([level, types]) => types.map((type) => [level, type] as const));
const appliesToSomeone = (row: Record<string, unknown>) =>
  levelTypes.some(([level, type]) => (!row.levels || (row.levels as string[]).includes(level)) && (!row.student_types || (row.student_types as string[]).includes(type)));

for (const entry of enrollment.calendar) {
  const where = `enrollment/calendar/${entry.id}`;
  checkService(where, entry.service);
  checkLink(where, entry.url);
  if (!appliesToSomeone(entry)) errors.push(`${where}: applies to no student type and level`);
  // Application deadlines belong to each program, not the calendar
  if (String(entry.key).includes("application")) errors.push(`${where}: application deadlines belong on programs, not in the calendar`);
}
for (const step of enrollment.steps) {
  const where = `enrollment/steps/${step.id}`;
  checkService(where, step.office);
  checkLink(where, step.url);
  if (!appliesToSomeone(step)) errors.push(`${where}: applies to no student type and level`);
  // A calendar date must exist for every term the calendar covers
  const key = (step.due as { calendar?: string } | undefined)?.calendar;
  if (key) for (const term of calendarTerms) if (!calendarEntry(key, term)) errors.push(`${where}: no "${key}" calendar entry for ${term}`);
}
for (const set of enrollment.offices) (set.offices as { service: string }[]).forEach((o) => checkService(`enrollment/offices/${set.level}/${set.student_type}`, o.service));

for (const [level, type] of levelTypes) {
  const list = stepsFor(level, type);
  if (list.length < 5) errors.push(`enrollment: ${type} (${level}) has ${list.length} steps; every student needs at least 5`);
  if (officesFor(level, type).length < 2) errors.push(`enrollment: ${type} (${level}) has no offices`);
  // Prospective students start with the application journey, in order
  if (type !== "Current student") {
    const journey = list.slice(0, JOURNEY_STEPS.length).map((s) => s.journey);
    if (journey.join() !== JOURNEY_STEPS.join()) errors.push(`enrollment: ${type} (${level}) should start with the journey steps (${JOURNEY_STEPS.join(", ")}), not ${journey.join(", ")}`);
  }
}

if (errors.length) {
  console.error(`Content check failed with ${errors.length} problem(s):\n${errors.slice(0, 50).join("\n")}`);
  process.exit(1);
}
console.log(`✓ content: ${names.map((n) => `${data[n].length} ${n}`).join(", ")}`);
console.log(`✓ enrollment: ${enrollment.calendar.length} calendar dates for ${calendarTerms.length} terms, ${enrollment.steps.length} steps, ${enrollment.offices.length} office sets`);
