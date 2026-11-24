// Tests for program pages (#59, #60): every program gets its highlights,
// story, curriculum, FAQs, careers, and valid structured data, all from
// catalog data. Run with: npm test

import * as catalog from "../src/lib/catalog.ts";
import { curriculum, nextDeadline, openStartDates, programFaqs, programJsonLd, startDates, STRIP_TERMS, timeToComplete } from "../src/lib/program-page.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

const { programs } = catalog;
const program = (id: string) => programs.find((p) => p.id === id)!;

check(programs.every((p) => catalog.storyOf(p)?.highlights.length === 3 && catalog.storyOf(p).story.quote), "every program has three highlights and a student story");
check(programs.every((p) => !/!/.test(JSON.stringify(catalog.storyOf(p)))), "stories and highlights have no exclamation points");
const grad = programs.filter((p) => ["Master's", "Doctorate", "Certificate"].includes(p.level));
check(grad.every((p) => catalog.storyOf(p).story.photo.startsWith("profile-adult")) && programs.filter((p) => !grad.includes(p)).every((p) => catalog.storyOf(p).story.photo.startsWith("profile-student")), "graduate stories use adult portraits, undergraduate ones student portraits");
const nameOfPhoto = new Map<string, string>();
check(programs.every((p) => {
  const { photo, name } = catalog.storyOf(p).story;
  if (nameOfPhoto.has(photo) && nameOfPhoto.get(photo) !== name) return false;
  nameOfPhoto.set(photo, name);
  return true;
}), "each portrait always has the same name");

check(programs.every((p) => curriculum(p).length > 0 && curriculum(p).every((s) => s.courses.length <= 4)), "every program has a curriculum map of up to four courses a stage");
const msStages = curriculum(program("computer-science-ms"));
check(msStages[0].label === "Foundations" && msStages[0].courses.every((c) => / 5\d\d$/.test(c.code)), "graduate curriculum starts with 500-level courses");
check(programs.every((p) => programFaqs(p).length === 5 && programFaqs(p).every((f) => f.question.endsWith("?") && f.answer.length > 20)), "every program has five answered FAQs");
check(programFaqs(program("data-science-minor"))[1].answer.includes("declared a bachelor's major"), "a minor's start answer says it's added to a major");

check(timeToComplete("4 years") === "P4Y" && timeToComplete("1–2 years") === "P2Y" && timeToComplete("9–12 months") === "P12M" && timeToComplete("Alongside a bachelor's") === undefined, "timeToComplete: the longest time, in ISO 8601");
const now = new Date("2026-11-02T12:00:00-08:00");
const bs = program("nursing-bs");
check(nextDeadline(bs, now)?.date === "2027-01-15" && nextDeadline(bs, now)?.term === "Spring 2027", "nextDeadline: the soonest one that hasn't passed");
check(nextDeadline(program("data-science-minor"), now) === undefined, "nextDeadline: minors have none");

const ld = programJsonLd(bs, "https://example.edu");
check(ld["@type"] === "EducationalOccupationalProgram" && ld.url === "https://example.edu/academics/programs/nursing-bs/" && ld.occupationalCategory.some((o) => o.codeValue === "29-1141"), "JSON-LD: the program, its absolute url, and its occupations' SOC codes");
check(!/salary|wage/i.test(JSON.stringify(ld)), "JSON-LD: no made-up salaries");
check(programs.every((p) => catalog.careersForProgram(p).length > 0), "every program has careers to show");

// The start-dates strip (#75)
const progs = catalog.programs;
const stripNow = new Date("2026-11-24T12:00:00Z");
const strip = (p: (typeof progs)[number]) => startDates(p, stripNow);
check(progs.every((p) => strip(p).every((d) => p.start_terms.some((t) => d.term.startsWith(t)))), "startDates: only terms the program starts in");
check(progs.every((p) => strip(p).every((d, i, all) => i === 0 || all[i - 1].starts < d.starts)), "startDates: in date order");
check(progs.every((p) => strip(p).every((d) => (d.deadline ? d.applyBy.startsWith("Apply by ") && d.deadline < d.starts : d.applyBy === "No set deadline"))), "startDates: each term's deadline comes before it starts, or says there's none");
check(progs.every((p) => { const n = openStartDates(strip(p), "2026-11-24").length; return n >= 1 && n <= STRIP_TERMS; }), `openStartDates: every program shows 1 to ${STRIP_TERMS} terms`);
const fallOnly = progs.find((p) => p.start_terms.length === 1 && p.start_terms[0] === "Fall")!;
check(openStartDates(strip(fallOnly), "2026-11-24").map((d) => d.term).join() === "Fall 2027,Fall 2028", "openStartDates: only terms within two years (a Fall-only program shows Fall 2027 and Fall 2028)");
const sample = progs.find((p) => p.application_deadlines.some((d) => d.term === "Winter" && d.deadline === "October 15"))!;
const openNow = openStartDates(strip(sample), "2026-11-24");
check(!openNow.some((d) => d.term === "Winter 2027"), "openStartDates: a term whose deadline has passed is left out (Winter 2027, due October 15)");
check(openNow.every((d) => !d.deadline || d.deadline >= "2026-11-24") && openNow.every((d) => d.starts > "2026-11-24"), "openStartDates: only terms still open and not yet started");
check(openStartDates(strip(sample), "2027-01-16")[0].term !== openNow[0].term, "openStartDates: the next term moves on as days pass");

console.log("\nProgram page checks passed.");
