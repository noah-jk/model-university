// A search "plan" is a short list of catalog searches, like
//   search_programs({ query: "health", level: "Master's", modality: "Online" })
// The model writes one from the visitor's words; without it, keywordPlan()
// does a simpler job with patterns. Either way the plan runs here, against the
// shared tools in src/lib/tools.ts, and its filters become the chips people
// can remove.

import { z } from "zod";
import { usd } from "../format.ts";
import { toolNamed } from "../tools.ts";
import { STOP_WORDS, straightQuotes } from "../words.ts";
import { hoursAnswer, resultFor } from "./results.ts";
import type { Chip, Kind, PlannedCall, SearchResponse, SearchResult } from "./types.ts";

// The tools search may use, and the kind of result each returns
export const SEARCH_TOOLS: Record<string, Kind> = {
  search_programs: "program",
  get_program: "program",
  search_courses: "course",
  get_course: "course",
  find_services: "service",
  get_service: "service",
  services_open_now: "service",
  search_faculty: "faculty",
  get_faculty: "faculty",
  search_events: "event",
  list_news: "news",
};

// The model may plan up to 4 searches; a plan sent back to remove a chip may
// also be a keyword plan, which searches all six kinds.
export const MAX_CALLS = 4;
export const MAX_RETURNED_CALLS = 6;
// Results per search, and per group on the page
const PER_CALL = 8;
const PER_GROUP = 10;

// Keep only calls to search tools whose arguments fit the tool's schema, at
// most `max`. Anything else the model (or a request) sends is dropped.
export function validatePlan(plan: unknown, max = MAX_CALLS): PlannedCall[] {
  if (!Array.isArray(plan)) return [];
  const valid: PlannedCall[] = [];
  for (const call of plan) {
    const tool = typeof call?.tool === "string" && call.tool in SEARCH_TOOLS ? toolNamed(call.tool) : undefined;
    if (!tool) continue;
    const parsed = z.object(tool.input).safeParse(call.args ?? {});
    if (parsed.success) valid.push({ tool: tool.name, args: parsed.data });
  }
  return valid.slice(0, max);
}

// Arguments that pick a record or tune a search rather than filter it
const NOT_FILTERS = new Set(["id", "code", "at", "limit", "upcoming"]);
const isFilter = ([arg, value]: [string, unknown]) => !NOT_FILTERS.has(arg) && value !== undefined && value !== "";
const isLookup = (tool: string) => tool.startsWith("get_") || tool === "services_open_now";

const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function chipLabel(arg: string, value: unknown) {
  const v = String(value);
  switch (arg) {
    case "query": return `“${v}”`;
    case "start_term": return `Starts ${v.toLowerCase()}`;
    case "term": return `Offered ${v.toLowerCase()}`;
    case "max_total_tuition_usd": return `Under ${usd(Number(value))}`;
    case "college": return `College: ${v}`;
    case "audience": return `For ${v.toLowerCase()}`;
    case "from": return `From ${shortDate(v)}`;
    case "to": return `Through ${shortDate(v)}`;
    case "tag": return `Tagged “${v}”`;
    default: return v;
  }
}

const chipKey = (arg: string, value: unknown) => `${arg}:${String(value)}`;

// One chip per distinct filter across all calls
export function chipsFor(plan: PlannedCall[]): Chip[] {
  const chips = new Map<string, Chip>();
  for (const { args } of plan) {
    for (const [arg, value] of Object.entries(args).filter(isFilter)) {
      chips.set(chipKey(arg, value), { key: chipKey(arg, value), label: chipLabel(arg, value) });
    }
  }
  return [...chips.values()];
}

// Remove dropped filters. A search left with no filters at all would just
// list everything, so it's left out; lookups by id stay.
export function applyDrops(plan: PlannedCall[], drop: string[]): PlannedCall[] {
  if (!drop.length) return plan;
  return plan
    .map(({ tool, args }) => {
      const kept = Object.entries(args).filter(([arg, value]) => !drop.includes(chipKey(arg, value)));
      return { tool, args: Object.fromEntries(kept), dropped: kept.length < Object.keys(args).length };
    })
    .filter(({ tool, args, dropped }) => !dropped || isLookup(tool) || Object.entries(args).some(isFilter))
    .map(({ tool, args }) => ({ tool, args }));
}

// The ids in a tool's output: a list of results, open services, or one record
function idsFrom(output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const o = output as { results?: { id?: string }[]; open?: { id?: string }[]; id?: string };
  const list = o.results ?? o.open ?? [o];
  return list.map((r) => r.id).filter((id): id is string => typeof id === "string");
}

// Run every call, then build results from the catalog records they found,
// without duplicates, at most PER_GROUP of each kind.
export function runPlan(plan: PlannedCall[], base: string, now = new Date()): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const perKind = new Map<Kind, number>();
  for (const { tool: name, args } of plan) {
    const tool = toolNamed(name)!;
    const kind = SEARCH_TOOLS[name];
    const limited = "limit" in tool.input && args.limit === undefined ? { ...args, limit: PER_CALL } : args;
    for (const ref of idsFrom(tool.run(limited, base)).slice(0, PER_CALL)) {
      const result = resultFor(kind, ref, base, now);
      const count = perKind.get(kind) ?? 0;
      if (!result || seen.has(`${kind}:${ref}`) || count >= PER_GROUP) continue;
      seen.add(`${kind}:${ref}`);
      perKind.set(kind, count + 1);
      results.push(result);
    }
  }
  return results;
}

