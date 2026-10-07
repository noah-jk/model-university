// Schemas for the generated content in content/generated/.
// src/content.config.ts uses them for the site build, and
// scripts/check-content.ts uses them to validate data outside Astro.

import { z } from "astro/zod";
import { CAMPUSES, COURSE_LEVELS, MODALITIES, PROGRAM_LEVELS, SERVICE_CATEGORIES, TERMS } from "./vocab.ts";

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
  instructor: text,
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

// Every generated collection, keyed by its file name in content/generated/.
export const generatedSchemas = {
  colleges: college,
  departments: department,
  programs: program,
  courses: course,
  services: service,
};

// Fields that hold the id of an entry in another collection.
export const references: Record<string, Record<string, keyof typeof generatedSchemas>> = {
  departments: { college: "colleges" },
  programs: { department: "departments" },
  courses: { department: "departments", prerequisites: "courses" },
};

export type College = z.infer<typeof college>;
export type Department = z.infer<typeof department>;
export type Program = z.infer<typeof program>;
export type Course = z.infer<typeof course>;
export type Service = z.infer<typeof service>;
