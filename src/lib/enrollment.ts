// Enrollment rules (content/enrollment/): the academic calendar, enrollment
// steps, and offices by student type. Plain lookups over the JSON, shared by
// the admissions pages, Your Path's plan, and (later) the MCP server.

import calendarData from "../../content/enrollment/calendar.json" with { type: "json" };
import stepsData from "../../content/enrollment/steps.json" with { type: "json" };
import officesData from "../../content/enrollment/offices.json" with { type: "json" };
import type { CalendarEntry, EnrollmentStep, OfficeSet } from "./schemas.ts";
import { STUDENT_LEVELS, STUDENT_TYPES } from "./vocab.ts";

export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export type StudentType = (typeof STUDENT_TYPES)[StudentLevel][number];

export const calendar = calendarData as CalendarEntry[];
export const steps = [...(stepsData as EnrollmentStep[])].sort((a, b) => a.order - b.order);
export const officeSets = officesData as OfficeSet[];

export const isStudentType = (level: StudentLevel, type: string): type is StudentType => (STUDENT_TYPES[level] as readonly string[]).includes(type);

// Whether something with optional levels and student_types applies to a student
export const appliesTo = (entry: { levels?: readonly string[]; student_types?: readonly string[] }, level: string, type: string) =>
  (!entry.levels || entry.levels.includes(level)) && (!entry.student_types || entry.student_types.includes(type));

// "Fall 2026" and "Winter 2027" are both in the 2026–27 academic year ("2026-27")
export function academicYearOf(term: string) {
  const [season, yearText] = term.split(" ");
  const start = Number(yearText) - (season === "Fall" ? 0 : 1);
  return `${start}-${String(start + 1).slice(2)}`;
}

// Terms the calendar covers, in order
export const calendarTerms = [...new Set(calendar.filter((e) => e.term).sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.term!))].filter(
  (term) => calendar.some((e) => e.term === term && e.key === "classes-begin")
);

// The calendar entry for a key in a start term: the term's own entry, or the
// entry for its academic year (like the FAFSA priority date)
export const calendarEntry = (key: string, term: string) =>
  calendar.find((e) => e.key === key && (e.term === term || e.year === academicYearOf(term)));

// The first day of classes, "2027-01-04"
export const termStart = (term: string) => calendarEntry("classes-begin", term)?.date;

// A term's dates (and its academic year's), in date order, for one kind of
// student if level and type are given
export const calendarFor = (term: string, level?: string, type?: string) =>
  calendar
    .filter((e) => e.term === term || e.year === academicYearOf(term))
    .filter((e) => !level || !type || appliesTo(e, level, type))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

// The steps for one kind of student, in order
export const stepsFor = (level: string, type: string) => steps.filter((s) => appliesTo(s, level, type));

// The offices to suggest, each with why
export const officesFor = (level: string, type: string) => officeSets.find((o) => o.level === level && o.student_type === type)?.offices ?? [];

// Terms that haven't started yet, from `now`
export const upcomingCalendarTerms = (now = new Date()) => calendarTerms.filter((term) => termStart(term)! > now.toISOString().slice(0, 10));

// When a step is due in a start term, if its date is fixed: a calendar date,
// or a number of days before classes begin. Program deadlines depend on the
// program, so they have no date here.
export function stepDueDate(step: EnrollmentStep, term: string) {
  const due = step.due;
  if (!due) return undefined;
  if ("calendar" in due) return calendarEntry(due.calendar, term)?.date;
  if ("before_term_start_days" in due) {
    const start = termStart(term);
    return start && new Date(Date.parse(`${start}T12:00:00Z`) - due.before_term_start_days * 86_400_000).toISOString().slice(0, 10);
  }
  return undefined;
}
