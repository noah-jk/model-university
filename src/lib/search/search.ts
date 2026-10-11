// Natural-language search, start to finish:
//   1. One model call turns the query into a plan of catalog searches.
//   2. The plan is checked against the tools' schemas, and runs here.
//   3. Results are built from the catalog records the searches found.
// If the model isn't available, fails, is slow, or plans nothing usable,
// keyword search makes the plan instead (fallback: true). Search never fails
// because of the model.

import type { Planner } from "../llm/types.ts";
import { answerFor, applyDrops, chipsFor, keywordPlan, MAX_RETURNED_CALLS, runPlan, validatePlan } from "./plan.ts";
import { profileContext, systemPrompt, toolSpecs } from "./prompt.ts";
import type { InterestProfile, PlannedCall, SearchResponse } from "./types.ts";

export const MAX_QUERY = 200;
export const MODEL_TIMEOUT_MS = 8000;

export type SearchRequest = {
  query: string;
  // Chips removed so far, e.g. ["modality:Online"]
  drop?: string[];
  // A plan from an earlier response: removing a chip reruns it without the model
  plan?: unknown;
  fallback?: boolean;
  profile?: InterestProfile;
};

type Options = {
  base: string;
  // Omitted when there's no key, or the visitor is over the rate limit
  planner?: Planner;
  now?: Date;
  timeoutMs?: number;
};

// How the plan was made, for logs: "model", "returned" (sent back by the
// page), or why keyword search was used
export type Outcome = "model" | "returned" | "no-model" | "timeout" | "error" | "empty-plan";

async function modelPlan(query: string, profile: InterestProfile | undefined, planner: Planner, now: Date, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  try {
    const plan = planner.plan({ system: systemPrompt(now), query, context: profileContext(profile), tools: toolSpecs, signal: controller.signal });
    return validatePlan(await Promise.race([plan, timeout]));
  } finally {
    clearTimeout(timer);
  }
}

export async function search(request: SearchRequest, { base, planner, now = new Date(), timeoutMs = MODEL_TIMEOUT_MS }: Options) {
  const query = request.query.trim().slice(0, MAX_QUERY);
  const drop = request.drop ?? [];
  let plan: PlannedCall[] = [];
  let outcome: Outcome;

  if (request.plan !== undefined) {
    plan = validatePlan(request.plan, MAX_RETURNED_CALLS);
    outcome = "returned";
  } else if (!planner) {
    outcome = "no-model";
  } else {
    try {
      plan = await modelPlan(query, request.profile, planner, now, timeoutMs);
      outcome = plan.length ? "model" : "empty-plan";
    } catch (error) {
      outcome = (error as Error).message === "timeout" ? "timeout" : "error";
    }
  }
  const fallback = outcome === "returned" ? Boolean(request.fallback) : outcome !== "model";
  if (outcome !== "model" && outcome !== "returned") plan = keywordPlan(query);

  const effective = applyDrops(plan, drop);
  const response: SearchResponse = {
    query,
    interpreted: chipsFor(effective),
    results: runPlan(effective, base, now),
    answer: answerFor(effective, base, now),
    fallback,
    plan: effective,
    drop,
  };
  return { response, outcome };
}
