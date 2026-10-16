// Lookups over the enrollment rules (the academic calendar, steps, and
// offices by student type). They take the rules as data, so the same code
// runs at build time (src/lib/enrollment.ts imports the JSON), in the browser
// (Your Path fetches /data/enrollment.json), and in the MCP server.

import type { CalendarEntry, EnrollmentStep, OfficeSet } from "./schemas.ts";

export type Rules = { calendar: CalendarEntry[]; steps: EnrollmentStep[]; offices: OfficeSet[] };

// Whether something with optional levels and student_types applies to a student
export const appliesTo = (entry: { levels?: readonly string[]; student_types?: readonly string[] }, level: string, type: string) =>
  (!entry.levels || entry.levels.includes(level)) && (!entry.student_types || entry.student_types.includes(type));

// "Fall 2026" and "Winter 2027" are both in the 2026–27 academic year ("2026-27")
export function academicYearOf(term: string) {
  const [season, yearText] = term.split(" ");
  const start = Number(yearText) - (season === "Fall" ? 0 : 1);
  return `${start}-${String(start + 1).slice(2)}`;
}

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (day: string) => Date.parse(`${day}T12:00:00Z`);

export function rulesFrom(data: Rules) {
  const steps = [...data.steps].sort((a, b) => a.order - b.order);
  const { calendar, offices } = data;

  // The calendar entry for a key in a start term: the term's own entry, or the
  // entry for its academic year (like the FAFSA priority date)
  const calendarEntry = (key: string, term: string) => calendar.find((e) => e.key === key && (e.term === term || e.year === academicYearOf(term)));

  // The first day of classes, "2027-01-04"
  const termStart = (term: string) => calendarEntry("classes-begin", term)?.date;

  // Terms the calendar covers, in order
  const calendarTerms = [...new Set(calendar.filter((e) => e.key === "classes-begin").sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.term!))];

  return {
    steps,
    calendar,
    calendarTerms,
    calendarEntry,
    termStart,

    // A term's dates (and its academic year's), in date order, for one kind of
    // student if level and type are given
    calendarFor: (term: string, level?: string, type?: string) =>
      calendar
        .filter((e) => e.term === term || e.year === academicYearOf(term))
        .filter((e) => !level || !type || appliesTo(e, level, type))
        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),

    // The steps for one kind of student, in order
    stepsFor: (level: string, type: string) => steps.filter((s) => appliesTo(s, level, type)),

    // The offices to suggest, each with why
    officesFor: (level: string, type: string) => offices.find((o) => o.level === level && o.student_type === type)?.offices ?? [],

    // Terms that haven't started yet, from `now`
    upcomingCalendarTerms: (now = new Date()) => calendarTerms.filter((term) => termStart(term)! > toDay(now.getTime())),

    // When a step is due in a start term, if its date is fixed: a calendar
    // date, or a number of days before classes begin. Program deadlines depend
    // on the program, so they have no date here.
    stepDueDate(step: EnrollmentStep, term: string) {
      const due = step.due;
      if (!due) return undefined;
      if ("calendar" in due) return calendarEntry(due.calendar, term)?.date;
      if ("before_term_start_days" in due) {
        const start = termStart(term);
        return start && toDay(dayMs(start) - due.before_term_start_days * 86_400_000);
      }
      return undefined;
    },
  };
}

export type RulesLookup = ReturnType<typeof rulesFrom>;
