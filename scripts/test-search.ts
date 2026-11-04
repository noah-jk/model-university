// Smoke test for natural-language search, with the model faked: no key and
// no network needed. Run with: npm test

import { handleSearch } from "../src/lib/search/handler.ts";
import { search } from "../src/lib/search/search.ts";
import type { Planner } from "../src/lib/llm/types.ts";
import type { SearchResponse } from "../src/lib/search/types.ts";
import { SEARCH_SUGGESTIONS } from "../src/lib/search/suggestions.ts";
import { suggestedSummary } from "../src/lib/search/suggested.ts";
import { SUMMARY_MAX, summaryRecords } from "../src/lib/search/summary.ts";
import { keywordPlan } from "../src/lib/search/plan.ts";
import { systemPrompt, toolSpecs } from "../src/lib/search/prompt.ts";

const fake = (plan: Planner["plan"]): Planner => ({ name: "fake", plan });
const logs: Record<string, unknown>[] = [];

async function post(body: unknown, planner?: Planner) {
  const req = new Request("http://localhost:8888/api/search", { method: "POST", body: JSON.stringify(body) });
  const res = await handleSearch(req, {
    getPlanner: async () => (planner ? { planner } : { unavailable: "no-key" }),
    log: (entry) => logs.push(entry),
  });
  return { status: res.status, body: (await res.json()) as SearchResponse & { error?: string } };
}
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

// The model's plan runs, and its filters become chips
const query = "online health master's programs that start in spring";
const good = await post({ query }, fake(async () => [{ tool: "search_programs", args: { query: "health", level: "Master's", modality: "Online", start_term: "Spring" } }]));
check(good.status === 200 && !good.body.fallback, "model plan: results without fallback");
check(good.body.results.length > 0 && good.body.results.every((r) => r.kind === "program" && r.ref && r.url.startsWith("http")), "results carry kind, ref, and an absolute url");
check(good.body.interpreted.map((c) => c.label).join(", ") === "“health”, Master's, Online, Starts spring", "chips for each filter");

// Invented ids, unknown tools, and bad arguments are dropped
const invented = await post({ query: "nursing" }, fake(async () => [
  { tool: "get_program", args: { id: "underwater-basket-weaving-phd" } },
  { tool: "delete_everything", args: {} },
  { tool: "search_programs", args: { level: "Kindergarten" } },
  { tool: "get_program", args: { id: "nursing-msn" } },
]));
check(invented.body.plan.length === 2, "unknown tools and invalid arguments are dropped");
check(invented.body.results.map((r) => r.ref).join() === "nursing-msn", "an invented id gives no result");

// Errors, timeouts, empty plans, and a missing key fall back to keyword search
const failed = await post({ query: "nursing" }, fake(async () => { throw new Error("quota exceeded"); }));
check(failed.status === 200 && failed.body.fallback && failed.body.results.length > 0, "model error: keyword results");
const slow = await search({ query: "nursing" }, { base: "http://localhost", planner: fake(() => new Promise(() => {})), timeoutMs: 50 });
check(slow.outcome === "timeout" && slow.response.fallback && slow.response.results.length > 0, "model timeout: keyword results");
const empty = await post({ query: "nursing" }, fake(async () => []));
check(empty.body.fallback && empty.body.results.length > 0, "empty plan: keyword results");
const noKey = await post({ query: "is the writing center open right now?" });
check(noKey.body.fallback && noKey.body.answer?.text.includes("Writing Center"), "no key: keyword results and the hours answer");

// Everyday questions work with keyword search too
const science = await post({ query: "what science programs do you offer" });
check(science.body.results.some((r) => r.kind === "program" && /Science/.test(r.title)), "keywords: “what science programs do you offer” finds science programs");
const parents = await post({ query: "what services are offered for student parents" });
check(parents.body.results.some((r) => r.ref === "child-care-center"), "keywords: “services for student parents” finds the child care center");

// A model plan that finds nothing gives way to keyword search
const overSpecific = await post({ query: "what services are offered for student parents" }, fake(async () => [{ tool: "find_services", args: { query: "parents", category: "Money" } }]));
check(overSpecific.body.fallback && overSpecific.body.results.some((r) => r.ref === "child-care-center"), "model plan with no results: keyword results instead");

// Removing a chip reruns the returned plan without asking the model
const dropped = await post(
  { query, plan: good.body.plan, drop: ["start_term:Spring"] },
  fake(async () => { throw new Error("the model shouldn't be asked"); })
);
check(!dropped.body.fallback && !dropped.body.interpreted.some((c) => c.key === "start_term:Spring"), "removing a chip reruns the plan without the model");
check(dropped.body.results.length >= good.body.results.length, "fewer filters, at least as many results");

// Long queries are rejected
const long = await post({ query: "x".repeat(201) });
check(long.status === 400 && /200 characters/.test(long.body.error ?? ""), "queries over 200 characters are rejected");

// A keyword answer says why, for the network panel
const keywordOnly = await post({ query: "nursing" });
check(keywordOnly.body.fallback && keywordOnly.body.reason === "no-key", "keyword fallback says why (no key)");
const quota = Object.assign(new Error('{"error":{"code":429,"message":"You exceeded your current quota for nursing","status":"RESOURCE_EXHAUSTED"}}'), { status: 429 });
const broken = await post({ query: "nursing" }, fake(async () => { throw quota; }));
check(broken.body.fallback && broken.body.reason === "error" && broken.body.error === "429 RESOURCE_EXHAUSTED", "keyword fallback says why (model error, with its status)");
check(logs.some((e) => e.error === "429 RESOURCE_EXHAUSTED") && !logs.some((e) => JSON.stringify(e).includes("exceeded")), "logs carry the model's status, never its message");
check(!("reason" in good.body), "a model answer has no reason");

