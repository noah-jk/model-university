// When to show an AI summary above search results. Kept apart from
// summary.ts, which needs the catalog, so the search page's script can use
// it without downloading the catalog.

import type { SearchResponse } from "./types.ts";

const QUESTION_WORDS = /^(what|which|how|who|whom|where|when|why|can|could|do|does|did|is|are|should|will|would)\b/i;

// Does the search read like a question or a request, rather than a topic?
// "chemistry" doesn't; "what science programs are offered" does.
export function readsLikeQuestion(query: string) {
  const q = query.trim();
  return QUESTION_WORDS.test(q) || q.endsWith("?") || q.split(/\s+/).filter(Boolean).length >= 4;
}

// The whole rule: a question-like search the model planned, with at least two
// results and no direct answer from the catalog already
export const shouldSummarize = (query: string, response: Pick<SearchResponse, "fallback" | "results" | "answer">) =>
  readsLikeQuestion(query) && !response.fallback && response.results.length >= 2 && !response.answer;
