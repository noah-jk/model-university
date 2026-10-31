// Tests for Your Path: who the student is (profile), what they need to do
// (plan), every date once (timeline), and the handoffs' words. No browser needed.
// Run with: npm test

import * as catalog from "../src/lib/catalog.ts";
import { rules } from "../src/lib/enrollment.ts";
import { buildIndex } from "../src/lib/workbench/index-data.ts";
import { deadlineDate } from "../src/lib/workbench/derive.ts";
import { justApplied, pathIcs, pathList, pathTimeline, planFor, planSteps, programsByPlan } from "../src/lib/workbench/plan.ts";
import { describeStudents, resolveProfile, type Signals } from "../src/lib/workbench/profile.ts";
import { ADMITTED_GROUP, admissionsCopy, admittedLead, aidLine, APPLIED, homeCopy, nextLine, pathLink, programSaved, requestInfoCopy, tuitionCopy, typeCopy, VISIT_COPY } from "../src/lib/workbench/handoffs.ts";
import type { PlanChoices, Workbench, WorkbenchItem } from "../src/lib/workbench/types.ts";

const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
  console.log(`✓ ${message}`);
};

const index = buildIndex();
const terms = ["Winter 2027", "Spring 2027", "Summer 2027", "Fall 2027", "Winter 2028"];
// A fixed "today", well before the Winter 2027 dates
const now = new Date("2026-10-16T12:00:00-07:00");

const program = (id: string): WorkbenchItem => ({ id: `p-${id}`, kind: "program", ref: id, source: "saved", addedAt: "", interest: { level: catalog.programs.find((p) => p.id === id)!.level } });
const service = (id: string): WorkbenchItem => ({ id: `s-${id}`, kind: "service", ref: id, source: "saved", addedAt: "" });
const event = (id: string): WorkbenchItem => ({ id: `e-${id}`, kind: "event", ref: id, source: "saved", addedAt: "" });
const workbenchWith = (items: WorkbenchItem[], profile: PlanChoices = {}, extra: Partial<Workbench> = {}): Workbench => ({ version: 2, items, profile, dismissed: [], completed: [], hiddenHandoffs: [], updatedAt: "", ...extra });
const signals = (s: Partial<Signals> = {}): Signals => ({ views: [], items: [], ...s });
const resolve = (choices: PlanChoices, s: Partial<Signals> = {}) => resolveProfile(choices, signals(s), terms);

// Programs to save: undergraduate and graduate, each starting in Winter
const startsIn = (level: string, term: string) => catalog.programs.filter((p) => p.level === level && (p.start_terms as string[]).includes(term)).map((p) => p.id);
const [bachelors, bachelors2] = startsIn("Bachelor's", "Winter");
const [masters] = startsIn("Master's", "Winter");

// Profile -----------------------------------------------------------------------

const blank = resolve({});
check(!blank.ready && !blank.level.value && !blank.studentType.value, "profile: with no signals, level and type stay blank");
check(blank.startTerm.value === "Winter 2027" && blank.startTerm.source === "inferred", "profile: start term defaults to the next term");
check(resolve({}, { requestInfo: { startTerm: "Fall 2027" } }).startTerm.value === "Fall 2027", "profile: start term from the request-info form");
check(resolve({}, { requestInfo: { startTerm: "Fall 2020" } }).startTerm.value === "Winter 2027", "profile: a past form term is ignored");
check(resolve({ startTerm: "Spring 2027" }, { requestInfo: { startTerm: "Fall 2027" } }).startTerm.source === "chosen", "profile: a chosen term wins");

const oneView = resolve({}, { views: [{ type: "page", id: "admissions/transfer" }] });
check(!oneView.studentType.value, "profile: one view isn't a strong enough signal");
const twoViews = resolve({}, { views: [{ type: "page", id: "admissions/transfer" }, { type: "service", id: "transfer-center" }] });
check(twoViews.studentType.value === "Transfer" && twoViews.level.value === "Undergraduate" && twoViews.ready, "profile: two transfer views suggest Transfer, which settles Undergraduate");
check(twoViews.studentType.why && twoViews.level.why, "profile: each suggestion says why");
const saved = resolve({}, { items: [service("international-student-services")] });
check(saved.studentType.value === "International" && !saved.level.value && !saved.ready, "profile: one save suggests International, which fits both levels");
check(!resolve({}, { views: [{ type: "service", id: "veterans-services" }, { type: "service", id: "veterans-services" }] }).studentType.value, "profile: Veterans Services doesn't suggest a type");

