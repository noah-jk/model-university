// Smoke test: calls the MCP function directly, no Netlify needed.
// Run with: npm test

import handler from "../netlify/functions/mcp.mts";
import siteConfig from "../site.config.ts";

let id = 0;
async function call(method: string, params: Record<string, unknown>): Promise<any> {
  const req = new Request("http://localhost:8888/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const res = await handler(req);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke-test", version: "1" } });
console.log(`✓ initialize: ${init.serverInfo.name}`);

const { tools } = await call("tools/list", {});
console.log(`✓ tools/list: ${tools.map((t: { name: string }) => t.name).join(", ")}`);

const checks: [string, Record<string, unknown>][] = [
  ["search_programs", { query: "health", level: "Master's" }],
  ["get_program", { id: "nursing-bs" }],
  ["compare_programs", { ids: ["computer-science-bs", "data-science-bs"] }],
  ["search_courses", { query: "ethics", limit: 3 }],
  ["find_services", { query: "tutoring" }],
  ["services_open_now", { at: "2026-10-05T14:30:00-07:00" }],
];
for (const [name, args] of checks) {
  const r = await call("tools/call", { name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  const text = r.content[0].text;
  console.log(`✓ ${name}: ${text.length} chars, starts ${JSON.stringify(text.slice(0, 70))}`);
}
// Prompts
const { prompts } = await call("prompts/list", {});
for (const name of ["recommend-program", "find-help"]) {
  if (!prompts.some((p: { name: string }) => p.name === name)) throw new Error(`prompts/list: missing ${name}`);
}
console.log(`✓ prompts/list: ${prompts.map((p: { name: string }) => p.name).join(", ")}`);
const promptChecks: [string, Record<string, string>][] = [["recommend-program", { interest: "nursing", level: "Bachelor's" }], ["recommend-program", {}], ["find-help", { need: "tutoring" }]];
for (const [name, args] of promptChecks) {
  const r = await call("prompts/get", { name, arguments: args });
  const text = r.messages?.[0]?.content?.text;
  if (!text) throw new Error(`prompts/get ${name}: no message text`);
  console.log(`✓ prompts/get ${name}: ${JSON.stringify(text.slice(0, 70))}`);
}

// Every result carries an absolute url; the program search notes truncation
const search = JSON.parse((await call("tools/call", { name: "search_programs", arguments: {} })).content[0].text);
if (search.results.length !== 5 || !search.note) throw new Error("search_programs: expected 5 results and a note");
const courseHit = JSON.parse((await call("tools/call", { name: "search_courses", arguments: { query: "ethics", limit: 1 } })).content[0].text);
for (const r of [...search.results, ...courseHit.results]) {
  if (!/^https?:\/\//.test(r.url)) throw new Error(`missing absolute url: ${JSON.stringify(r)}`);
}
const course = JSON.parse((await call("tools/call", { name: "get_course", arguments: { code: courseHit.results[0].code } })).content[0].text);
if (!course.url.endsWith(`/academics/courses/${course.id}/`)) throw new Error(`get_course: expected a course page url, got ${course.url}`);
console.log(`✓ urls and note: ${search.note}`);

// Search engines are kept out until indexing is switched on
const options = await handler(new Request("http://localhost:8888/mcp", { method: "OPTIONS" }));
const robots = options.headers.get("X-Robots-Tag");
if (siteConfig.indexing ? robots : robots !== "noindex") throw new Error(`X-Robots-Tag is ${robots} with indexing ${siteConfig.indexing}`);
console.log(`✓ X-Robots-Tag: ${robots ?? "not sent"}`);

console.log("\nAll checks passed.");
