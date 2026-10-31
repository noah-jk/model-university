// Smoke test: calls the MCP function directly, no Netlify needed.
// Run with: npm test

import handler from "../netlify/functions/mcp.mts";
import siteConfig from "../site.config.ts";
import { tools as sharedTools } from "../src/lib/tools.ts";
import { rules } from "../src/lib/enrollment.ts";
import { buildIndex } from "../src/lib/workbench/index-data.ts";
import { planFor } from "../src/lib/workbench/plan.ts";
import { resolveProfile } from "../src/lib/workbench/profile.ts";

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
// Every tool in src/lib/tools.ts is registered, with its shared description
for (const shared of sharedTools) {
  const listed = tools.find((t: { name: string }) => t.name === shared.name);
  if (listed?.description !== shared.description) throw new Error(`tools/list: ${shared.name} missing or out of date`);
}
if (tools.length !== sharedTools.length) throw new Error(`tools/list: ${tools.length} tools, expected ${sharedTools.length}`);
console.log(`✓ tools/list matches src/lib/tools.ts (${tools.length} tools)`);

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

// Enrollment steps and the academic calendar ----------------------------------------
const toolError = async (name: string, args: Record<string, unknown>) => {
  const r = await call("tools/call", { name, arguments: args });
  if (!r.isError) throw new Error(`${name}: expected an error for ${JSON.stringify(args)}`);
  return r.content[0].text as string;
};
const urlsIn = (value: unknown): string[] =>
  typeof value === "string" ? [] : Array.isArray(value) ? value.flatMap(urlsIn) : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => (/url$/.test(k) && typeof v === "string" ? [v] : urlsIn(v))) : [];
