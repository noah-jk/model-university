// Tests for the enrollment rules (content/enrollment/) and their lookups,
// and for the targeted events. Run with: npm test
// (npm run check:content validates the files themselves.)

import { createHash } from "node:crypto";
import { events } from "../src/lib/catalog.ts";
import { academicYearOf, appliesTo, calendar, calendarEntry, calendarFor, calendarTerms, officesFor, stepDueDate, steps, stepsFor, termStart } from "../src/lib/enrollment.ts";
import { ENROLLMENT_BUDGET_KB, enrollmentData } from "../src/features/enrollment-data.ts";
import { STUDENT_TYPES } from "../src/lib/vocab.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};
const ids = (list: { id: string }[]) => list.map((s) => s.id);

// Calendar lookups ------------------------------------------------------------------

check(academicYearOf("Fall 2026") === "2026-27" && academicYearOf("Winter 2027") === "2026-27" && academicYearOf("Fall 2027") === "2027-28", "academic year of a term");
check(calendarTerms.length === 8 && calendarTerms[0] === "Fall 2026" && calendarTerms.at(-1) === "Summer 2028", "calendar covers Fall 2026 to Summer 2028");
check(termStart("Winter 2027") === "2027-01-04", "a term starts on its first day of classes");
check(calendarEntry("fafsa-priority", "Spring 2027")?.year === "2026-27" && calendarEntry("fafsa-priority", "Fall 2027")?.year === "2027-28", "once-a-year dates come from the term's academic year");
check(calendarEntry("classes-begin", "Winter 2027")?.term === "Winter 2027", "per-term dates come from the term");
check(!calendar.some((e) => e.key.includes("application")), "the calendar has no application deadlines");
const winterTransfer = calendarFor("Winter 2027", "Undergraduate", "Transfer");
check(winterTransfer.map((e) => e.date).join() === [...winterTransfer.map((e) => e.date)].sort().join(), "a term's dates are in date order");
check(!winterTransfer.some((e) => e.key === "orientation-first-year" || e.key === "i20-documents"), "transfer students don't get first-year orientation or I-20 dates");
check(!calendarFor("Winter 2027", "Undergraduate", "International").some((e) => e.key === "fafsa-priority"), "international students don't get the FAFSA date");
// Every date a term needs comes before classes begin, and finals come after
for (const term of calendarTerms) {
  const start = termStart(term)!;
  for (const key of ["admission-decisions", "enrollment-deposit", "orientation-first-year", "orientation-transfer", "orientation-graduate", "i20-documents"]) {
    if (calendarEntry(key, term)!.date >= start) throw new Error(`${term}: ${key} should come before classes begin`);
  }
  if (calendarEntry("finals-week", term)!.date <= start) throw new Error(`${term}: finals should come after classes begin`);
}
check(true, "pre-term dates come before classes begin, and finals after, in every term");

// Steps ---------------------------------------------------------------------------

const levelTypes = Object.entries(STUDENT_TYPES).flatMap(([level, types]) => types.map((type) => [level, type] as const));
for (const [level, type] of levelTypes) if (stepsFor(level, type).length < 5) throw new Error(`${type} (${level}) has fewer than 5 steps`);
check(true, `every student type and level has at least 5 steps (${levelTypes.map(([l, t]) => `${t} ${l === "Graduate" ? "grad" : "UG"}: ${stepsFor(l, t).length}`).join(", ")})`);
check(stepsFor("Undergraduate", "First-year").slice(0, 4).map((s) => s.journey).join() === "explore,requestInfo,visit,apply", "prospective students start with the application journey");
check(!stepsFor("Undergraduate", "Current student").some((s) => s.journey), "current students have no journey steps");
check(ids(stepsFor("Undergraduate", "International")).includes("i20-visa") && ids(stepsFor("Graduate", "International")).includes("i20-visa"), "international students get the I-20 step");
check(!ids(stepsFor("Undergraduate", "First-year")).includes("i20-visa"), "first-year students don't");
check(ids(stepsFor("Graduate", "New graduate student")).includes("grad-apply") && !ids(stepsFor("Graduate", "New graduate student")).includes("apply"), "graduate students get the graduate versions of steps");
check(new Set(ids(steps)).size === steps.length, "step ids are unique");

const step = (id: string) => steps.find((s) => s.id === id)!;
check(stepDueDate(step("fafsa"), "Fall 2027") === "2027-02-15", "due date from a once-a-year calendar entry");
check(stepDueDate(step("orientation-transfer"), "Winter 2027") === calendarEntry("orientation-transfer", "Winter 2027")!.date, "due date from a term's calendar entry");
check(stepDueDate(step("housing"), "Fall 2027") === "2027-07-24", "due date counted back from the start of the term");
check(stepDueDate(step("apply"), "Fall 2027") === undefined, "program deadlines have no date without a program");

// Offices ------------------------------------------------------------------------

check(officesFor("Undergraduate", "International").some((o) => o.service === "international-student-services"), "international students get International Student Services");
check(!officesFor("Undergraduate", "First-year").some((o) => o.service === "international-student-services"), "first-year students don't");
check(officesFor("Undergraduate", "Returning adult").some((o) => o.service === "veterans-services"), "returning adults get Veterans Services as an office");

// Events -------------------------------------------------------------------------

// The events from before targeting, unchanged except for their new levels and
// student_types. If you change an existing event on purpose, update this hash.
const NEW_TITLES = new Set(["International Student Admissions Webinar", "Transfer Credit Drop-in", "Returning to College: Information Session for Adult Learners", "First-Year Admissions Q&A", "Graduate Funding and Assistantships Webinar", "Registration Help Drop-in"]);
const original = events
  .filter((e) => !NEW_TITLES.has(e.title))
  .map(({ levels, student_types, ...rest }) => rest)
  .sort((a, b) => a.id.localeCompare(b.id));
check(original.length === 64 && createHash("sha256").update(JSON.stringify(original)).digest("hex").startsWith("e623052554093d85"), "existing events are unchanged by targeting");
for (const [level, type] of levelTypes) {
  if (!events.some((e) => appliesTo(e, level, type) && e.student_types)) throw new Error(`no targeted events for ${type} (${level})`);
}
check(true, "every student type and level has targeted events");

// Browser data ---------------------------------------------------------------------

const size = enrollmentData().length;
check(size < ENROLLMENT_BUDGET_KB * 1024, `enrollment.json: ${(size / 1024).toFixed(0)} KB, under the ${ENROLLMENT_BUDGET_KB} KB budget`);

console.log("\nEnrollment checks passed.");
