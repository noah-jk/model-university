// The AI summary above search results: when to ask for one, what the model
// sees, and the checks a summary has to pass before anyone sees it.
//
// The model is given only the catalog records behind the results on the
// page, rebuilt here from their kind and id (never text from the browser),
// and has to cite them by number. A summary that cites nothing, cites a
// record it wasn't given, or runs long is dropped. No DOM code: the page,
// the endpoint, and tests share it.

import * as catalog from "../catalog.ts";
import { resultFor } from "./results.ts";
import type { Kind } from "./types.ts";

export const SUMMARY_TARGET = 200; // what the model is asked for, in characters
export const SUMMARY_MAX = 280; // longer than this is dropped, not cut
export const SUMMARY_TIMEOUT_MS = 6000;

import { SUMMARY_RECORDS } from "./summary-rule.ts";
export { readsLikeQuestion, shouldSummarize, SUMMARY_RECORDS } from "./summary-rule.ts";

// What the model is told
export const SUMMARY_SYSTEM = `You summarize search results for a university website. Use only the numbered records you're given.
- Answer the visitor's search in one or two plain sentences, at most ${SUMMARY_TARGET} characters.
- Say only what the records say. Don't add facts, numbers, or advice that aren't in them.
- If the records don't fully answer the search, say what they do cover.
- No lists, markdown, links, or exclamation points.
- In sources, list the numbers of the records your sentences rely on.`;

type Record_ = { kind: Kind; ref: string; title: string; url: string; text: string };

const descriptionOf = (kind: Kind, ref: string): string | undefined => {
  switch (kind) {
    case "program":
      return catalog.programs.find((p) => p.id === ref)?.description;
    case "course":
      return catalog.courses.find((c) => c.id === ref)?.description;
    case "faculty":
      return catalog.faculty.find((f) => f.id === ref)?.bio;
    case "event":
      return catalog.events.find((e) => e.id === ref)?.description;
    case "service":
      return catalog.services.find((s) => s.id === ref)?.description;
    case "news":
      return catalog.news.find((n) => n.id === ref)?.summary;
  }
};

// The records behind the results, from the catalog. Unknown ids are skipped.
export function summaryRecords(results: { kind: Kind; ref: string }[], base: string, now = new Date()): Record_[] {
  return results.slice(0, SUMMARY_RECORDS).flatMap(({ kind, ref }) => {
    const result = resultFor(kind, ref, base, now);
    if (!result) return [];
    const description = descriptionOf(kind, ref)?.slice(0, 300);
    return [{ kind, ref, title: result.title, url: result.url, text: `${kind}: ${result.title}. ${result.detail}.${description ? ` ${description}` : ""}` }];
  });
}

export const summaryPrompt = (query: string, records: Record_[]) =>
  `Search: ${query}\n\nRecords:\n${records.map((r, i) => `[${i + 1}] ${r.text}`).join("\n")}`;

export type Summary = { text: string; sources: { title: string; url: string }[] };

// The checks. `raw` is the model's JSON: { text, sources: [numbers] }.
export function checkSummary(raw: unknown, records: Record_[]): Summary | undefined {
  const { text, sources } = (raw ?? {}) as { text?: unknown; sources?: unknown };
  if (typeof text !== "string" || !Array.isArray(sources)) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 20 || clean.length > SUMMARY_MAX || /https?:|www\.|[*#]|!/.test(clean)) return undefined;
  const numbers = [...new Set(sources)];
  if (!numbers.length || !numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= records.length)) return undefined;
  return { text: clean, sources: numbers.map((n) => ({ title: records[n - 1].title, url: records[n - 1].url })) };
}