check(resolve({}, { requestInfo: { level: "Master's" } }).level.value === "Graduate", "profile: level from the request-info form");
check(resolve({}, { items: [program(masters)] }).level.value === "Graduate", "profile: level from a saved program");
const mixed = resolve({}, { items: [program(bachelors), program(masters)] });
check(mixed.level.mixed && !mixed.level.value && !mixed.ready && mixed.level.why, "profile: saved programs at both levels ask instead of guessing");
check(resolve({ level: "Graduate" }, { items: [program(bachelors), program(masters)] }).level.source === "chosen", "profile: choosing a level settles mixed programs");
check(!resolve({}, { views: [{ type: "program", id: "a", level: "Bachelor's" }, { type: "program", id: "b", level: "Master's" }] }).level.value, "profile: viewed programs at both levels ask too");

const chosen = resolve({ level: "Graduate", studentType: "Transfer" }, { views: [{ type: "page", id: "admissions/transfer" }, { type: "page", id: "admissions/transfer" }] });
check(chosen.level.value === "Graduate" && !chosen.studentType.value, "profile: a type that doesn't fit the level is dropped, not suggested");
check(describeStudents("Undergraduate", "Transfer") === "transfer undergraduates" && describeStudents("Graduate", "International") === "international graduate students", "profile: describes the students in words");

// Plan ----------------------------------------------------------------------------

const transfer = resolve({ level: "Undergraduate", studentType: "Transfer" });
const noProgram = planFor(transfer, rules, index, workbenchWith([]), [], now)!;
const apply = noProgram.steps.find((s) => s.step.id === "apply")!;
check(noProgram.steps.map((s) => s.step.id).join() === rules.stepsFor("Undergraduate", "Transfer").map((s) => s.id).join(), "plan: the steps for the student, in order");
check(!apply.date && apply.note === "Your deadline depends on your program. Save one to see it.", "plan: with no saved program, the apply step says why it has no date");
check(noProgram.steps.filter((s) => s.next).length === 1 && noProgram.steps[0].next, "plan: exactly one next step, the first not done");
check(noProgram.offices.some((o) => o.id === "transfer-center") && noProgram.offices.every((o) => o.reason), "plan: offices for the student, each with a reason");
check(noProgram.events.length > 0 && noProgram.events.every((e) => appliesToTransfer(e.event)), "plan: suggested events are targeted at the student");
function appliesToTransfer(e: { student_types?: string[] }) {
  return e.student_types?.includes("Transfer");
}

const withPrograms = planFor(transfer, rules, index, workbenchWith([program(bachelors), program(bachelors2), program(masters)]), [], now)!;
const winterDeadlines = [bachelors, bachelors2].map((id) => deadlineDate(index.program[id].application_deadlines.find((d) => d.term === "Winter")!.deadline, "Winter 2027")).sort();
const applyWith = withPrograms.steps.find((s) => s.step.id === "apply")!;
check(applyWith.date === winterDeadlines[0] && /deadline$/.test(applyWith.dateSource!), "plan: the apply step uses the earliest saved deadline at the plan's level");
const { inPlan, outside } = programsByPlan(workbenchWith([program(bachelors), program(masters)]), index, "Undergraduate");
check(inPlan.length === 1 && outside.length === 1 && outside[0].ref === masters, "plan: programs at the other level stay outside the plan");
// No bachelor's program starts in summer
const summer = planFor(resolve({ level: "Undergraduate", studentType: "Transfer", startTerm: "Summer 2027" }), rules, index, workbenchWith([program(bachelors)]), [], now)!;
check(/None of your saved programs start in Summer 2027/.test(summer.steps.find((s) => s.step.id === "apply")!.note!), "plan: says so when no saved program starts in the term");