// A short answer, only for questions the data answers directly. Today that's
// "is this service open?", which the model asks with get_service.
export function answerFor(plan: PlannedCall[], base: string, now = new Date()): SearchResponse["answer"] {
  const lookup = plan.find((c) => c.tool === "get_service");
  return lookup ? hoursAnswer(String(lookup.args.id), base, now) : undefined;
}

// Keyword search, for when the model isn't available. Picks out the common
// program filters (level, format, start term, budget), drops filler words,
// and searches everything else for the words that are left.
const PATTERNS: [RegExp, string, unknown][] = [
  [/\b(master'?s|masters|mba|msn|graduate degrees?)\b/, "level", "Master's"],
  [/\b(bachelor'?s|bachelors|undergrad(uate)?( degrees?)?)\b/, "level", "Bachelor's"],
  [/\b(ph\.?d\.?|doctorate|doctoral)\b/, "level", "Doctorate"],
  [/\bcertificates?\b/, "level", "Certificate"],
  [/\bminors?\b/, "level", "Minor"],
  [/\bonline\b/, "modality", "Online"],
  [/\bhybrid\b/, "modality", "Hybrid"],
  [/\bin[- ]person\b/, "modality", "In person"],
  [/\b(fall|autumn)\b/, "start_term", "Fall"],
  [/\bwinter\b/, "start_term", "Winter"],
  [/\bspring\b/, "start_term", "Spring"],
  [/\bsummer\b/, "start_term", "Summer"],
];
const BUDGET = /\b(?:under|below|less than|up to|max(?:imum)?|cheaper than)\s*\$?\s*(\d[\d,]*)\s*(k\b)?/;
// Words that say what kind of thing someone wants, e.g. "who teaches" → faculty.
// Most are removed from the words searched for; event types like "tours" stay,
// because they're also what the event is called.
const KIND_WORDS: [RegExp, string, "remove" | "keep"][] = [
  [/\b(who teaches|who studies|professors?|faculty|instructors?|experts?)\b/, "search_faculty", "remove"],
  [/\b(courses?|class(es)?)\b/, "search_courses", "remove"],
  [/\b(upcoming )?events?\b/, "search_events", "remove"],
  [/\b(tours?|open house|workshops?|lectures?|concerts?)\b/, "search_events", "keep"],
  [/\b(news|stories|story)\b/, "list_news", "remove"],
  [/\b(programs?|degrees?|majors?)\b/, "search_programs", "remove"],
  [/\b(services?|offices?|resources?|support for)\b/, "find_services", "remove"],
];
const ALL_KINDS = ["search_programs", "search_courses", "search_faculty", "find_services", "search_events", "list_news"];
// "is the writing center open?", "when does the library open"
const OPEN_QUESTION = /\bopen\b/;
// Filler beyond the catalog's stop words (src/lib/words.ts)
const FILLER = new Set([
  ...STOP_WORDS,
  ..."as cascadia state university near need now open please list right start starts starting today next this week month want".split(" "),
]);

// With `filters: false`, words like "undergrad" or "online" are left out
// instead of becoming program filters, so the rest is searched everywhere
export function keywordPlan(query: string, { filters: useFilters = true } = {}): PlannedCall[] {
  let text = ` ${straightQuotes(query).toLowerCase()} `;
  const filters: Record<string, unknown> = {};
  for (const [pattern, arg, value] of PATTERNS) {
    if (arg in filters || !pattern.test(text)) continue;
    if (useFilters) filters[arg] = value;
    text = text.replace(pattern, " ");
  }
  const budget = useFilters && text.match(BUDGET);
  if (budget) {
    filters.max_total_tuition_usd = Number(budget[1].replace(/,/g, "")) * (budget[2] ? 1000 : 1);
    text = text.replace(BUDGET, " ");
  }
  const asksOpen = OPEN_QUESTION.test(text) && !/open house/.test(text);
  const kinds: string[] = [];
  for (const [pattern, tool, words] of KIND_WORDS) {
    if (!pattern.test(text)) continue;
    if (words === "remove") text = text.replace(pattern, " ");
    if (!kinds.includes(tool)) kinds.push(tool);
  }
  // Drop filler words (the catalog matches plurals and other word endings itself)
  const words = text.split(/[^a-z0-9'&-]+/).filter((w) => w.length > 1 && !FILLER.has(w));
  const rest = words.join(" ");
  const q = rest ? { query: rest } : {};

  // "Is the writing center open?" looks up that one service
  if (asksOpen && rest) {
    const service = toolNamed("find_services")!.run({ query: rest }, "http://localhost") as { results: { id: string }[] };
    if (service.results.length) return [{ tool: "get_service", args: { id: service.results[0].id } }];
  }
  // Program filters mean the person is looking for programs
  if (Object.keys(filters).length) return [{ tool: "search_programs", args: { ...q, ...filters } }];
  if (!rest) return kinds.includes("search_events") || kinds.includes("list_news") ? kinds.map((tool) => ({ tool, args: {} })) : [];
  return (kinds.length ? kinds : ALL_KINDS).map((tool) => ({ tool, args: { ...q } }));
}
