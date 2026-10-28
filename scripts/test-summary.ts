// Tests for the AI summary above search results: when it's asked for, what
// the model is given, and the checks a summary must pass. The model is faked.
// Run with: npm test

import { handleSummary } from "../src/lib/search/summary-handler.ts";
import { checkSummary, readsLikeQuestion, shouldSummarize, summaryPrompt, summaryRecords, SUMMARY_MAX } from "../src/lib/search/summary.ts";
import type { Summarizer } from "../src/lib/llm/types.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};
const base = "https://cascadia.example";

// The rule ----------------------------------------------------------------------------
check(!readsLikeQuestion("chemistry") && !readsLikeQuestion("marine biology") && !readsLikeQuestion("nursing masters online"), "topics don't get a summary");
check(readsLikeQuestion("what science programs are offered") && readsLikeQuestion("Is there help for student parents?") && readsLikeQuestion("online nursing programs that start in spring"), "questions and longer requests do");
const two = [{ kind: "program", ref: "a" }, { kind: "program", ref: "b" }] as never;
check(shouldSummarize("what science programs are offered", { fallback: false, results: two, answer: undefined }), "rule: a model plan with two results");
check(!shouldSummarize("what science programs are offered", { fallback: true, results: two, answer: undefined }), "rule: not for keyword search");
check(!shouldSummarize("what science programs are offered", { fallback: false, results: [two[0]], answer: undefined }), "rule: not for one result");
check(!shouldSummarize("is the writing center open?", { fallback: false, results: two, answer: { text: "Open", source: { title: "", url: "" } } }), "rule: not when there's a direct answer");

// What the model sees -----------------------------------------------------------------
const results = [
  { kind: "program", ref: "computer-science-bs" },
  { kind: "program", ref: "data-science-bs" },
  { kind: "program", ref: "made-up-program" },
  { kind: "service", ref: "financial-aid-and-scholarships" },
] as const;
const records = summaryRecords([...results], base);
check(records.length === 3 && records.every((r) => r.url.startsWith(base)), "records come from the catalog, unknown ids skipped, urls absolute");
const prompt = summaryPrompt("what science programs are offered", records);
check(/^Search: what science programs are offered/.test(prompt) && /\[1\] program: Computer Science, BS/.test(prompt) && /\[3\] service: Financial Aid/.test(prompt), "prompt numbers each record");

// The checks ------------------------------------------------------------------------------
const good = checkSummary({ text: "Cascadia State offers bachelor's degrees in computer science and data science.", sources: [1, 2, 2] }, records);
check(good?.sources.length === 2 && good.sources[0].title === "Computer Science, BS" && good.sources[0].url.startsWith(base), "a cited summary passes, with its sources' titles and links");
check(!checkSummary({ text: "Cascadia State offers lots of science programs for everyone.", sources: [] }, records), "no sources: dropped");
check(!checkSummary({ text: "Cascadia State offers lots of science programs for everyone.", sources: [4] }, records), "a source it wasn't given: dropped");
check(!checkSummary({ text: "x".repeat(SUMMARY_MAX + 1), sources: [1] }, records), "too long: dropped, not cut");
check(!checkSummary({ text: "See https://example.com for science programs and more.", sources: [1] }, records), "a link in the text: dropped");
check(!checkSummary({ text: "Lots of great science programs here!", sources: [1] }, records), "an exclamation point: dropped");
check(!checkSummary("not json", records) && !checkSummary(null, records), "not the expected shape: dropped");

// The endpoint ---------------------------------------------------------------------------
const logs: Record<string, unknown>[] = [];
const fake = (summarize: Summarizer["summarize"]): Summarizer => ({ name: "fake", summarize });
async function post(body: unknown, summarizer?: Summarizer, timeoutMs?: number) {
  const req = new Request(`${base}/api/search/summary`, { method: "POST", body: JSON.stringify(body) });
  const res = await handleSummary(req, { getSummarizer: async () => (summarizer ? { summarizer } : { unavailable: "no-key" }), log: (e) => logs.push(e), timeoutMs });
  return { status: res.status, body: (await res.json()) as { summary: { text: string; sources: { title: string; url: string }[] } | null; error?: string; reason?: string } };
}
const query = "what science programs are offered";
let seen = "";
const ok = await post({ query, results }, fake(async ({ prompt }) => ((seen = prompt), { text: "There are bachelor's degrees in computer science and data science.", sources: [1, 2] })));
check(ok.status === 200 && ok.body.summary?.sources.map((s) => s.title).join() === "Computer Science, BS,Data Science, BS", "endpoint: a checked summary with its sources");
check(!seen.includes("made-up-program") && seen.includes("Computer Science, BS"), "endpoint: the model sees only catalog records");
check((await post({ query: "chemistry", results }, fake(async () => ({ text: "Chemistry is here.", sources: [1] })))).body.summary === null, "endpoint: topic searches get none, without calling the model");
check((await post({ query, results }, fake(async () => ({ text: "Made up and uncited summary text here.", sources: [9] })))).body.summary === null, "endpoint: a summary that fails the checks isn't shown");
check((await post({ query, results })).body.summary === null, "endpoint: no key, no summary");
check((await post({ query, results }, fake(() => new Promise(() => {})), 50)).body.summary === null, "endpoint: slow model times out");
check((await post({ query, results }, fake(async () => { throw new Error("boom"); }))).body.summary === null, "endpoint: a model error gives no summary");
check((await post({ query, results: [results[0]] })).status === 400, "endpoint: needs at least two results");
const many = Array.from({ length: 30 }, (_, i) => ({ kind: "program", ref: i % 2 ? "computer-science-bs" : "data-science-bs" }));
let manyPrompt = "";
const manyResult = await post({ query, results: many }, fake(async ({ prompt }) => ((manyPrompt = prompt), { text: "There are bachelor's degrees in computer science and data science.", sources: [1] })));
check(manyResult.status === 200 && manyResult.body.summary && !manyPrompt.includes("[9]"), "endpoint: many results are fine, and only the first eight are used");
const reasons = await post({ query, results }, fake(async () => ({ text: "Uncited and made up summary text.", sources: [] })));
check(reasons.body.summary === null && (reasons.body as { reason?: string }).reason === "rejected" && (await post({ query, results })).body.reason === "no-key", "endpoint: says why there's no summary");
check(logs.length >= 6 && logs.every((e) => !JSON.stringify(e).includes("science") && !("ip" in e)) && logs.some((e) => e.outcome === "summary") && logs.some((e) => e.outcome === "timeout"), "logs: outcome, timing, and counts only");

console.log("\nSummary checks passed.");
