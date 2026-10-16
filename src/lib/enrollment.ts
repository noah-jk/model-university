// Enrollment rules (content/enrollment/): the academic calendar, enrollment
// steps, and offices by student type, with the lookups from
// enrollment-rules.ts bound to them. Used at build time by the admissions
// pages, /data/enrollment.json, and tests.

import calendarData from "../../content/enrollment/calendar.json" with { type: "json" };
import stepsData from "../../content/enrollment/steps.json" with { type: "json" };
import officesData from "../../content/enrollment/offices.json" with { type: "json" };
import { rulesFrom } from "./enrollment-rules.ts";
import type { CalendarEntry, EnrollmentStep, OfficeSet } from "./schemas.ts";
import { STUDENT_LEVELS, STUDENT_TYPES } from "./vocab.ts";

export { academicYearOf, appliesTo } from "./enrollment-rules.ts";

export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export type StudentType = (typeof STUDENT_TYPES)[StudentLevel][number];

export const isStudentType = (level: StudentLevel, type: string): type is StudentType => (STUDENT_TYPES[level] as readonly string[]).includes(type);

export const rules = rulesFrom({ calendar: calendarData as CalendarEntry[], steps: stepsData as EnrollmentStep[], offices: officesData as OfficeSet[] });
export const { calendar, steps, calendarTerms, calendarEntry, termStart, calendarFor, stepsFor, officesFor, upcomingCalendarTerms, stepDueDate } = rules;
export const officeSets = officesData as OfficeSet[];
