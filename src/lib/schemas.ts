// Content schemas. src/content.config.ts uses them for the site build, and
// scripts/check-content.ts uses them to validate data outside Astro.

import { z } from "astro/zod";
import { AUDIENCES, CAMPUSES, COURSE_LEVELS, EVENT_CATEGORIES, FACULTY_TITLES, MODALITIES, PROGRAM_LEVELS, SERVICE_CATEGORIES, TERMS } from "./vocab.ts";

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

// Every generated collection, keyed by its file name in content/generated/.
export const generatedSchemas = {
  colleges: college,
  departments: department,
  programs: program,
  courses: course,
  services: service,
  faculty: facultyMember,
  events: event,
  news: newsIndexEntry,
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
export type Department = z.infer<typeof department>;
export type Program = z.infer<typeof program>;
export type Course = z.infer<typeof course>;
export type Service = z.infer<typeof service>;
export type FacultyMember = z.infer<typeof facultyMember>;
export type Event = z.infer<typeof event>;
export type Related = z.infer<typeof related>;
export type NewsIndexEntry = z.infer<typeof newsIndexEntry>;
