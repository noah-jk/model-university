// Enrollment rules (content/enrollment/): the academic calendar, enrollment
// steps, and offices by student type, with the lookups from
// enrollment-rules.ts bound to them. Used at build time by the admissions
// pages, /data/enrollment.json, the MCP tools (below), and tests.

import calendarData from "../../content/enrollment/calendar.json" with { type: "json" };
import stepsData from "../../content/enrollment/steps.json" with { type: "json" };
import officesData from "../../content/enrollment/offices.json" with { type: "json" };
import siteConfig from "../../site.config.ts";
import { services } from "./catalog.ts";
import { academicYearOf, appliesTo, rulesFrom } from "./enrollment-rules.ts";
import type { CalendarEntry, EnrollmentStep, OfficeSet, Program } from "./schemas.ts";
import { absoluteUrl, pagePath } from "./urls.ts";
import { STUDENT_LEVELS, STUDENT_TYPES } from "./vocab.ts";
import { deadlineDate, termName } from "./workbench/derive.ts";
import { pathLink } from "./workbench/handoffs.ts";
import { planSteps } from "./workbench/plan.ts";
import { describeStudents } from "./workbench/profile.ts";

export { academicYearOf, appliesTo };

export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export type StudentType = (typeof STUDENT_TYPES)[StudentLevel][number];

export const isStudentType = (level: StudentLevel, type: string): type is StudentType => (STUDENT_TYPES[level] as readonly string[]).includes(type);

export const rules = rulesFrom({ calendar: calendarData as CalendarEntry[], steps: stepsData as EnrollmentStep[], offices: officesData as OfficeSet[] });
export const { calendar, steps, calendarTerms, calendarEntry, termStart, calendarFor, stepsFor, officesFor, upcomingCalendarTerms, stepDueDate } = rules;
export const officeSets = officesData as OfficeSet[];

// Answers for students' own AI tools (the MCP tools in src/lib/tools.ts) ------
// The same steps and dates Your Path shows for a profile with nothing saved,
// from the same code (planSteps), with absolute URLs. Inputs are checked by
// the tools first.

const campusToday = (now: Date) => now.toLocaleDateString("en-CA", { timeZone: siteConfig.timezone });
const serviceNamed = (id: string) => services.find((s) => s.id === id);
const serviceUrl = (id: string | undefined, base: string | URL) => (id && serviceNamed(id) ? absoluteUrl(pagePath("services", id), base) : undefined);

export type StepsQuery = { level: StudentLevel; type: string; term: string; program?: Program };

// The steps for one kind of student and start term. With a program, the
// apply step uses its application deadline for the term.
export function enrollmentSteps({ level, type, term, program }: StepsQuery, base: string | URL, now = new Date()) {
  const season = termName(term);
  const deadline = program?.start_terms.includes(season as never) ? program.application_deadlines.find((d) => d.term === season) : undefined;
  const deadlineDay = deadline && deadlineDate(deadline.deadline, term);
  const planned = planSteps(rules, level, type, term, {
    completed: [],
    journeyDone: [],
    programDeadlines: program && deadlineDay ? [{ date: deadlineDay, name: program.name, ref: program.id }] : [],
    now,
  });
  const today = campusToday(now);
  // The site's note ("Save one to see it") is about saving; here, say how to get the date
  const programNote = program
    ? `${program.name} doesn't start in ${term}, so it has no application deadline for that term. Its start terms: ${program.start_terms.join(", ")}.`
    : "Depends on the program: get_program lists each program's application deadlines, or pass program_id to fill in this date.";
  return {
    for: `${describeStudents(level, type)} starting ${term}`,
    student_type: type,
    level,
    term,
    ...(program && { program: { id: program.id, name: program.name, application_deadline: deadlineDay ?? null, url: absoluteUrl(pagePath("programs", program.id), base) } }),
    steps: planned.map((s, i) => {
      const { step } = s;
      const url = step.url ?? (step.office ? pagePath("services", step.office) : undefined);
      return {
        order: i + 1,
        id: step.id,
        title: step.title,
        description: step.description,
        due_date: s.date ?? null,
        ...(s.dateSource && { date_source: s.dateSource }),
        ...(s.note && { note: programNote }),
        passed: Boolean(s.date && s.date < today),
        journey: Boolean(step.journey),
        ...(url && { url: absoluteUrl(url, base) }),
        ...(step.office && serviceNamed(step.office) && { office: { id: step.office, name: serviceNamed(step.office)!.name, url: serviceUrl(step.office, base) } }),
      };
    }),
    offices: officesFor(level, type).flatMap((o) => (serviceNamed(o.service) ? [{ id: o.service, name: serviceNamed(o.service)!.name, reason: o.reason, url: serviceUrl(o.service, base) }] : [])),
    ...(siteConfig.features.workbench && { your_path_url: absoluteUrl(pathLink({ type, level }), base) }),
  };
}

// A term's institution-wide dates (and its academic year's), in date order.
// With a student type or levels, only the dates for those students.
export function academicCalendar({ term, type, levels }: { term: string; type?: string; levels?: StudentLevel[] }, base: string | URL) {
  // For a type, the dates that apply to it at any of the levels; for a level alone, that level's dates
  const forStudent = (e: CalendarEntry) =>
    !levels || levels.some((level) => (type ? appliesTo(e, level, type) : !e.levels || e.levels.includes(level)));
  return {
    term,
    academic_year: academicYearOf(term),
    ...(type && { student_type: type }),
    ...(levels?.length === 1 && { level: levels[0] }),
    dates: calendarFor(term)
      .filter(forStudent)
      .map((e) => ({
        date: e.date,
        ...(e.end && { end: e.end }),
        title: e.title,
        kind: e.kind,
        key: e.key,
        ...(e.description && { description: e.description }),
        ...(e.student_types && { for_student_types: e.student_types }),
        ...(e.levels && { for_levels: e.levels }),
        ...((e.url || e.service) && { url: e.url ? absoluteUrl(e.url, base) : serviceUrl(e.service, base) }),
      })),
    note: "Application deadlines aren't here: each program has its own (get_program).",
  };
}
