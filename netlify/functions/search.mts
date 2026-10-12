// POST /api/search: natural-language search (see src/lib/search/).
// This file is the only place the Gemini key is read, and it never leaves
// the server. Without a key, or over the rate limit, search uses keywords.

import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import siteConfig from "../../site.config.ts";
import { geminiPlanner } from "../../src/lib/llm/gemini.ts";
import { handleSearch } from "../../src/lib/search/handler.ts";

// Model searches per visitor per minute. Removing a chip doesn't count: it
// reruns the earlier plan without the model.
const PER_MINUTE = 10;

// Counts live in Netlify Blobs, keyed by a hash of the IP address (the
// address itself isn't stored). Two requests at the same moment can both
// slip through, which is fine for a demo. If Blobs isn't available, as when
// running outside Netlify, nothing is limited.
async function underLimit(ip: string | undefined) {
  if (!ip) return true;
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const minute = Math.floor(Date.now() / 60_000);
  try {
    const store = getStore({ name: "search-rate-limit", consistency: "strong" });
    const saved = (await store.get(key, { type: "json" })) as { minute: number; count: number } | null;
    const count = saved?.minute === minute ? saved.count : 0;
    if (count >= PER_MINUTE) return false;
    await store.setJSON(key, { minute, count: count + 1 });
    return true;
  } catch {
    return true;
  }
}

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
