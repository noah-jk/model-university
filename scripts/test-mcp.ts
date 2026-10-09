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

// Faculty, events, and news: real results, each with an absolute page url
const tool = async (name: string, args: Record<string, unknown>) => {
  const r = await call("tools/call", { name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  return JSON.parse(r.content[0].text);
};
const absolute = (name: string, items: { url: string }[]) => {
  if (!items.length) throw new Error(`${name}: no results`);
  for (const item of items) if (!/^https?:\/\//.test(item.url)) throw new Error(`${name}: missing absolute url in ${JSON.stringify(item)}`);
};

const nursingFaculty = await tool("search_faculty", { department: "Nursing" });
absolute("search_faculty", nursingFaculty.results);
if (!nursingFaculty.results.every((f: { department: string }) => f.department === "Nursing")) throw new Error("search_faculty: department filter");
const byExpertise = await tool("search_faculty", { query: "machine learning" });
absolute("search_faculty (expertise)", byExpertise.results);
const person = await tool("get_faculty", { id: nursingFaculty.results[0].id });
absolute("get_faculty", [person, ...person.courses]);
const byName = await tool("get_faculty", { id: person.name });
if (byName.id !== person.id) throw new Error("get_faculty: lookup by name");
console.log(`✓ search_faculty / get_faculty: ${nursingFaculty.total_matches} in Nursing; ${person.name} teaches ${person.courses.length} course${person.courses.length === 1 ? "" : "s"}`);

const upcoming = await tool("search_events", {});
absolute("search_events", upcoming.results);
if (upcoming.results.some((e: { end: string }) => new Date(e.end) < new Date())) throw new Error("search_events: default should be upcoming only");
const may = await tool("search_events", { from: "2027-05-01", to: "2027-05-31", category: "Arts" });
absolute("search_events (range)", may.results);
if (!may.results.every((e: { category: string; start: string; end: string }) => e.category === "Arts" && e.end >= "2027-05-01" && e.start <= "2027-06-01")) throw new Error("search_events: date range and category");
const olympia = await tool("search_events", { campus: "Olympia campus", upcoming: false });
if (!olympia.results.every((e: { campus: string }) => e.campus === "Olympia campus")) throw new Error("search_events: campus filter");
console.log(`✓ search_events: ${upcoming.total_matches} upcoming, ${may.total_matches} arts events in May 2027`);

const latest = await tool("list_news", { limit: 3 });
absolute("list_news", latest.results);
if (latest.results.length !== 3 || latest.results[0].date < latest.results[2].date) throw new Error("list_news: newest first");
const marine = await tool("list_news", { department: "Marine Biology" });
absolute("list_news (department)", marine.results);
console.log(`✓ list_news: ${latest.results.map((n: { title: string }) => n.title).join(" | ").slice(0, 70)}…`);

// Search engines are kept out until indexing is switched on
const options = await handler(new Request("http://localhost:8888/mcp", { method: "OPTIONS" }));
const robots = options.headers.get("X-Robots-Tag");
if (siteConfig.indexing ? robots : robots !== "noindex") throw new Error(`X-Robots-Tag is ${robots} with indexing ${siteConfig.indexing}`);
console.log(`✓ X-Robots-Tag: ${robots ?? "not sent"}`);

console.log("\nAll checks passed.");
