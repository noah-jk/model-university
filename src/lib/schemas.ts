// Content schemas. src/content.config.ts uses them for the site build, and
// scripts/check-content.ts uses them to validate data outside Astro.

import { z } from "astro/zod";
import { ALL_STUDENT_TYPES, AUDIENCES, CAMPUSES, COURSE_LEVELS, EVENT_CATEGORIES, FACULTY_TITLES, MODALITIES, PROGRAM_LEVELS, EDUCATION_LEVELS, SERVICE_CATEGORIES, SKILL_TYPES, STEP_PHASES, STUDENT_LEVELS, TERMS } from "./vocab.ts";

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters and numbers joined by hyphens");
const text = z.string().min(1);
const list = z.array(text);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use 24-hour HH:MM");
const openHours = z.tuple([time, time]).nullable();

export const college = z.object({
  id,
  name: text,
  description: text,
});

export const department = z.object({
  id,
  name: text,
  field: text,
  college: id, // → colleges
  cip: z.string().regex(/^\d{2}\.\d{4}$/),
  course_prefix: z.string().regex(/^[A-Z]{2,5}$/),
});

export const program = z.object({
  id,
  name: text,
  level: z.enum(PROGRAM_LEVELS),
  credential: text,
  department: id, // → departments
  modality: z.enum(MODALITIES),
  campus: z.enum(CAMPUSES),
  start_terms: z.array(z.enum(TERMS)).min(1),
  application_deadlines: z.array(z.object({ term: z.enum(TERMS), deadline: text })),
  credits: z.number().int().positive(),
  duration: text,
  tuition_per_credit_usd: z.number().positive(),
  estimated_total_tuition_usd: z.number().positive(),
  description: text,
  outcomes: list,
  careers: list,
  keywords: list,
  requirements: list,
  accepts_transfer_credit: z.boolean(),
});

export const course = z.object({
  id,
  code: z.string().regex(/^[A-Z]{2,5} \d{3}$/),
  title: text,
  department: id, // → departments
  level: z.enum(COURSE_LEVELS),
  credits: z.number().int().positive(),
  terms_offered: z.array(z.enum(TERMS)).min(1),
  modality: z.enum(MODALITIES),
  instructor: id, // → faculty
  prerequisites: z.array(id), // → courses
  description: text,
});

export const service = z.object({
  id,
  name: text,
  category: z.enum(SERVICE_CATEGORIES),
  description: text,
  location: text,
  campus: z.enum(CAMPUSES),
  virtual_option: z.boolean(),
  hours: z.object({ mon: openHours, tue: openHours, wed: openHours, thu: openHours, fri: openHours, sat: openHours, sun: openHours }),
  phone: z.string().regex(/^\(\d{3}\) \d{3}-\d{4}$/),
  email: z.email(),
  eligibility: text,
  appointment_required: z.boolean(),
  tags: list,
});

export const facultyMember = z.object({
  id,
  name: text,
  title: z.enum(FACULTY_TITLES),
  role: text.optional(),
  department: id, // → departments
  email: z.email(),
  office: text,
  research_interests: list,
  bio: text,
});

// Links from an event or news story to the things it's about
export const related = z
  .object({
    programs: z.array(id), // → programs
    departments: z.array(id), // → departments
    services: z.array(id), // → services
    faculty: z.array(id), // → faculty
  })
  .partial();

// Date and time with its UTC offset, e.g. 2026-10-16T10:00:00-07:00
const dateTime = z.iso.datetime({ offset: true });

export const event = z
  .object({
    id,
    title: text,
    start: dateTime,
    end: dateTime,
    category: z.enum(EVENT_CATEGORIES),
    audience: z.array(z.enum(AUDIENCES)).min(1),
    location: text,
    campus: z.enum(CAMPUSES),
    registration_required: z.boolean(),
    description: text,
    related: related.default({}),
    // Admissions events for particular students, e.g. a transfer information
    // night. Omitted means the event is for everyone in its audience.
    levels: z.array(z.enum(STUDENT_LEVELS)).min(1).optional(),
    student_types: z.array(z.enum(ALL_STUDENT_TYPES)).min(1).optional(),
  })
  .refine((e) => new Date(e.end) > new Date(e.start), { message: "An event must end after it starts", path: ["end"] });

// Markdown collections: the fields in each file's frontmatter
export const newsStory = z.object({
  title: text,
  date: z.coerce.date(),
  summary: text,
  author: text,
  tags: list,
  related: related.default({}),
});