const fafsa = withPrograms.steps.find((s) => s.step.id === "fafsa")!;
check(fafsa.date === rules.calendarEntry("fafsa-priority", "Winter 2027")!.date && fafsa.dateSource === "academic calendar", "plan: calendar dates come from the start term, labeled with their source");
check(!withPrograms.calendar.some((e) => e.key === "fafsa-priority" || e.key === "tuition-due"), "plan: calendar dates a step shows aren't listed again");

// Completed steps are kept by step id, so they stay done when the term changes
const done = workbenchWith([], {}, { completed: ["explore-programs", "fafsa"] });
const winter = planFor(transfer, rules, index, done, [], now)!;
const fall = planFor(resolve({ level: "Undergraduate", studentType: "Transfer", startTerm: "Fall 2027" }), rules, index, done, [], now)!;
const statusOf = (p: typeof winter, id: string) => p.steps.find((s) => s.step.id === id)!.status;
check(statusOf(winter, "fafsa") === "done" && statusOf(fall, "fafsa") === "done" && winter.done === 2 && fall.done === 2, "plan: completed steps stay done when the term changes");
check(winter.steps.find((s) => s.next)!.step.id === "request-info", "plan: next skips completed steps");
const journey = planFor(transfer, rules, index, workbenchWith([]), ["explore", "requestInfo"], now)!;
check(journey.steps[0].doneByJourney && journey.steps[1].doneByJourney && journey.steps.find((s) => s.next)!.step.id === "visit-campus", "plan: journey steps done in this tab count as done");
const later = planFor(transfer, rules, index, workbenchWith([]), [], new Date("2027-03-01T12:00:00-08:00"))!;
check(statusOf(later, "fafsa") === "overdue", "plan: an undone step past its date is overdue");

const dismissed = planFor(transfer, rules, index, workbenchWith([], {}, { dismissed: ["office:transfer-center", `event:${noProgram.events[0].id}`] }), [], now)!;
check(!dismissed.offices.some((o) => o.id === "transfer-center") && !dismissed.events.some((e) => e.id === noProgram.events[0].id), "plan: dismissed offices and events are left out");
const savedEvent = planFor(transfer, rules, index, workbenchWith([event(noProgram.events[0].id)]), [], now)!;
check(!savedEvent.events.some((e) => e.id === noProgram.events[0].id), "plan: saved events aren't suggested again");
check(planFor(blank, rules, index, workbenchWith([]), [], now) === undefined, "plan: no plan until level and type are known");

// The steps alone (what the header uses on every page) agree with the full plan
const stepsOnly = planSteps(rules, "Undergraduate", "Transfer", "Winter 2027", { completed: ["explore-programs"], journeyDone: [], programDeadlines: [], now });
check(stepsOnly.find((s) => s.next)!.step.id === winter.steps.find((s) => s.next)!.step.id, "plan: steps alone give the same next step");

// Timeline ----------------------------------------------------------------------

const timelineWb = workbenchWith([program(bachelors), program(bachelors2), program(masters), event(noProgram.events[0].id)]);
const timelinePlan = planFor(transfer, rules, index, timelineWb, [], now)!;
const entries = pathTimeline(timelinePlan, rules, index, timelineWb, "Winter 2027", "Undergraduate", now);
check(entries.map((e) => e.date).join() === [...entries.map((e) => e.date)].sort().join(), "timeline: in date order");
const titlesByDate = entries.map((e) => `${e.date} ${e.title}`);
check(new Set(titlesByDate).size === titlesByDate.length, "timeline: no entry twice");
check(entries.filter((e) => e.date === rules.calendarEntry("fafsa-priority", "Winter 2027")!.date && /FAFSA/i.test(e.title)).length === 1, "timeline: a calendar date a step shows appears once, as the step");
check(entries.some((e) => e.id === "step:apply" && e.date === winterDeadlines[0]) && !entries.some((e) => e.id === `program:${applyWith.programRef}`), "timeline: the deadline the apply step uses appears once, as the step");
check(entries.some((e) => e.id === `program:${bachelors2}`) && !entries.some((e) => e.id === `program:${masters}`), "timeline: other saved deadlines at this level are included, the other level's aren't");
check(entries.some((e) => e.id === `event:${noProgram.events[0].id}` && e.source === "saved event"), "timeline: saved events are included");
check(entries.every((e) => e.source), "timeline: every entry says where its date comes from");
check(entries.filter((e) => e.next).length === 1 && !entries.find((e) => e.next)!.past, "timeline: exactly one Next, and it's upcoming");
check(pathTimeline(undefined, rules, index, workbenchWith([program(bachelors)]), "Winter 2027", undefined, now).length === 1, "timeline: without a plan, saved programs' deadlines");

