// POST /api/search/summary, without the Netlify parts (the key and the rate
// limit), so it can be tested with a fake model. netlify/functions/summary.mts
// wires those in.
//
// Request:  { query, results: [{ kind, ref }] } (the results on the page, by id)
// Response: { summary: { text, sources: [{ title, url }] } | null, reason }
// A null summary isn't an error: the page says there's no summary and search
// carries on. `reason` says why there's none ("no-key", "rejected",
// "timeout", …), so it can be seen in the browser's network panel; it never
// includes the query or anything the model wrote.

import { z } from "zod";
import siteConfig from "../../../site.config.ts";
import type { Summarizer } from "../llm/types.ts";
import { MAX_QUERY } from "./search.ts";
import { checkSummary, readsLikeQuestion, SUMMARY_SYSTEM, SUMMARY_TIMEOUT_MS, summaryPrompt, summaryRecords } from "./summary.ts";
import { KINDS } from "./types.ts";

const requestSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY),
  // The page sends the results it shows; only the first SUMMARY_RECORDS are used
  results: z.array(z.object({ kind: z.enum(KINDS), ref: z.string().max(160) })).min(2).max(100),
});

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  ...(!siteConfig.indexing && { "X-Robots-Tag": "noindex" }),
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

// How it went, for logs
export type SummaryOutcome = "summary" | "not-needed" | "too-few" | "no-key" | "rate-limited" | "timeout" | "error" | "rejected";

type Deps = {
  getSummarizer: () => Promise<{ summarizer?: Summarizer; unavailable?: "no-key" | "rate-limited" }>;
  // Counts and timing only: never the query, never the IP
  log?: (entry: Record<string, unknown>) => void;
  timeoutMs?: number;
  now?: Date;
};

export async function handleSummary(req: Request, { getSummarizer, log = (e) => console.log(JSON.stringify(e)), timeoutMs = SUMMARY_TIMEOUT_MS, now = new Date() }: Deps) {
  if (!siteConfig.features.aiSearch || !siteConfig.features.aiSummary) return reply({ error: "Not found" }, 404);
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...HEADERS, Allow: "POST" } });
  const body = requestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return reply({ error: "Send a query and at least two results." }, 400);

  const started = Date.now();
  const done = (outcome: SummaryOutcome, summary: unknown = null, records = 0) => {
    log({ event: "summary", outcome, ms: Date.now() - started, records });
    return reply(summary ? { summary } : { summary: null, reason: outcome });
  };

  const { query, results } = body.data;
  if (!readsLikeQuestion(query)) return done("not-needed");
  const records = summaryRecords(results, new URL(req.url).origin, now);
  if (records.length < 2) return done("too-few", null, records.length);
  const { summarizer, unavailable } = await getSummarizer();
  if (!summarizer) return done(unavailable ?? "no-key", null, records.length);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("timeout"));
      }, timeoutMs);
    });
    const raw = await Promise.race([summarizer.summarize({ system: SUMMARY_SYSTEM, prompt: summaryPrompt(query, records), signal: controller.signal }), timeout]);
    const summary = checkSummary(raw, records);
    return summary ? done("summary", summary, records.length) : done("rejected", null, records.length);
  } catch (error) {
    return done((error as Error).message === "timeout" ? "timeout" : "error", null, records.length);
  } finally {
    clearTimeout(timer);
  }
}
