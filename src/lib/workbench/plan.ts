// Your Path's plan: computed fresh from the student's profile, the enrollment
// rules, and what they've saved. Nothing here is stored; only the student's
// choices are (completed steps, dismissals, saved items). No DOM code, so the
// page, the header, tests, and the MCP server (#19) share it.

import siteConfig from "../../../site.config.ts";
import { appliesTo, type RulesLookup } from "../enrollment-rules.ts";
import type { CalendarEntry, EnrollmentStep } from "../schemas.ts";
import { LEVEL_OF_PROGRAM } from "../vocab.ts";
import { deadlineDate, termName } from "./derive.ts";
import { describeStudents, type ResolvedProfile } from "./profile.ts";
import type { IndexEvent, Workbench, WorkbenchIndex, WorkbenchItem } from "./types.ts";

export type JourneyStepName = "explore" | "requestInfo" | "visit" | "apply";

export type PlanStep = {
  step: EnrollmentStep;
  date?: string; // YYYY-MM-DD, when the step has a fixed date
  dateSource?: string; // where the date comes from: "academic calendar", "Nursing, MSN deadline"
  calendarKey?: string; // the calendar entry the date came from, so the timeline shows it once
  programRef?: string; // the saved program whose deadline it is
  note?: string; // e.g. "Your deadline depends on your program. Save one to see it."
  status: "done" | "overdue" | "upcoming";
  next: boolean;
  // Done through the application journey in this tab, so it can't be unchecked here
  doneByJourney: boolean;
};
export type PlanOffice = { id: string; name: string; url: string; reason: string };
export type PlanEvent = { id: string; event: IndexEvent; reason: string };
export type Plan = { steps: PlanStep[]; offices: PlanOffice[]; events: PlanEvent[]; calendar: CalendarEntry[]; reason: string; done: number };

const campusToday = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
const level = (programLevel: string) => LEVEL_OF_PROGRAM[programLevel as keyof typeof LEVEL_OF_PROGRAM];

// Saved programs at the plan's level, and those at the other level, which
// stay in Items marked "Not part of this plan"
export function programsByPlan(workbench: Workbench, index: WorkbenchIndex, planLevel: string | undefined) {
  const saved = workbench.items.filter((i) => i.kind === "program" && i.ref && index.program[i.ref]);
  const inPlan = (i: WorkbenchItem) => !planLevel || level(index.program[i.ref!].level) === planLevel;
  return { inPlan: saved.filter(inPlan), outside: saved.filter((i) => !inPlan(i)) };
}

// A saved program's application deadline for the start term, if it starts then
function programDeadline(item: WorkbenchItem, index: WorkbenchIndex, term: string) {
  const program = index.program[item.ref!];
  const deadline = program.start_terms.includes(termName(term)) && program.application_deadlines.find((d) => d.term === termName(term));
  const date = deadline && deadlineDate(deadline.deadline, term);
  return date ? { date, name: program.name, ref: item.ref! } : undefined;
}

export type StepInputs = {
  completed: string[];
  journeyDone: JourneyStepName[];
  // Deadlines of saved programs at this level for the term, if any
  programDeadlines: { date: string; name: string; ref: string }[];
  // True when programs are saved but none start in the term
  noProgramInTerm?: boolean;
  now?: Date;
};

// The steps for one kind of student and start term, with dates and status.
// Needs only the rules, so the MCP server can use it with nothing saved.
export function planSteps(rules: RulesLookup, levelName: string, type: string, term: string, inputs: StepInputs): PlanStep[] {
  const today = campusToday(inputs.now ?? new Date());
  const completed = new Set(inputs.completed);
  const earliest = [...inputs.programDeadlines].sort((a, b) => a.date.localeCompare(b.date))[0];
  let nextFound = false;
  return rules.stepsFor(levelName, type).map((step) => {
    const due = step.due;
    const fromProgram = due && "program_deadline" in due;
    const calendarKey = due && "calendar" in due ? due.calendar : undefined;
    const date = fromProgram ? earliest?.date : rules.stepDueDate(step, term);
    const dateSource = fromProgram
      ? earliest && `${earliest.name} deadline`
      : calendarKey
        ? "academic calendar"
        : due && "before_term_start_days" in due
          ? `about ${Math.round(due.before_term_start_days / 7)} weeks before classes begin`
          : undefined;
    const note = fromProgram && !earliest
      ? inputs.noProgramInTerm
        ? `None of your saved programs start in ${term}, so there's no deadline to show. Save one that does, or choose another start term.`
        : "Your deadline depends on your program. Save one to see it."
      : undefined;
    const doneByJourney = Boolean(step.journey && inputs.journeyDone.includes(step.journey));
    const done = completed.has(step.id) || doneByJourney;
    const status: PlanStep["status"] = done ? "done" : date && date < today ? "overdue" : "upcoming";
    const next = !done && !nextFound;
    if (next) nextFound = true;
    return {
      step,
      status,
      next,
      doneByJourney,
      ...(date && { date }),
      ...(dateSource && { dateSource }),
      ...(calendarKey && { calendarKey }),
      ...(fromProgram && earliest && { programRef: earliest.ref }),
      ...(note && { note }),
    };
  });
}

