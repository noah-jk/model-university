// Smoke test for natural-language search, with the model faked: no key and
// no network needed. Run with: npm test

import { handleSearch } from "../src/lib/search/handler.ts";
import { search } from "../src/lib/search/search.ts";
import type { Planner } from "../src/lib/llm/types.ts";
import type { SearchResponse } from "../src/lib/search/types.ts";

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

// Logs hold counts and timing only
check(logs.length > 0 && logs.every((entry) => !JSON.stringify(entry).includes("nursing") && !("ip" in entry)), "logs never include the query or an IP");

console.log("\nSearch checks passed.");
