// POST /api/search, without the Netlify parts (the key and the rate limit),
// so it can be tested with a fake model. netlify/functions/search.mts wires
// those in.
//
// Request:  { query, drop?, plan?, fallback?, profile? }
// Response: SearchResponse (see types.ts)

import { z } from "zod";
import siteConfig from "../../../site.config.ts";
import type { Planner } from "../llm/types.ts";
import { MAX_QUERY, search, type Outcome } from "./search.ts";

const interest = z.string().max(80).optional();
const requestSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY),
  drop: z.array(z.string().max(160)).max(30).optional(),
  plan: z.unknown().optional(),
  fallback: z.boolean().optional(),
  profile: z.object({ department: interest, college: interest, level: interest, modality: interest }).optional(),
});

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  ...(!siteConfig.indexing && { "X-Robots-Tag": "noindex" }),
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

type Deps = {
  // Called only when the model is needed: returns it, or why it can't be used
  getPlanner: () => Promise<{ planner?: Planner; unavailable?: "no-key" | "rate-limited" }>;
  // Counts and timing only: never the query, never the IP
  log?: (entry: Record<string, unknown>) => void;
};

export async function handleSearch(req: Request, { getPlanner, log = (e) => console.log(JSON.stringify(e)) }: Deps) {
  if (!siteConfig.features.aiSearch) return reply({ error: "Not found" }, 404);
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...HEADERS, Allow: "POST" } });

  const body = requestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const tooLong = body.error.issues.some((i) => i.path[0] === "query" && i.code === "too_big");
    return reply({ error: tooLong ? `Searches can be up to ${MAX_QUERY} characters.` : "Send a query." }, 400);
  }

  const started = Date.now();
  const { planner, unavailable } = body.data.plan === undefined ? await getPlanner() : {};
  const { response, outcome, modelError } = await search(body.data, { base: new URL(req.url).origin, planner });
  const why = unavailable ?? outcome;
  log({
    event: "search",
    outcome: why as Outcome | typeof unavailable,
    ...(modelError && { error: modelError }),
    ms: Date.now() - started,
    calls: response.plan.length,
    results: response.results.length,
    fallback: response.fallback,
    profile: Boolean(body.data.profile),
  });
  return reply(response.fallback && outcome !== "returned" ? { ...response, reason: why, ...(modelError && { error: modelError }) } : response);
}
