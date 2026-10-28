// POST /api/search: natural-language search (see src/lib/search/).
// This file is the only place the Gemini key is read, and it never leaves
// the server. Without a key, or over the rate limit, search uses keywords.

import siteConfig from "../../site.config.ts";
import { geminiPlanner } from "../../src/lib/llm/gemini.ts";
import { handleSearch } from "../../src/lib/search/handler.ts";
import { underLimit } from "../lib/rate-limit.ts";

// Model searches per visitor per minute (netlify/lib/rate-limit.ts). Removing
// a chip doesn't count: it reruns the earlier plan without the model.
export default async (req: Request, context: { ip?: string }) =>
  handleSearch(req, {
    getPlanner: async () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { unavailable: "no-key" };
      if (!(await underLimit(context.ip))) return { unavailable: "rate-limited" };
      return { planner: geminiPlanner(key, siteConfig.aiSearch.model) };
    },
  });

export const config = { path: "/api/search" };