// One entry in content/generated/news.json, the index of content/news/ that
// scripts/index-news.ts builds for the MCP server (which can't read Markdown)
export const newsIndexEntry = newsStory.extend({
  id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const page = z.object({
  // The page's id, e.g. "admissions/visit". Set explicitly so it doesn't
  // depend on how the files are arranged in folders.
  slug: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/),
  title: text,
  description: text,
});

// Enrollment rules (content/enrollment/): what applies to whom, for Your Path.
// These files are edited by hand, the way an admissions office would own them.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const termName = z.string().regex(/^(Fall|Winter|Spring|Summer) \d{4}$/, 'Use a term like "Winter 2027"');
const academicYear = z.string().regex(/^\d{4}-\d{2}$/, 'Use an academic year like "2026-27"');
// A page on this site ("/admissions/apply/") or an outside https link
const link = z.string().regex(/^\/([a-z0-9-]+\/)*$|^https:\/\//, 'Use a site path like "/admissions/apply/" or an https link');
const levels = z.array(z.enum(STUDENT_LEVELS)).min(1);
const studentTypes = z.array(z.enum(ALL_STUDENT_TYPES)).min(1);
// "Winter 2027" → "winter-2027"
export const termSlug = (term: string) => term.toLowerCase().replace(" ", "-");

// One date in the academic calendar. Institution-wide only: application
// deadlines belong to each program. Each entry is for one term, or for a
// whole academic year (like the FAFSA priority date). Steps find entries by
// `key` and the student's start term.
export const calendarEntry = z
  .object({
    id,
    key: id,
    term: termName.optional(),
    year: academicYear.optional(),
    title: text,
    date: day,
    end: day.optional(),
    kind: z.enum(["deadline", "milestone", "event"]),
    levels: levels.optional(), // omitted: everyone
    student_types: studentTypes.optional(), // omitted: everyone
    description: text.optional(),
    service: id.optional(), // → services, the office to ask
    url: link.optional(),
  })
  .refine((e) => Boolean(e.term) !== Boolean(e.year), { message: "Give either a term or an academic year", path: ["term"] })
  .refine((e) => e.id === `${e.term ? termSlug(e.term) : e.year}-${e.key}`, { message: "The id must be the term (or year) and the key, e.g. winter-2027-classes-begin", path: ["id"] })
  .refine((e) => !e.end || e.end >= e.date, { message: "end must be on or after date", path: ["end"] });

export const JOURNEY_STEPS = ["explore", "requestInfo", "visit", "apply"] as const;

// One enrollment step: what a student does, for which students, and how its
// due date is worked out from the start term.
export const enrollmentStep = z.object({
  id,
  title: text,
  short: text.max(28).optional(), // for tight spaces like the header button, e.g. "Send transcripts"
  description: text,
  levels,
  student_types: studentTypes,
  order: z.number().int(),
  phase: z.enum(STEP_PHASES), // "admitted" steps fold under "For admitted students" on Your Path
  due: z
    .union([
      z.object({ calendar: id }).strict(), // a calendar entry's key, for the start term
      z.object({ before_term_start_days: z.number().int().positive() }).strict(),
      z.object({ program_deadline: z.literal(true) }).strict(), // the saved program's deadline for the term
    ])
    .optional(),
  office: id.optional(), // → services
  url: link.optional(),
  journey: z.enum(JOURNEY_STEPS).optional(), // done when this application-journey step is done
});

// The offices to suggest to one kind of student, each with why
export const officeSet = z.object({
  level: z.enum(STUDENT_LEVELS),
  student_type: z.enum(ALL_STUDENT_TYPES),
  offices: z.array(z.object({ service: id, reason: text })).min(2).max(4),
});

// Every generated collection, keyed by its file name in content/generated/.
// Careers. An occupation (content/careers/occupations.json, edited by hand)
// is a real SOC code and title matched to fields of study by CIP code; its id
// is the page address, so a new code never breaks a link. Its numbers
// (content/generated/careers.json) are made up, in the shape Lightcast returns.
export const occupation = z.object({
  id,
  soc: z.string().regex(/^\d{2}-\d{4}$/, 'Use a SOC code like "15-1252"'),
  title: text, // the official SOC title
  name: text, // what pages show, e.g. "Software developer"
  cips: z.array(z.string().regex(/^\d{2}\.\d{4}$/)).min(1), // fields of study (departments' CIP codes)
  education: z.enum(EDUCATION_LEVELS), // typical education to enter
  summary: text,
  titles: z.array(text), // other job titles
});

const wageSpread = z
  .object({ p10: z.number().int().positive(), p25: z.number().int().positive(), median: z.number().int().positive(), p75: z.number().int().positive(), p90: z.number().int().positive() })
  .refine((w) => w.p10 <= w.p25 && w.p25 <= w.median && w.median <= w.p75 && w.p75 <= w.p90, "Percentiles must be in order");

export const careerData = z.object({
  id, // → occupations
  region: text,
  vintage: text, // the data's year, for the source line
  wages: z.object({ washington: wageSpread, national: wageSpread }),
  employment: z.number().int().positive(),
  growth_percent: z.number(), // ten-year projected change
  annual_openings: z.number().int().positive(),
  postings: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), count: z.number().int().nonnegative() })).length(12),
  skills: z.array(z.object({ name: text, type: z.enum(SKILL_TYPES) })).min(3),
  employers: z.array(text).min(1),
});

export const generatedSchemas = {
  colleges: college,
  departments: department,
  programs: program,
  courses: course,
  services: service,
  faculty: facultyMember,
  events: event,
  news: newsIndexEntry,
  careers: careerData,
};

// Fields that hold the ids of entries in another collection.
// "related.programs" means the programs list inside the related object.
export const references: Record<string, Record<string, keyof typeof generatedSchemas>> = {
  departments: { college: "colleges" },
  programs: { department: "departments" },
  courses: { department: "departments", prerequisites: "courses", instructor: "faculty" },
  faculty: { department: "departments" },
  events: { "related.programs": "programs", "related.departments": "departments", "related.services": "services", "related.faculty": "faculty" },
  news: { "related.programs": "programs", "related.departments": "departments", "related.services": "services", "related.faculty": "faculty" },
};

export type College = z.infer<typeof college>;
export type Occupation = z.infer<typeof occupation>;
export type CareerData = z.infer<typeof careerData>;
export type Department = z.infer<typeof department>;
export type Program = z.infer<typeof program>;
export type Course = z.infer<typeof course>;
export type Service = z.infer<typeof service>;
export type FacultyMember = z.infer<typeof facultyMember>;
export type Event = z.infer<typeof event>;
export type CalendarEntry = z.infer<typeof calendarEntry>;
export type EnrollmentStep = z.infer<typeof enrollmentStep>;
export type OfficeSet = z.infer<typeof officeSet>;
export type Related = z.infer<typeof related>;
export type NewsIndexEntry = z.infer<typeof newsIndexEntry>;
