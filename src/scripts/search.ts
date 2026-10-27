// The search page with JavaScript: asks /api/search, where the model plans
// the search, and shows its results in place of the keyword results the page
// arrived with. Removing a chip reruns the same plan without that filter,
// without asking the model again. If the request fails, the keyword results
// stay, so search never ends on an error.

import siteConfig from "../../site.config.ts";
import { renderResults, searchHref, statusText } from "../lib/search/render.ts";
import { shouldSummarize } from "../lib/search/summary-rule.ts";
import type { InterestProfile, SearchResponse } from "../lib/search/types.ts";
import { loadSession, preferred } from "./personalize.ts";

const USE_PROFILE_KEY = "cascadia:search-use-profile";

const area = document.querySelector<HTMLElement>("[data-search-results]")!;
const output = document.querySelector<HTMLElement>("[data-search-output]")!;
const status = document.querySelector<HTMLElement>("[data-search-status]")!;
const useProfile = document.querySelector<HTMLInputElement>("#use-profile");
const keywordResults: SearchResponse | null = JSON.parse(document.getElementById("search-data")!.textContent!);

let current = keywordResults;
let inFlight: AbortController | undefined;

// "Use what I've browsed": the visitor's top interests from this tab's session
function interests(): InterestProfile | undefined {
  if (!useProfile || useProfile.closest<HTMLElement>("[hidden]") || !useProfile.checked) return undefined;
  const { profile } = loadSession();
  const picked = {
    department: preferred(profile, "department"),
    college: preferred(profile, "college"),
    level: preferred(profile, "level"),
    modality: preferred(profile, "modality"),
  };
  return Object.values(picked).some(Boolean) ? picked : undefined;
}

function describeInterests() {
  const hint = document.getElementById("use-profile-hint");
  if (!hint || !useProfile) return;
  const { profile } = loadSession();
  const values = [preferred(profile, "department"), preferred(profile, "level"), preferred(profile, "modality")].filter(Boolean);
  hint.textContent = values.length
    ? `Sends ${values.join(", ")} with your search, as a hint. Nothing else from your browsing is sent.`
    : "Nothing to send yet: browse a few programs or courses first.";
}

// The AI summary (see src/lib/search/summary.ts). The page keeps its space
// for a question-like search; after the results arrive, it either asks for a
// summary of them or, if the rule says not to, removes the panel in the same
// moment the results change.
const summaryPanel = document.querySelector<HTMLElement>("[data-ai-summary]");
let summaryRequest: AbortController | undefined;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function setSummary(text: string, sources: { title: string; url: string }[] = []) {
  if (!summaryPanel) return;
  summaryPanel.querySelector("[data-summary-text]")!.textContent = text;
  const list = summaryPanel.querySelector<HTMLElement>("[data-summary-sources]")!;
  list.hidden = !sources.length;
  list.innerHTML = sources.length ? `Sources: ${sources.map((s) => `<a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a>`).join('<span aria-hidden="true"> · </span>')}` : "";
  summaryPanel.removeAttribute("aria-busy");
}

async function summarize(response: SearchResponse) {
  if (!summaryPanel) return;
  summaryRequest?.abort();
  if (!shouldSummarize(response.query, response)) {
    summaryPanel.hidden = true;
    return;
  }
  summaryPanel.hidden = false;
  setSummary("Writing a summary…");
  summaryPanel.setAttribute("aria-busy", "true");
  summaryRequest = new AbortController();
  try {
    const res = await fetch("/api/search/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: response.query, results: response.results.map(({ kind, ref }) => ({ kind, ref })) }),
      signal: summaryRequest.signal,
    });
    const { summary } = res.ok ? ((await res.json()) as { summary: { text: string; sources: { title: string; url: string }[] } | null }) : { summary: null };
    if (summary) setSummary(summary.text, summary.sources);
    else setSummary("No summary for this search.");
  } catch (error) {
    if ((error as Error).name !== "AbortError") setSummary("No summary for this search.");
  }
}

function show(response: SearchResponse) {
  current = response;
  output.innerHTML = renderResults(response);
  summarize(response);
  // Save to Workbench toggles in the results catch up (src/scripts/workbench/save.ts)
  window.dispatchEvent(new Event("content:rendered"));
  delete area.dataset.pending;
  area.removeAttribute("aria-busy");
  status.textContent = statusText(response);
  document.title = `Search: ${response.query} | ${siteConfig.name}`;
}

async function ask(body: Record<string, unknown>) {
  inFlight?.abort();
  inFlight = new AbortController();
  area.dataset.pending = "";
  area.setAttribute("aria-busy", "true");
  status.textContent = "Searching…";
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: inFlight.signal,
  });
  if (!res.ok) throw new Error(`Search returned ${res.status}`);
  return (await res.json()) as SearchResponse;
}

const isAbort = (error: unknown) => (error as Error).name === "AbortError";

// The search in the address, planned by the model
async function searchFromAddress() {
  const params = new URLSearchParams(location.search);
  const query = params.get("q")?.trim();
  if (!query || !keywordResults) return;
  try {
    show(await ask({ query, drop: params.getAll("drop"), profile: interests() }));
  } catch (error) {
    if (!isAbort(error)) show(keywordResults);
  }
}

const withDrops = (query: string, drop: string[]) => searchHref(query) + drop.map((d) => `&drop=${encodeURIComponent(d)}`).join("");

// Removing a chip: run the current plan again without that filter, then move
// focus to the chip that took its place, or to the first results heading.
output.addEventListener("submit", async (event) => {
  const form = event.target as HTMLFormElement;
  const chip = (event as SubmitEvent).submitter as HTMLButtonElement | null;
  if (!form.matches(".chips") || !chip || !current || form.dataset.reload) return;
  event.preventDefault();
  const index = [...form.querySelectorAll(".chip")].indexOf(chip);
  const drop = [...current.drop, chip.value];
  const { query, plan, fallback } = current;
  try {
    const response = await ask({ query, drop, plan, fallback });
    history.pushState({ response }, "", withDrops(query, drop));
    show(response);
    const target = output.querySelectorAll<HTMLElement>(".chip")[index] ?? output.querySelector<HTMLElement>("h2[tabindex]");
    target?.focus();
  } catch (error) {
    // Without the API, the form does the same job by loading the page again
    if (isAbort(error)) return;
    form.dataset.reload = "true";
    form.requestSubmit(chip);
  }
});

// Back and forward between chip removals
addEventListener("popstate", (event) => {
  const saved = (event.state as { response?: SearchResponse } | null)?.response;
  if (saved) show(saved);
  else location.reload();
});

if (useProfile) {
  try {
    useProfile.checked = sessionStorage.getItem(USE_PROFILE_KEY) === "on";
  } catch {}
  describeInterests();
  useProfile.addEventListener("change", () => {
    try {
      sessionStorage.setItem(USE_PROFILE_KEY, useProfile.checked ? "on" : "off");
    } catch {}
    searchFromAddress();
  });
}

history.replaceState({ response: current }, "");
searchFromAddress().then(() => history.replaceState({ response: current }, ""));
