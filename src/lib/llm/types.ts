// The model behind natural-language search, behind a small interface so
// another provider can be swapped in (or a fake one used in tests).
// The planner reads the visitor's words and picks catalog searches; it never
// writes results or facts itself. The summarizer writes the short AI summary
// above results, from catalog records only (see src/lib/search/summary.ts).

import type { PlannedCall } from "../search/types.ts";

export type ToolSpec = {
  name: string;
  description: string;
  // JSON Schema for the tool's arguments
  parameters: Record<string, unknown>;
};

export type PlanRequest = {
  system: string;
  query: string;
  // Optional soft context, e.g. what the visitor has browsed
  context?: string;
  tools: ToolSpec[];
  signal: AbortSignal;
};

export interface Planner {
  // Shown in logs, e.g. "gemini-3.8-flash"
  name: string;
  // One model call that returns the searches to run
  plan(request: PlanRequest): Promise<PlannedCall[]>;
}

export type SummaryRequest = {
  system: string;
  // The search and the numbered records
  prompt: string;
  signal: AbortSignal;
};

export interface Summarizer {
  name: string;
  // One model call that returns JSON: { text, sources: [record numbers] }.
  // The caller checks it before it's shown.
  summarize(request: SummaryRequest): Promise<unknown>;
}
