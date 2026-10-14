// The search results area as HTML: the keyword-search note, the filter chips,
// the answer, and the results grouped by kind. The page renders it on the
// server (search without JavaScript), and src/scripts/search.ts renders it
// again in the browser after each search, so results look and behave the same
// either way. Everything shown is escaped.

import { saveToggle } from "../workbench/toggle.ts";
import type { Kind, SearchResponse, SearchResult } from "./types.ts";

export const GROUPS: { kind: Kind; title: string }[] = [
  { kind: "program", title: "Programs" },
  { kind: "course", title: "Courses" },
  { kind: "faculty", title: "Faculty" },
  { kind: "event", title: "Events" },
  { kind: "service", title: "Student services" },
  { kind: "news", title: "News" },
];

export const EXAMPLES = [
  "online health master's programs that start in spring",
  "who teaches marine biology?",
  "is the writing center open right now?",
  "nursing programs under $40k",
  "campus tours",
  "news about research grants",
];

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const searchHref = (query: string) => `/search/?q=${encodeURIComponent(query)}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const statusText = (r: SearchResponse) => `${plural(r.results.length, "result")} for “${r.query}”${r.answer ? ", with a quick answer" : ""}.`;

// One result, with its Save to Workbench toggle when the workbench is on
function renderResult(r: SearchResult) {
  return `<li class="result" data-kind="${esc(r.kind)}" data-ref="${esc(r.ref)}">
  <div>
    <a href="${esc(r.url)}">${esc(r.title)}</a>
    <p>${esc(r.detail)}</p>
  </div>
  ${r.save ? saveToggle(r.save, { compact: true }) : ""}
</li>`;
}

function renderChips(r: SearchResponse) {
  if (!r.interpreted.length) return "";
  // A real form, so removing a chip works without JavaScript too: each chip
  // submits the search again with its key added to ?drop=.
  return `<form class="chips" method="get" action="/search/" aria-labelledby="chips-label">
  <input type="hidden" name="q" value="${esc(r.query)}" />
  ${r.drop.map((d) => `<input type="hidden" name="drop" value="${esc(d)}" />`).join("")}
  <p id="chips-label" class="chips-label">Searching for</p>
  <ul>${r.interpreted
    .map(
      (chip) => `<li><button type="submit" class="chip" name="drop" value="${esc(chip.key)}" aria-label="Remove filter: ${esc(chip.label)}">
    <span>${esc(chip.label)}</span><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
  </button></li>`
    )
    .join("")}</ul>
</form>`;
}

function renderAnswer(r: SearchResponse) {
  if (!r.answer) return "";
  return `<section class="answer" aria-labelledby="answer-title">
  <h2 id="answer-title">Quick answer</h2>
  <p>${esc(r.answer.text)}</p>
  <p class="answer-source">Source: <a href="${esc(r.answer.source.url)}">${esc(r.answer.source.title)}</a></p>
</section>`;
}

function renderGroups(r: SearchResponse) {
  return GROUPS.map(({ kind, title }) => {
    const items = r.results.filter((x) => x.kind === kind);
    if (!items.length) return "";
    return `<section class="result-group" aria-labelledby="results-${kind}">
  <h2 id="results-${kind}" tabindex="-1">${title} <span class="count">(${items.length})</span></h2>
  <ul class="results">${items.map(renderResult).join("")}</ul>
</section>`;
  }).join("");
}

function renderEmpty(r: SearchResponse) {
  const allDropped = r.drop.length > 0 && !r.interpreted.length;
  return `<div class="empty">
  <h2 tabindex="-1">${allDropped ? "No filters left" : `No results for “${esc(r.query)}”`}</h2>
  <p>${allDropped ? `<a href="${esc(searchHref(r.query))}">Search again for “${esc(r.query)}”</a>, or try one of these:` : "Try fewer words, or one of these:"}</p>
  <ul>${EXAMPLES.map((q) => `<li><a href="${esc(searchHref(q))}">${esc(q)}</a></li>`).join("")}</ul>
</div>`;
}

export function renderResults(r: SearchResponse) {
  return [
    r.fallback ? `<p class="search-note">Showing keyword results.</p>` : "",
    renderChips(r),
    renderAnswer(r),
    r.results.length ? renderGroups(r) : renderEmpty(r),
  ].join("\n");
}