// A 400 says which setting Google rejected, in the logs only, without the search
const bad = Object.assign(new Error('{"error":{"code":400,"message":"Thinking level MINIMAL is not supported for this model. Request was about: nursing","status":"INVALID_ARGUMENT"}}'), { status: 400 });
logs.length = 0;
const badRequest = await post({ query: "nursing" }, fake(async () => { throw bad; }));
const badLog = logs.find((e) => e.event === "search")!;
check(badRequest.body.error === "400 INVALID_ARGUMENT" && !("detail" in badRequest.body), "a 400's status goes in the response, its message doesn't");
check(badLog.detail === "Thinking level MINIMAL is not supported for this model. Request was about: [request text]", `a 400's message is logged, with the search removed: ${badLog.detail}`);
check(!JSON.stringify(logs).includes("nursing"), "the search never reaches the logs");

// Curly apostrophes (as phones type them) work like straight ones
const curly = await post({ query: "What online master’s programs do you offer?" });
const straight = await post({ query: "What online master's programs do you offer?" });
check(curly.body.results.length > 0 && curly.body.results.map((r) => r.ref).join() === straight.body.results.map((r) => r.ref).join(), "curly and straight apostrophes find the same results");

// The search overlay's suggested searches all find something, even without the model
for (const suggestion of SEARCH_SUGGESTIONS) {
  const { response } = await search({ query: suggestion }, { base: "http://localhost:8888" });
  check(response.results.length > 0, `suggestion finds results with keyword search: "${suggestion}" (${response.results.length}: ${response.results.slice(0, 2).map((r) => r.title).join(", ")})`);
}

// Careers are a kind of result (#62)
const jobs = keywordPlan("jobs in healthcare that pay well");
check(jobs.length === 1 && jobs[0].tool === "search_careers" && jobs[0].args.query === "healthcare", `keywords: “jobs in healthcare…” searches careers (${JSON.stringify(jobs)})`);
const careerSearch = await post({ query: "healthcare jobs" }, fake(async () => [{ tool: "search_careers", args: { query: "healthcare", min_wage: 90000 } }]));
check(careerSearch.body.results.length > 0 && careerSearch.body.results.every((r) => r.kind === "career" && r.url.includes("/academics/careers/") && !r.save && /median in Washington/.test(r.detail)), "model plan: career results, with pay in the detail and no Save button");
check(careerSearch.body.interpreted.map((c) => c.label).join(", ") === "“healthcare”, Pays $90,000 or more", `chips for career filters (${careerSearch.body.interpreted.map((c) => c.label).join(", ")})`);
const nursing = await post({ query: "nursing" });
check(nursing.body.results.some((r) => r.kind === "career") && nursing.body.results.some((r) => r.kind === "program"), "keywords: a topic finds careers alongside programs");
check(toolSpecs.some((t) => t.name === "search_careers") && toolSpecs.some((t) => t.name === "get_career") && /search_careers/.test(systemPrompt()), "the model is offered the career tools and told when to use them");
check(summaryRecords([{ kind: "career", ref: "registered-nurse" }], "http://localhost:8888")[0].text.startsWith("career: Registered nurse."), "summaries can cite careers");

// Suggested searches have prewritten summaries (#65), whose dates come from data
const base = "http://localhost:8888";
const dates = { now: new Date("2026-11-02T12:00:00-08:00"), lateNovember: new Date("2026-11-25T12:00:00-08:00"), spring: new Date("2027-03-10T12:00:00-08:00"), later: new Date("2029-01-10T12:00:00-08:00") };
for (const query of SEARCH_SUGGESTIONS) {
  for (const [when, now] of Object.entries(dates)) {
    const summary = suggestedSummary(query, base, now)!;
    if (!summary || summary.text.length > SUMMARY_MAX || /\{|https?:|[*#]|!/.test(summary.text) || summary.sources.some((s) => !s.url.startsWith(base))) throw new Error(`suggested summary for "${query}" (${when}): ${JSON.stringify(summary)}`);
  }
}
check(true, `every suggested search has a summary under ${SUMMARY_MAX} characters, with live links, now and later`);
const tours = (now: Date) => suggestedSummary("When are campus tours this month?", base, now)!;
check(/^This month's campus tours are on Friday, November 6 \(Tacoma Bay campus\) and Friday, November 20 \(Olympia campus\)\./.test(tours(dates.now).text) && tours(dates.now).sources.length === 2, "tours: this month's, from the events, with both as sources");
check(/^The next campus tours are on Friday, December 4/.test(tours(dates.lateNovember).text), "tours: the next ones, once this month's have passed");
const aid = (now: Date) => suggestedSummary("What are financial aid deadlines?", base, now)!.text;
check(/by February 15, 2027/.test(aid(dates.now)) && /Completion Night on Thursday, January 21\./.test(aid(dates.now)), "aid: the next FAFSA priority date and completion night");
check(/has passed, but file/.test(aid(dates.spring)) && /help you file\.$/.test(aid(dates.spring)), "aid: says so once the dates have passed");
const scienceSummary = suggestedSummary("What science programs do you offer?", base, dates.now)!;
check(scienceSummary.sources.map((s) => s.title).includes("Biology, BS") && scienceSummary.sources.every((s) => s.url.includes("/academics/programs/")), "science: cites the programs it names");
check(suggestedSummary("what science programs do you offer ?", base) !== undefined && suggestedSummary("What science programs do you offer online?", base) === undefined, "only a suggested search, ignoring case and spacing, gets a prewritten summary");

// Logs hold counts and timing only
check(logs.length > 0 && logs.every((entry) => !JSON.stringify(entry).includes("nursing") && !("ip" in entry)), "logs never include the query or an IP");

console.log("\nSearch checks passed.");