const finals = entries.find((e) => e.end)!;
const ics = pathIcs(finals, "Cascadia State; University", "https://example.edu");
check(ics.includes("DTSTART;VALUE=DATE:") && ics.includes(`DTEND;VALUE=DATE:`) && ics.includes("Cascadia State\\; University"), "calendar file: all-day range, with text escaped");
const timed = entries.find((e) => e.start)!;
check(/DTSTART:\d{8}T\d{6}Z/.test(pathIcs(timed, "Cascadia", "https://example.edu")), "calendar file: events keep their times");


// Request-info student type and the visit ----------------------------------------------

const fromForm = resolve({}, { requestInfo: { level: "Bachelor's", studentType: "Transfer" } });
check(fromForm.studentType.value === "Transfer" && fromForm.studentType.source === "inferred" && /request-info form/.test(fromForm.studentType.why!), "profile: the form's student type is suggested, and says why");
check(resolve({ studentType: "First-year" }, { requestInfo: { level: "Bachelor's", studentType: "Transfer" } }).studentType.source === "chosen", "profile: a chosen type wins over the form");
check(!resolve({}, { requestInfo: { level: "Master's", studentType: "Transfer" } }).studentType.value, "profile: a form type that doesn't fit the level is ignored");

const visitWb = workbenchWith([], {}, { visit: { date: "2026-11-20" } });
const visitEntry = pathTimeline(undefined, rules, index, visitWb, "Winter 2027", undefined, now).find((e) => e.id === "visit");
check(visitEntry?.title === "Your campus visit" && visitEntry.date === "2026-11-20" && visitEntry.source === "your visit request", "timeline: the visit from the visit form");

// Handoffs ---------------------------------------------------------------------------------

const startSummary = { ready: false, startTerm: "Winter 2027" };
const transferSteps = planSteps(rules, "Undergraduate", "Transfer", "Winter 2027", { completed: ["explore-programs"], journeyDone: [], programDeadlines: [], now });
const going = { ready: true, level: "Undergraduate", studentType: "Transfer", startTerm: "Winter 2027", steps: transferSteps };

check(homeCopy().heading === "Skip the scavenger hunt" && homeCopy(startSummary).action.label === "Plan your path", "handoff home: start");
check(homeCopy(going).text === "Next: Request information." && homeCopy(going).action.label === "Continue your path", `handoff home: continue (${homeCopy(going).text})`);
check(admissionsCopy(going).text === "Your plan is for transfer undergraduates starting Winter 2027. Next: Request information.", "handoff admissions: continue says who the plan is for, and what's next");
check(typeCopy("transfer").action.label === "See transfer steps" && typeCopy("transfer").action.href === "/your-path/#plan&type=Transfer", "handoff transfer: start links with the type");
check(typeCopy("transfer", going).action.label === "Continue your path", "handoff transfer: continue when the type matches");
check(typeCopy("international", going).action.label === "Switch your path to international steps" && !/level=/.test(typeCopy("international", going).action.href), "handoff international: switch, setting only the type");
check(typeCopy("graduate").action.href === "/your-path/#plan&type=New%20graduate%20student&level=Graduate", "handoff graduate: sets type and level");
check(pathLink() === "/your-path/#plan", "pathLink with nothing chosen");

// Aid: dates need the calendar (rules from enrollment.ts have it)
check(aidLine(transferSteps) === "The FAFSA priority date has passed. File as soon as you can; aid is still available.", `handoff tuition: passed FAFSA date (${aidLine(transferSteps)})`);
const fallSteps = planSteps(rules, "Undergraduate", "Transfer", "Fall 2027", { completed: [], journeyDone: [], programDeadlines: [], now });
check(/^Next aid step on your path: Submit your FAFSA, by Feb 15, 2027\.$/.test(aidLine(fallSteps)), `handoff tuition: next aid step with its date (${aidLine(fallSteps)})`);
const intlSteps = planSteps(rules, "Graduate", "International", "Fall 2027", { completed: [], journeyDone: [], programDeadlines: [], now });
check(/Send financial documents/.test(aidLine(intlSteps)), "handoff tuition: international students get financial documents, not the FAFSA");
const aidDone = planSteps(rules, "Undergraduate", "Transfer", "Fall 2027", { completed: ["fafsa"], journeyDone: [], programDeadlines: [], now });
check(/^Your aid steps are done\. Next: /.test(aidLine(aidDone)), "handoff tuition: aid steps done");

