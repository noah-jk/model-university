// Shapes shared by the search function, the search page, and its script.

import type { SaveData } from "../workbench/toggle.ts";

// What a result is. `kind` and `ref` (the catalog id) match the item model of
// the planned Workbench, where people save results, so a result can be saved
// as-is and rendered again later from those two fields.
export const KINDS = ["program", "course", "faculty", "event", "service", "news"] as const;
export type Kind = (typeof KINDS)[number];

export type SearchResult = {
  kind: Kind;
  ref: string;
  title: string;
  url: string;
  // One line of facts, e.g. "Master's · Online · Starts fall, spring · About $28,440 total"
  detail: string;
  // What its Save to Workbench toggle saves, when the workbench is on
  save?: SaveData;
};

// One catalog search the model (or the keyword interpreter) decided to run,
// e.g. { tool: "search_programs", args: { level: "Master's", modality: "Online" } }
export type PlannedCall = { tool: string; args: Record<string, unknown> };

// A filter taken from the query, shown as a removable chip. `key` identifies
// it in ?drop= (e.g. "modality:Online").
export type Chip = { key: string; label: string };

export type SearchResponse = {
  query: string;
  interpreted: Chip[];
  results: SearchResult[];
  // A short answer for a direct question, written from catalog data
  answer?: { text: string; source: { title: string; url: string } };
  // True when keyword search answered instead of the model
  fallback: boolean;
  // Why, when it did: "no-key", "rate-limited", "timeout", "error",
  // "empty-plan" (the model planned nothing usable), or "no-results" (the
  // model's searches found nothing). For the browser's network panel.
  reason?: string;
  // The searches that ran, after any dropped filters. Send it back with
  // more ?drop= keys to remove a chip without asking the model again.
  plan: PlannedCall[];
  drop: string[];
};

// The visitor's top interests, sent only if they tick "Use what I've browsed"
export type InterestProfile = { department?: string; college?: string; level?: string; modality?: string };
