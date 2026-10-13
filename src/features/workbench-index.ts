// /data/workbench-index.json, for the workbench page (see src/lib/workbench/).
// Built whenever the workbench is switched on, whatever jsonFeeds says.
import type { APIRoute } from "astro";
import { buildIndex } from "../lib/workbench/index-data.ts";

export const GET: APIRoute = () => {
  const body = JSON.stringify(buildIndex());
  console.log(`[workbench] workbench-index.json: ${(body.length / 1024).toFixed(0)} KB`);
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