export function planFor(profile: ResolvedProfile, rules: RulesLookup, index: WorkbenchIndex, workbench: Workbench, journeyDone: JourneyStepName[], now = new Date()): Plan | undefined {
  if (!profile.ready) return undefined;
  const levelName = profile.level.value!;
  const type = profile.studentType.value!;
  const term = profile.startTerm.value;
  const dismissed = new Set(workbench.dismissed);
  const who = describeStudents(levelName, type);
  const reason = `For ${who} starting ${term}`;

  const { inPlan } = programsByPlan(workbench, index, levelName);
  const programDeadlines = inPlan.map((i) => programDeadline(i, index, term)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const steps = planSteps(rules, levelName, type, term, { completed: workbench.completed, journeyDone, programDeadlines, noProgramInTerm: inPlan.length > 0 && programDeadlines.length === 0, now });

  const offices = rules
    .officesFor(levelName, type)
    .filter((o) => !dismissed.has(`office:${o.service}`) && index.service[o.service])
    .map((o) => ({ id: o.service, name: index.service[o.service].name, url: index.service[o.service].url, reason: o.reason }));

  // Upcoming events meant for this student, not already saved
  const saved = new Set(workbench.items.filter((i) => i.kind === "event").map((i) => i.ref));
  const events = Object.entries(index.event)
    .filter(([id, e]) => e.student_types && appliesTo(e, levelName, type) && new Date(e.end) > now && !saved.has(id) && !dismissed.has(`event:${id}`))
    .sort((a, b) => a[1].start.localeCompare(b[1].start))
    .map(([id, event]) => ({ id, event, reason: `${reason}.` }));

  // Calendar dates for this student, except those a step already shows
  const shownBySteps = new Set(steps.map((s) => s.calendarKey).filter(Boolean));
  const calendar = rules.calendarFor(term, levelName, type).filter((e) => !shownBySteps.has(e.key));

  return { steps, offices, events, calendar, reason, done: steps.filter((s) => s.status === "done").length };
}

// The plan's next step, from the steps alone: what the header and the
// next-step tile show on every page, without the catalog index
export const nextOf = (steps: PlanStep[]) => steps.find((s) => s.next);

// Timeline -------------------------------------------------------------------------

export type PathEntry = {
  date: string; // YYYY-MM-DD
  end?: string; // for date ranges
  start?: string; // ISO date and time, for timed events
  finish?: string;
  kind: "deadline" | "milestone" | "event";
  title: string;
  // Where the date comes from, shown next to it: "academic calendar", "Nursing, MSN deadline", "saved event"
  source: string;
  url?: string;
  id: string; // stable, for focus and calendar files
  done?: boolean;
  past: boolean;
  next: boolean;
};

const KIND_OF_STEP = (s: PlanStep, rules: RulesLookup, term: string): PathEntry["kind"] => (s.calendarKey ? (rules.calendarEntry(s.calendarKey, term)?.kind ?? "deadline") : "deadline");
const campusDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });

// Everything with a date, once each, in order: steps (their dates shown as
// the step), the rest of the calendar, deadlines of other saved programs at
// this level, and saved events. Without a plan: saved programs and events.
export function pathTimeline(plan: Plan | undefined, rules: RulesLookup, index: WorkbenchIndex, workbench: Workbench, term: string, planLevel: string | undefined, now = new Date()): PathEntry[] {
  const today = campusToday(now);
  const entries: Omit<PathEntry, "past" | "next">[] = [];
  const serviceUrl = (id?: string) => (id ? index.service[id]?.url : undefined);

  for (const s of plan?.steps ?? []) {
    if (!s.date) continue;
    entries.push({ id: `step:${s.step.id}`, date: s.date, kind: KIND_OF_STEP(s, rules, term), title: s.step.title, source: s.dateSource ?? "your plan", url: s.step.url ?? serviceUrl(s.step.office), done: s.status === "done" });
  }
  for (const e of plan?.calendar ?? []) {
    entries.push({ id: `calendar:${e.id}`, date: e.date, ...(e.end && { end: e.end }), kind: e.kind, title: e.title, source: "academic calendar", url: e.url ?? serviceUrl(e.service) });
  }
  const usedProgram = plan?.steps.find((s) => s.programRef)?.programRef;
  for (const item of programsByPlan(workbench, index, planLevel).inPlan) {
    const d = item.ref !== usedProgram && programDeadline(item, index, term);
    if (d) entries.push({ id: `program:${item.ref}`, date: d.date, kind: "deadline", title: `Application deadline for ${term}`, source: `${d.name} deadline`, url: index.program[item.ref!].url });
  }
  for (const item of workbench.items.filter((i) => i.kind === "event" && i.ref && index.event[i.ref])) {
    const e = index.event[item.ref!];
    entries.push({ id: `event:${item.ref}`, date: campusDay(e.start), start: e.start, finish: e.end, kind: "event", title: e.title, source: "saved event", url: e.url });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
  const nextAt = entries.findIndex((e) => (e.end ?? e.date) >= today && !e.done);
  return entries.map((e, i) => ({ ...e, past: (e.end ?? e.date) < today, next: i === nextAt }));
}

// An .ics file for one timeline entry: timed events keep their times; other
// dates are all-day (a range for something like finals week)
export function pathIcs(entry: PathEntry, siteName: string, origin: string) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (d: string) => d.replace(/-/g, "");
  const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const when =
    entry.start && entry.finish
      ? [`DTSTART:${stamp(entry.start)}`, `DTEND:${stamp(entry.finish)}`]
      : [`DTSTART;VALUE=DATE:${day(entry.date)}`, `DTEND;VALUE=DATE:${dayAfter(entry.end ?? entry.date)}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(siteName)}//Your Path//EN`,
    "BEGIN:VEVENT",
    `UID:${entry.id.replace(/[^a-z0-9-]/gi, "-")}-${day(entry.date)}@${new URL(origin).host}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    ...when,
    `SUMMARY:${esc(entry.title)}`,
    ...(entry.url ? [`URL:${new URL(entry.url, origin).toString()}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