const allAbsolute = (name: string, result: unknown) => {
  const urls = urlsIn(result);
  if (!urls.length || urls.some((u) => !/^https?:\/\//.test(u))) throw new Error(`${name}: every url should be absolute: ${urls.filter((u) => !/^https?:/.test(u)).join(", ")}`);
  return urls.length;
};

const transfer = await tool("get_enrollment_steps", { student_type: "Transfer", level: "Undergraduate", term: "Winter 2027" });
const transferUrls = allAbsolute("get_enrollment_steps", transfer);
// The same steps and dates as Your Path for that profile with nothing saved
const yourPath = planFor(
  resolveProfile({ studentType: "Transfer", level: "Undergraduate", startTerm: "Winter 2027" }, { views: [], items: [] }, ["Winter 2027"]),
  rules,
  buildIndex(),
  { version: 2, items: [], profile: {}, dismissed: [], completed: [], hiddenHandoffs: [], updatedAt: "" },
  []
)!;
const same = JSON.stringify(transfer.steps.map((s: { id: string; due_date: string | null }) => [s.id, s.due_date])) === JSON.stringify(yourPath.steps.map((s) => [s.step.id, s.date ?? null]));
if (!same) throw new Error("get_enrollment_steps: steps differ from Your Path's plan");
if (!transfer.steps[0].journey || !transfer.offices.some((o: { id: string }) => o.id === "transfer-center")) throw new Error("get_enrollment_steps: journey first, and the Transfer Center among the offices");
const apply = transfer.steps.find((s: { id: string }) => s.id === "apply");
if (apply.due_date !== null || !/get_program/.test(apply.note)) throw new Error("get_enrollment_steps: without a program, the apply step points to get_program");
const phases = transfer.steps.map((s: { phase: string }) => s.phase);
if (phases[0] !== "apply" || phases.at(-1) !== "admitted" || phases.lastIndexOf("apply") > phases.indexOf("admitted")) throw new Error("get_enrollment_steps: each step has its phase, apply steps first");
console.log(`✓ get_enrollment_steps: ${transfer.steps.length} steps for ${transfer.for}, matching Your Path, ${transferUrls} absolute urls`);

const withProgram = await tool("get_enrollment_steps", { student_type: "Transfer", level: "Undergraduate", term: "Winter 2027", program_id: "computer-science-bs" });
const applyWith = withProgram.steps.find((s: { id: string }) => s.id === "apply");
if (applyWith.due_date !== withProgram.program.application_deadline || !applyWith.due_date || !/Computer Science/.test(applyWith.date_source)) throw new Error("get_enrollment_steps: program_id fills in the apply step's deadline");
console.log(`✓ get_enrollment_steps with program_id: apply by ${applyWith.due_date} (${applyWith.date_source})`);

const intl = await tool("get_enrollment_steps", { student_type: "International", level: "Graduate", term: "Fall 2027" });
const firstYear = await tool("get_enrollment_steps", { student_type: "First-year", level: "Undergraduate", term: "Fall 2027" });
const hasI20 = (r: { steps: { id: string }[] }) => r.steps.some((s) => s.id === "i20-visa");
if (!hasI20(intl) || hasI20(firstYear)) throw new Error("get_enrollment_steps: international steps include the I-20; first-year steps don't");
console.log("✓ get_enrollment_steps: international includes the I-20, first-year doesn't");

const wrongType = await toolError("get_enrollment_steps", { student_type: "Transfer", level: "Graduate", term: "Winter 2027" });
if (!/New graduate student, International, or Current student/.test(wrongType)) throw new Error(`invalid type error should list valid types: ${wrongType}`);
const wrongTerm = await toolError("get_enrollment_steps", { student_type: "Transfer", level: "Undergraduate", term: "Fall 2031" });
const wrongLevel = await toolError("get_enrollment_steps", { student_type: "Transfer", level: "Undergraduate", term: "Winter 2027", program_id: "nursing-msn" });
console.log(`✓ errors: ${JSON.stringify(wrongType.slice(0, 60))} | ${JSON.stringify(wrongTerm.slice(0, 50))} | ${JSON.stringify(wrongLevel.slice(0, 50))}`);

const winter = await tool("get_academic_calendar", { term: "Winter 2027" });
allAbsolute("get_academic_calendar", winter);
const days = winter.dates.map((d: { date: string }) => d.date);
if (days.join() !== [...days].sort().join() || !winter.dates.some((d: { key: string }) => d.key === "classes-begin")) throw new Error("get_academic_calendar: the term's dates, in date order");
const intlCalendar = await tool("get_academic_calendar", { term: "Winter 2027", student_type: "International" });
const transferCalendar = await tool("get_academic_calendar", { term: "Winter 2027", student_type: "Transfer" });
const keys = (r: { dates: { key: string }[] }) => r.dates.map((d) => d.key);
if (!keys(intlCalendar).includes("i20-documents") || keys(intlCalendar).includes("fafsa-priority") || keys(transferCalendar).includes("orientation-first-year")) throw new Error("get_academic_calendar: filtered for the student");
console.log(`✓ get_academic_calendar: ${winter.dates.length} dates for Winter 2027, ${intlCalendar.dates.length} for international students`);

if (!prompts.some((p: { name: string }) => p.name === "plan-my-path")) throw new Error("prompts/list: missing plan-my-path");
const planPrompt = (await call("prompts/get", { name: "plan-my-path", arguments: { student_type: "Transfer", level: "Undergraduate", start_term: "Winter 2027", program: "Nursing, BS" } })).messages[0].content.text;
const askPrompt = (await call("prompts/get", { name: "plan-my-path", arguments: {} })).messages[0].content.text;
if (!/get_enrollment_steps/.test(planPrompt) || !/program_id/.test(planPrompt) || !/First ask me my student type and level and start term/.test(askPrompt)) throw new Error("plan-my-path: uses the tools, and asks what's missing");
console.log(`✓ prompts/get plan-my-path: ${JSON.stringify(planPrompt.slice(0, 70))}`);

// Search engines are kept out until indexing is switched on
const options = await handler(new Request("http://localhost:8888/mcp", { method: "OPTIONS" }));
const robots = options.headers.get("X-Robots-Tag");
if (siteConfig.indexing ? robots : robots !== "noindex") throw new Error(`X-Robots-Tag is ${robots} with indexing ${siteConfig.indexing}`);
console.log(`✓ X-Robots-Tag: ${robots ?? "not sent"}`);

console.log("\nAll checks passed.");