const ugProgram = { level: "Undergraduate", startTerms: ["Fall", "Winter"] };
check(/^Saved\. Choose your student type/.test(programSaved(ugProgram, startSummary)), "handoff program: no plan yet");
check(programSaved(ugProgram, going) === "Saved. Your Path now shows the Winter 2027 deadline for this program.", "handoff program: in the plan");
check(/doesn't start in Spring 2027/.test(programSaved(ugProgram, { ...going, startTerm: "Spring 2027" })), "handoff program: doesn't start in the term");
check(/graduate program, so it's in your saved items but not part of your undergraduate plan/.test(programSaved({ level: "Graduate", startTerms: ["Fall"] }, going)), "handoff program: other level");
check(requestInfoCopy(going).text === "Your path is ready, with every step for transfer undergraduates starting Winter 2027." && requestInfoCopy(startSummary).action.label === "Finish your path", "handoff request info: ready, or finish");
const allCopy = [homeCopy(), homeCopy(going), admissionsCopy(), tuitionCopy(), typeCopy("graduate", going), requestInfoCopy(going), VISIT_COPY].flatMap((c): string[] => [c.text, c.action.label, "heading" in c ? String(c.heading) : ""]);
check(!allCopy.some((t) => t.includes("!") || /learn more|click here/i.test(t)), "handoff copy: no exclamation points or vague links");
check(!allCopy.some((t) => /\d+ (of \d+ )?steps?\b/.test(t)), "handoff copy: no step counts (#25)");


// One plan list (#30) --------------------------------------------------------------------

const listWb = workbenchWith([program(bachelors), program(bachelors2), event(noProgram.events[0].id)], {}, { completed: ["explore-programs"] });
const listPlan = planFor(transfer, rules, index, listWb, [], now)!;
const listEntries = pathTimeline(listPlan, rules, index, listWb, "Winter 2027", "Undergraduate", now);
const { rows: before, folded, admitted } = pathList(listPlan, listEntries);
// The two groups (#47) read as one list, in order
const rows = [...before, ...admitted];
const all = [...folded, ...rows];
const stepIds = all.filter((r) => r.kind === "step").map((r) => (r.kind === "step" ? r.step.step.id : ""));
check(stepIds.slice().sort().join() === listPlan.steps.map((s) => s.step.id).sort().join(), "plan list: every step once");
const unfoldedSteps = rows.filter((r) => r.kind === "step").map((r) => (r.kind === "step" ? r.step.step.id : ""));
check(unfoldedSteps.join() === listPlan.steps.filter((s) => s.status !== "done").map((s) => s.step.id).join(), "plan list: steps keep their rule order");
const dateRows = all.filter((r) => r.kind === "date");
check(dateRows.length === listEntries.filter((e) => !e.id.startsWith("step:")).length && !dateRows.some((r) => r.entry.id.startsWith("step:")), "plan list: each other date once, and step dates only as steps");
check(folded.some((r) => r.kind === "step" && r.step.step.id === "explore-programs") && !rows.some((r) => r.kind === "step" && r.step.status === "done"), "plan list: done steps fold away");
check(rows.some((r) => r.kind === "step" && r.step.status === "overdue"), "plan list: overdue steps stay in the list");
check(rows[0].kind === "step" && rows[0].step.next, "plan list: opens on the next step");
// Dates between two steps sit between them
const keyOf = (r: (typeof rows)[number]) => (r.kind === "step" ? r.step.date ?? "" : r.entry.date);
const classes = rows.findIndex((r) => r.kind === "date" && /Classes begin/.test(r.entry.title));
const tuition = rows.findIndex((r) => r.kind === "step" && r.step.step.id === "pay-tuition");
check(classes > -1 && tuition > classes && keyOf(rows[tuition]) >= keyOf(rows[classes]), "plan list: other dates fit in among the steps by date");
check(pathList(undefined, pathTimeline(undefined, rules, index, listWb, "Winter 2027", undefined, now)).rows.every((r) => r.kind === "date"), "plan list: without a plan, only saved dates");

// Steps for admitted students (#47) -----------------------------------------------------

const phaseOf = (r: (typeof rows)[number]) => (r.kind === "step" ? r.step.step.phase : r.entry.phase);
check(before.every((r) => phaseOf(r) !== "admitted") && admitted.length > 0 && admitted.every((r) => phaseOf(r) === "admitted"), "admitted group: steps and dates for admitted students are kept apart");
check(before.some((r) => r.kind === "step" && r.step.step.id === "fafsa") && admitted.some((r) => r.kind === "step" && r.step.step.id === "enrollment-deposit"), "admitted group: FAFSA stays before a decision; the deposit is for admitted students");
check(admitted.some((r) => r.kind === "date" && /Classes begin/.test(r.entry.title)) && before.some((r) => r.kind === "date" && /decision/i.test(r.entry.title)), "admitted group: institution dates go with it, admission decisions don't");
check(!pathList(listPlan, listEntries).admittedOpen, "admitted group: closed before it's reached");
const applyDone = ["explore-programs", "request-info", "visit-campus", "apply", "send-transcripts", "fafsa"];
const reachedWb = workbenchWith(listWb.items, {}, { completed: applyDone });
const reachedPlan = planFor(transfer, rules, index, reachedWb, [], now)!;
const reached = pathList(reachedPlan, pathTimeline(reachedPlan, rules, index, reachedWb, "Winter 2027", "Undergraduate", now));
check(reached.admittedOpen && !reached.rows.some((r) => r.kind === "step"), "admitted group: open once the next step is in it");
const skippedWb = workbenchWith(listWb.items, {}, { completed: ["housing", "credit-evaluation"] });
const skippedPlan = planFor(transfer, rules, index, skippedWb, [], now)!;
check(pathList(skippedPlan, pathTimeline(skippedPlan, rules, index, skippedWb, "Winter 2027", "Undergraduate", now)).admittedOpen, "admitted group: open once one of its steps is done");
const current = planFor(resolve({ level: "Undergraduate", studentType: "Current student", startTerm: "Winter 2027" }), rules, index, workbenchWith([]), [], now)!;
const currentList = pathList(current, pathTimeline(current, rules, index, workbenchWith([]), "Winter 2027", "Undergraduate", now));
check(currentList.admitted.length === 0 && currentList.rows.some((r) => r.kind === "step"), "admitted group: current students keep one list");
check(admittedLead(["Apply for housing", "Confirm your place", "Pay tuition"]) === "After you're admitted: apply for housing, confirm your place, and pay tuition." && ADMITTED_GROUP === "For admitted students", "admitted group: its lead names the steps without counting them");

// Just after applying
const stepsWith = (completed: string[]) => planSteps(rules, "Undergraduate", "First-year", "Fall 2027", { completed, journeyDone: [], programDeadlines: [], now });
const beforeApply = ["explore-programs", "request-info", "visit-campus"];
check(!justApplied(stepsWith(beforeApply)), "applied: not before applying");
const applied = justApplied(stepsWith([...beforeApply, "apply"]));
check(applied?.next?.step.id === "fafsa", "applied: just after applying, with the next step");
check(!justApplied(stepsWith([...beforeApply, "apply", "fafsa"])), "applied: gone once a later step is done");
check(justApplied(planSteps(rules, "Undergraduate", "First-year", "Fall 2027", { completed: beforeApply, journeyDone: ["apply"], programDeadlines: [], now })) !== undefined, "applied: the Apply link counts too");
check(/^You've applied\. Next: Submit your FAFSA/.test(nextLine(stepsWith([...beforeApply, "apply"]))) && /^Next: /.test(nextLine(stepsWith(beforeApply))), "applied: handoffs say so, then go back to just the next step");
check(![APPLIED.heading, APPLIED.text, APPLIED.announce].some((t) => t.includes("!")), "applied: no exclamation points");
console.log("\nYour Path checks passed.");
