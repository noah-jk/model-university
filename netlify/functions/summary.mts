// POST /api/search/summary: the short AI summary above search results (see
// src/lib/search/summary.ts). Like search, this is the only place its model
// key is read, and it shares search's per-visitor rate limit.

import siteConfig from "../../site.config.ts";
import { geminiSummarizer } from "../../src/lib/llm/gemini.ts";
import { handleSummary } from "../../src/lib/search/summary-handler.ts";
import { underLimit } from "../lib/rate-limit.ts";

export default async (req: Request, context: { ip?: string }) =>
  handleSummary(req, {
    getSummarizer: async () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { unavailable: "no-key" };
      if (!(await underLimit(context.ip))) return { unavailable: "rate-limited" };
      return { summarizer: geminiSummarizer(key, siteConfig.aiSearch.model) };
    },
  });

export const config = { path: "/api/search/summary" };
