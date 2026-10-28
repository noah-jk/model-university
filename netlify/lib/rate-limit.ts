// Model calls per visitor per minute, shared by search and its AI summary.
// Counts live in Netlify Blobs, keyed by a hash of the IP address (the
// address itself isn't stored). Two requests at the same moment can both
// slip through, which is fine for a demo. If Blobs isn't available, as when
// running outside Netlify, nothing is limited.

import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const PER_MINUTE = 10;

export async function underLimit(ip: string | undefined) {
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
